import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAuthContext } from '../src/auth-context'

const settings = Promise.resolve({ cookiePrefix: 'payload', routes: { api: '/api' } })
const args = { params: Promise.resolve({ slug: ['me'] }) }
// Next's production runtime proxies Request. It remains instanceof Request,
// but does not own Node's private Request slots: copying it directly throws.
const nextRequestProxy = (request: Request) => new Proxy(request, {
  get(target, key) { const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value },
})

test('same-origin client requests cannot consume or overwrite the employee cookie', async () => {
  let received: Request | undefined
  const handler = withAuthContext(async request => {
    received = request
    assert.deepEqual(await request.json(), { action: 'refresh' })
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    headers.append('Set-Cookie', 'payload-token=refreshed-client; Path=/; HttpOnly; Secure; SameSite=Lax')
    headers.append('Set-Cookie', 'other=value; Path=/')
    return new Response('{"ok":true}', { headers })
  }, settings)
  const response = await handler(nextRequestProxy(new Request('https://whm.test/api/users/refresh-token', {
    method: 'POST', headers: { Cookie: 'payload-token=staff; whm-client-token=client; theme=dark', 'X-WHM-Client': '1', Origin: 'https://whm.test', 'Content-Type': 'application/json' }, body: '{"action":"refresh"}',
  })), args)
  assert.equal(received!.headers.get('cookie'), 'theme=dark; payload-token=client')
  assert.equal(received!.headers.get('origin'), 'https://whm.test')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(response.headers.getSetCookie(), ['whm-client-token=refreshed-client; Path=/; HttpOnly; Secure; SameSite=Lax', 'other=value; Path=/'])
  assert.deepEqual(await response.json(), { ok: true })
})

test('missing client cookie never falls back to staff; OTP/logout are isolated even without a client header', async () => {
  for (const path of ['/api/me', '/api/auth/verify-otp', '/api/auth/logout', '/api/v1/payments/id/receipt?whm-client=1']) {
    const handler = withAuthContext(async request => {
      assert.equal(request.headers.get('cookie'), '')
      return new Response(null, { status: 401, headers: { 'Set-Cookie': 'payload-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly' } })
    }, settings)
    const result = await handler(new Request(`https://whm.test${path}`, { headers: { Cookie: 'payload-token=staff' } }), args)
    assert.equal(result.status, 401)
    assert.match(result.headers.get('set-cookie')!, /^whm-client-token=;/)
  }
})

test('native Admin login, refresh and logout retain the employee cookie and original request', async () => {
  const request = new Request('https://whm.test/api/users/refresh-token', { method: 'POST', headers: { Cookie: 'payload-token=staff; whm-client-token=client' } })
  const response = new Response('staff', { headers: { 'Set-Cookie': 'payload-token=staff-refreshed; Path=/; HttpOnly' } })
  const handler = withAuthContext(async incoming => { assert.equal(incoming, request); return response }, settings)
  assert.equal(await handler(request, args), response)
})
