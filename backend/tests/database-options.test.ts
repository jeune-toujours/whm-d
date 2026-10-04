import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseOptions } from '../src/database-options'

test('explicit TLS cannot be weakened by connection-string SSL options', () => {
  const result = databaseOptions({ DATABASE_URL: 'postgres://user:pass@localhost/db?sslmode=disable&application_name=whm', DATABASE_SSL: 'true', DATABASE_CA: 'test-ca' })
  assert.equal(new URL(result.connectionString!).searchParams.has('sslmode'), false)
  assert.equal(new URL(result.connectionString!).searchParams.get('application_name'), 'whm')
  assert.deepEqual(result.ssl, { rejectUnauthorized: true, ca: 'test-ca' })
})

test('local databases keep their original connection configuration', () => {
  const url = 'postgres://user:pass@localhost/db'
  assert.deepEqual(databaseOptions({ DATABASE_URL: url }), { connectionString: url })
})
