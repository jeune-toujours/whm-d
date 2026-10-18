import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const base = process.env.APP_URL || 'http://localhost:3000'
const cookieValue = (response: Response) => response.headers.getSetCookie().find(cookie => /^(payload|whm-client)-token=/.test(cookie))!.split(';')[0]
async function call(path: string, cookie = '', data?: unknown, client = false) {
  return fetch(`${base}/api${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json', ...(client ? { 'X-WHM-Client': '1' } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(20_000) })
}

test('staff and client login/refresh/logout coexist in one browser cookie jar with real database sessions', { timeout: 120_000 }, async () => {
  const payload = await getPayload({ config })
  try {
    const email = `session-${randomUUID()}@whm.invalid`, password = randomBytes(32).toString('hex')
    const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrapAdmin: true }, data: { email, password, role: 'admin', active: true } })
    const login = await call('/users/login', '', { email, password })
    assert.equal(login.status, 200)
    let staffCookie = cookieValue(login)
    assert.match(staffCookie, /^payload-token=/)
    const staffExp = (await login.json()).exp
    assert.ok(staffExp - Date.now() / 1000 > 6 * 24 * 3600, 'Staff lifetime remains seven days')

    const phone = '+7999000' + String(1000 + Math.floor(Math.random() * 8000))
    const issued = await call('/auth/request-otp', staffCookie, { phone })
    assert.equal(issued.status, 200)
    const code = (await issued.json()).simulationCode
    const verified = await call('/auth/verify-otp', staffCookie, { phone, code })
    assert.equal(verified.status, 200)
    let clientCookie = cookieValue(verified)
    assert.match(clientCookie, /^whm-client-token=/)
    assert.match(verified.headers.get('set-cookie')!, /HttpOnly/)
    assert.match(verified.headers.get('set-cookie')!, /SameSite=Lax/)
    const jar = () => `${staffCookie}; ${clientCookie}`
    const clientID = (await (await call('/me', jar())).json()).user.id
    assert.notEqual(clientID, admin.id)
    assert.equal((await (await call('/users/me', jar())).json()).user.id, admin.id)
    assert.equal((await (await call('/v1/dashboard', jar(), undefined, true)).json()).userID, clientID)
    assert.equal((await call('/me', staffCookie)).status, 401, 'No staff fallback when client is absent')
    const untrusted = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Origin: 'https://attacker.invalid', Cookie: jar(), 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(untrusted.status, 403, 'Cookie separation does not weaken CSRF')

    const clientRefresh = await call('/users/refresh-token', jar(), {}, true)
    assert.equal(clientRefresh.status, 200)
    clientCookie = cookieValue(clientRefresh)
    assert.match(clientCookie, /^whm-client-token=/)
    const staffRefresh = await call('/users/refresh-token', jar(), {})
    assert.equal(staffRefresh.status, 200)
    staffCookie = cookieValue(staffRefresh)
    assert.match(staffCookie, /^payload-token=/)
    assert.equal((await (await call('/users/me', jar())).json()).user.id, admin.id)
    assert.equal((await (await call('/me', jar())).json()).user.id, clientID)

    assert.equal((await call('/users/logout', jar(), {})).status, 200)
    assert.equal((await (await call('/users/me', jar())).json()).user, null)
    assert.equal((await (await call('/me', jar())).json()).user.id, clientID, 'Staff logout does not revoke client SID')
    const relogin = await call('/users/login', jar(), { email, password })
    assert.equal(relogin.status, 200); staffCookie = cookieValue(relogin)
    const logout = await call('/auth/logout', jar(), {})
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie')!, /^whm-client-token=;/)
    assert.equal((await call('/me', jar())).status, 401, 'Old client JWT SID is actually revoked')
    assert.equal((await (await call('/users/me', jar())).json()).user.id, admin.id, 'Client logout leaves employee signed in')
  } finally { await payload.destroy() }
})
