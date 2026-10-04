import { readFileSync } from 'node:fs'

export function databaseOptions(env: Record<string, string | undefined>) {
  if (env.DATABASE_SSL !== 'true') return { connectionString: env.DATABASE_URL }
  const url = env.DATABASE_URL ? new URL(env.DATABASE_URL) : undefined
  // pg connection-string SSL options replace the explicit ssl object.
  // Keep certificate verification authoritative when TLS is enabled.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) url?.searchParams.delete(key)
  const ca = env.DATABASE_CA || (env.DATABASE_CA_FILE ? readFileSync(env.DATABASE_CA_FILE, 'utf8') : undefined)
  return { connectionString: url?.toString(), ssl: { rejectUnauthorized: true as const, ...(ca ? { ca } : {}) } }
}
