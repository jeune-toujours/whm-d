import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, assertTransition, DomainError } from '../src/domain'
import { owned, admin, staff, self } from '../src/access'
import type { PayloadRequest } from 'payload'
test('phone normalization rejects non-Russian, truncated and non-string input', () => {
  assert.equal(normalizePhone('8 (999) 123-45-67'), '+79991234567')
  assert.equal(normalizePhone('+7 999 123 45 67'), '+79991234567')
  for (const phone of ['+1 202 555 0123', '999123', undefined, 79991234567]) assert.throws(() => normalizePhone(phone), DomainError)
})
test('terminal orders cannot be reopened or cancelled and stages cannot be skipped', () => {
  assertTransition('intake', 'created', 'received')
  assertTransition('return', 'picking', 'ready')
  assertTransition('return', 'created', 'cancelled')
  for (const args of [['intake', 'created', 'completed'], ['return', 'ready', 'cancelled'], ['return', 'completed', 'picking'], ['intake', 'cancelled', 'received']]) assert.throws(() => assertTransition(...args as [string,string,string]), DomainError)
})
test('anonymous and disabled accounts cannot read; clients are always constrained to their owner ID', async () => {
  const args = (user: unknown) => ({ req: { user } as PayloadRequest })
  assert.equal(await owned(args(null)), false)
  assert.equal(await owned(args({ id: 'a', role: 'client', active: false })), false)
  assert.deepEqual(await owned(args({ id: 'a', role: 'client', active: true })), { owner: { equals: 'a' } })
  assert.deepEqual(await self(args({ id: 'b', role: 'client' })), { id: { equals: 'b' } })
  assert.equal(await admin(args({ id: 'a', role: 'client' })), false)
  assert.equal(await staff(args({ id: 'a', role: 'warehouse' })), true)
  assert.equal(await admin(args({ id: 'a', role: 'admin', active: false })), false)
})
