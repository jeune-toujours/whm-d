import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { getPayload, jwtSign, createLocalReq } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'
import config from '../src/payload.config'

const base = process.env.APP_URL || 'http://localhost:3000'
const phone = process.env.STAGING_TEST_PHONE!
const code = process.env.STAGING_TEST_OTP!
async function call(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  return fetch(`${base}/api${path}`, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', Origin: options.origin || base, ...(options.cookie ? { Cookie: options.cookie } : {}) }, body: options.body !== undefined ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(15_000) })
}
test('real OTP, sessions, ownership, native CRUD guards and logout against migrated PostgreSQL', { timeout: 120_000 }, async () => {
  const payload = await getPayload({ config })
  try {
    assert.equal((await call('/v1/items')).status, 401)
    assert.equal((await call('/users/register-first-user', { method: 'POST', body: { email: 'attacker@example.invalid', role: 'admin', password: 'not-a-real-secret' } })).status, 403, 'First-user endpoint cannot bypass admin provisioning')
    assert.equal((await call('/auth/request-otp', { method: 'POST', body: { phone }, origin: 'https://attacker.invalid' })).status, 403)
    assert.equal((await call('/auth/request-otp', { method: 'POST', body: { phone } })).status, 200)
    assert.equal((await call('/auth/request-otp', { method: 'POST', body: { phone } })).status, 429)
    assert.equal((await call('/auth/verify-otp', { method: 'POST', body: { phone, code: code === '000000' ? '999999' : '000000' } })).status, 400)
    const verification = await call('/auth/verify-otp', { method: 'POST', body: { phone, code } })
    assert.equal(verification.status, 200)
    const setCookie = verification.headers.get('set-cookie')!
    assert.match(setCookie, /HttpOnly/i)
    const cookie = setCookie.split(';')[0]
    const identity = await (await call('/me', { cookie })).json()
    assert.equal(identity.user.phone, phone)
    const owner = identity.user.id
    assert.equal((await call('/auth/verify-otp', { method: 'POST', body: { phone, code } })).status, 400, 'OTP cannot be replayed')
    assert.equal((await call('/users', { method: 'POST', cookie, body: { email: 'attacker@example.invalid', role: 'admin', password: 'not-a-real-secret' } })).status, 403)
    assert.equal((await call('/orders', { method: 'POST', cookie, body: { owner } })).status, 403)
    await call(`/users/${owner}`, { method: 'PATCH', cookie, body: { role: 'admin', active: false } })
    const unchanged = await payload.findByID({ collection: 'users', id: owner, overrideAccess: true })
    assert.equal(unchanged.role, 'client')
    assert.equal(unchanged.active, true)
    const other = await payload.create({ collection: 'users', overrideAccess: true, context: { otpRegistration: true }, data: { email: `${randomUUID()}@client.whm.invalid`, password: randomBytes(40).toString('hex'), role: 'client', active: true } })
    const item = await payload.create({ collection: 'storage-items', overrideAccess: true, data: { owner: other.id, internalID: `TEST-${randomUUID()}`, title: 'Private item', type: 'box', status: 'stored', monthlyPrice: 0 } })
    const list = await (await call('/v1/items', { cookie })).json()
    assert.ok(!list.docs.some((doc: { id: string }) => doc.id === item.id), 'Client cannot list another client item')
    assert.ok([403, 404].includes((await call(`/storage-items/${item.id}`, { cookie })).status), 'Native Payload API also enforces ownership')
    assert.equal((await call('/v1/profile', { method: 'PATCH', cookie, body: { firstName: 'Тест', lastName: 'Клиент', email: 'test@example.invalid' } })).status, 200)
    assert.equal((await (await call('/me', { cookie })).json()).user.firstName, 'Тест')
    assert.equal((await call('/auth/logout', { method: 'POST', cookie })).status, 200)
    assert.equal((await call('/me', { cookie })).status, 401, 'Logout revokes server session, not just cookie')
    const before = await payload.find({ collection: 'otp-challenges', overrideAccess: true, sort: '-createdAt', limit: 1 })
    assert.equal(before.docs[0].attempts, 1, 'Failed OTP attempt survives the transaction')
    // Disabled accounts cannot keep using an existing Payload session.
    const req = await createLocalReq({ user: { ...other, collection: 'users' } }, payload)
    const collectionConfig = payload.collections.users.config
    const { sid } = await addSessionToUser({ collectionConfig, payload, req, user: { ...other, collection: 'users' } })
    const { token } = await jwtSign({ fieldsToSign: { id: other.id, collection: 'users', sid }, secret: payload.secret, tokenExpiration: 60 })
    const disabledCookie = generatePayloadCookie({ collectionAuthConfig: collectionConfig.auth, cookiePrefix: payload.config.cookiePrefix, token }).split(';')[0]
    await payload.update({ collection: 'users', id: other.id, data: { active: false }, overrideAccess: true })
    assert.equal((await call('/v1/items', { cookie: disabledCookie })).status, 401)
  } finally { await payload.destroy() }
})
