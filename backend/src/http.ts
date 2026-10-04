import type { Endpoint, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { DomainError } from './domain'
import { hasRole, userOf } from './access'

export const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
export function clientUser(req: PayloadRequest) {
  const user = userOf(req)
  if (!user || user.active === false) throw new DomainError(401, 'UNAUTHENTICATED', 'Войдите в аккаунт.')
  if (user.role !== 'client') throw new DomainError(403, 'CLIENT_ONLY', 'Используйте рабочий кабинет сотрудника.')
  return user
}
export const staffUser = (req: PayloadRequest) => { if (!hasRole(req, ['admin', 'manager', 'warehouse'])) throw new DomainError(403, 'FORBIDDEN', 'Недостаточно прав.'); return userOf(req)! }
export async function body(req: PayloadRequest): Promise<Record<string, any>> {
  if (!req.json || !req.headers.get('content-type')?.includes('application/json')) throw new DomainError(400, 'INVALID_BODY', 'Ожидается JSON.')
  try { const data = await req.json(); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data }
  catch { throw new DomainError(400, 'INVALID_BODY', 'Неверный формат JSON.') }
}
export function endpoint(path: string, method: Endpoint['method'], handler: (req: PayloadRequest) => Promise<Response>): Endpoint {
  return { path, method, handler: async req => {
    try {
      if (method !== 'get') {
        const origin = req.headers.get('origin')
        const allowed = [process.env.APP_URL || 'http://localhost:3000', process.env.CLIENT_URL || 'http://localhost:5173']
        if (!origin || !allowed.includes(origin)) throw new DomainError(403, 'INVALID_ORIGIN', 'Источник запроса не разрешён.')
      }
      return await handler(req)
    } catch (error) {
      if (error instanceof DomainError) return json({ ok: false, code: error.code, message: error.message }, error.status)
      // Payload access failures must not become a misleading 500 or expose an object's existence.
      const status = (error as { status?: number }).status
      if (status === 403 || status === 404) return json({ ok: false, code: 'NOT_FOUND', message: 'Запись недоступна.' }, 404)
      req.payload.logger.error({ msg: 'WHM endpoint failed', path, code: (error as { code?: string }).code || 'INTERNAL_ERROR' })
      return json({ ok: false, code: 'INTERNAL_ERROR', message: 'Не удалось выполнить операцию. Повторите попытку.' }, 500)
    }
  } }
}
// Row-level workflows and OTP use the same transaction as all Payload writes.
// Locks work across containers, avoiding in-memory rate limits and duplicate returns.
export async function transaction<T>(req: PayloadRequest, keys: string[], work: () => Promise<T>): Promise<T> {
  const previous = req.transactionID
  const id = await req.payload.db.beginTransaction()
  if (!id) throw new Error('PostgreSQL transactions are required')
  req.transactionID = id
  try {
    const adapter = req.payload.db as unknown as PostgresAdapter
    const db = adapter.sessions[String(id)].db
    for (const key of [...new Set(keys)].sort()) await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
    const result = await work()
    await req.payload.db.commitTransaction(id)
    return result
  } catch (error) { await req.payload.db.rollbackTransaction(id); throw error }
  finally { req.transactionID = previous }
}
