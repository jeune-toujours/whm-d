import { getPayload } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import config from './payload.config'

if (process.env.WHM_BUILD === '1' || process.env.DATABASE_PUSH === 'true') throw new Error('Deployment requires runtime credentials and migrations, never schema push')
const payload = await getPayload({ config, cron: false })
const db = payload.db as unknown as PostgresAdapter
const connection = await db.pool.connect()
try {
  await connection.query("SET statement_timeout = '120s'")
  await connection.query("SELECT pg_advisory_lock(hashtextextended('whm-schema-migrations', 0))")
  const table = await connection.query("SELECT to_regclass('public.payload_migrations') AS name")
  if (table.rows[0].name) {
    const pushed = await connection.query('SELECT 1 FROM payload_migrations WHERE batch = -1 LIMIT 1')
    if (pushed.rowCount) throw new Error('Schema push history detected. Review database before deployment')
  }
  await db.migrate()
  console.log('WHM schema migrations complete')
} finally {
  await connection.query("SELECT pg_advisory_unlock(hashtextextended('whm-schema-migrations', 0))")
  connection.release()
}
// Payload 3.90 keeps its reconnect client checked out. This is a one-shot process.
process.exit(0)
