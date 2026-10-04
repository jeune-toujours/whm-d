import { APIError } from 'payload'

export const intakeStages = ['created', 'received', 'placed', 'completed', 'cancelled'] as const
export const returnStages = ['created', 'picking', 'ready', 'completed', 'cancelled'] as const
export class DomainError extends APIError {
  constructor(status: number, public code: string, message: string) { super(message, status, { code }, true) }
}
export function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new DomainError(400, 'INVALID_PHONE', 'Укажите номер телефона.')
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (digits.length !== 11 || !digits.startsWith('7')) throw new DomainError(400, 'INVALID_PHONE', 'Нужен российский номер +7.')
  return `+${digits}`
}
export function assertTransition(type: string, from: string, to: string) {
  const stages = type === 'intake' ? intakeStages : returnStages
  const index = stages.indexOf(from as never)
  if (index < 0 || from === 'completed' || from === 'cancelled' || (to !== stages[index + 1] && !(to === 'cancelled' && from === 'created'))) {
    throw new DomainError(409, 'INVALID_TRANSITION', 'Этот переход статуса недоступен.')
  }
}
export function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
export const relationID = (value: unknown): string => typeof value === 'object' && value !== null && 'id' in value ? String(value.id) : String(value ?? '')
