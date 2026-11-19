import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { getPayload, createLocalReq, jwtSign, type Payload } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'
import config from '../src/payload.config'
const base = process.env.APP_URL || 'http://localhost:3000'
async function session(payload: Payload, user: any) {
  const identity = { ...user, collection: 'users' }, req = await createLocalReq({ user: identity }, payload), cfg = payload.collections.users.config
  const { sid } = await addSessionToUser({ collectionConfig: cfg, payload, req, user: identity })
  const { token } = await jwtSign({ fieldsToSign: { id: user.id, collection: 'users', sid }, secret: payload.secret, tokenExpiration: 3600 })
  return generatePayloadCookie({ collectionAuthConfig: cfg.auth, cookiePrefix: user.role === 'client' ? 'whm-client' : payload.config.cookiePrefix, token }).split(';')[0]
}
async function call(path: string, cookie: string, data?: unknown, key = randomUUID(), method = 'POST') {
  const response = await fetch(`${base}/api${path}`, { method: data === undefined ? 'GET' : method, headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(cookie.startsWith('whm-client-token=') ? { 'X-WHM-Client': '1' } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(20000) })
  return { status: response.status, data: await response.json() }
}

test('damage at intake: atomic record, client notification, evidence, ownership, concurrent retry, immutable history and unchanged stock', { timeout: 180000 }, async () => {
  const payload = await getPayload({ config }), suffix = randomUUID()
  try {
    const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrapAdmin: true }, data: { email: `problem-admin-${suffix}@test.invalid`, password: randomBytes(32).toString('hex'), role: 'admin', active: true } })
    const req = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
    const people = []
    for (const role of ['warehouse', 'manager', 'client', 'client'] as const) people.push(await payload.create({ collection: 'users', req, overrideAccess: true, data: { email: `problem-${people.length}-${suffix}@test.invalid`, firstName: role, password: randomBytes(32).toString('hex'), role, active: true } }))
    const [a, w, m, c, other] = await Promise.all([admin, ...people].map(user => session(payload, user)))
    const items = []
    for (const status of ['expected', 'received', 'stored', 'expected'] as const) items.push(await payload.create({ collection: 'storage-items', overrideAccess: true, data: { owner: people[2].id, title: `Damage ${status}`, internalID: `DMG-${items.length}-${suffix}`, type: 'box', status, monthlyPrice: 10 } }))
    const order = await payload.create({ collection: 'orders', overrideAccess: true, data: { owner: people[2].id, number: `DMG-ORDER-${suffix}`, type: 'intake', status: 'created', fulfillment: 'pickup', items: items.slice(0, 3).map(i => i.id), idempotencyKey: suffix } })
    const input = { orderID: order.id, itemID: items[0].id, description: 'Угол коробки повреждён при поступлении', discoveredAtIntake: true, evidence: [] as string[] }, key = randomUUID()
    for (const path of ['/v1/problems', '/v1/problems/context', '/damage-reports']) assert.equal((await call(path, c)).status, 403)
    assert.equal((await call('/v1/problems', c, input)).status, 403)
    assert.equal((await call('/v1/problems', w, { ...input, discoveredAtIntake: false })).status, 400)
    assert.equal((await call('/v1/problems', w, { ...input, description: ' ' })).status, 400)
    assert.equal((await call('/v1/problems', w, { ...input, itemID: items[3].id })).data.code, 'INTAKE_REQUIRED')
    assert.equal((await call('/v1/problems', w, { ...input, itemID: items[2].id })).status, 409, 'Stored item is outside intake')
    const before = await payload.findByID({ collection: 'storage-items', id: items[0].id, depth: 0, overrideAccess: true })
    const results = await Promise.all([call('/v1/problems', w, input, key), call('/v1/problems', w, input, key)])
    assert.deepEqual(results.map(r => r.status), [200, 200], JSON.stringify(results.map(r => r.data)))
    const report = results[0].data.report, id = report.id
    assert.equal(results[1].data.report.id, id)
    assert.equal(report.description, input.description); assert.equal(report.createdByName, 'warehouse')
    assert.equal((await call('/v1/problems', w, { ...input, description: 'Другое описание' }, key)).status, 409)
    assert.equal((await call('/v1/problems', m, input)).data.code, 'REPORT_EXISTS')
    assert.equal((await payload.count({ collection: 'damage-reports', overrideAccess: true, where: { order: { equals: order.id } } })).totalDocs, 1)
    assert.equal((await payload.count({ collection: 'support-messages', overrideAccess: true, where: { ticket: { equals: report.ticketID } } })).totalDocs, 1, 'Retry sends one in-app notification')
    assert.equal((await payload.count({ collection: 'order-events', overrideAccess: true, where: { order: { equals: order.id } } })).totalDocs, 1)
    const tracking = (await call(`/v1/orders/${order.id}`, c)).data.order
    assert.equal(tracking.history.length, 0, 'Damage is an event, not a new order stage')
    assert.equal(tracking.events[0].status, 'damage_found'); assert.match(tracking.events[0].note, /DMG-/)
    assert.deepEqual(await payload.findByID({ collection: 'storage-items', id: items[0].id, depth: 0, overrideAccess: true }), before, 'Recording does not change stock, tariff, owner or status')
    assert.ok((await payload.count({ collection: 'audit-log', overrideAccess: true, where: { entityID: { equals: id } } })).totalDocs)
    for (const cookie of [a, w, m]) {
      assert.equal((await call(`/v1/problems/${id}`, cookie)).status, 200)
      assert.equal((await call(`/damage-reports/${id}`, cookie, { description: 'overwritten' }, undefined, 'PATCH')).status, 403)
      assert.equal((await call(`/damage-reports/${id}`, cookie, {}, undefined, 'DELETE')).status, 403)
      assert.equal((await call('/damage-reports', cookie, {})).status, 403)
    }
    assert.equal((await call(`/v1/problems/${id}`, c)).status, 403)
    assert.equal((await call(`/v1/items/${items[0].id}/problems`, other)).status, 404)
    const clientHistory = await call(`/v1/items/${items[0].id}/problems`, c)
    assert.equal(clientHistory.status, 200); assert.equal(clientHistory.data.reports[0].description, input.description)
    assert.equal(clientHistory.data.reports[0].createdByName, undefined, 'Staff details not exposed')
    const dashboard = (await call('/v1/dashboard', c)).data
    const ticket = dashboard.tickets.find((t: any) => t.id === report.ticketID)
    assert.equal(ticket.relatedItemId, items[0].id); assert.equal(ticket.relatedOrderId, order.id)
    assert.match(ticket.messages[0].text, /повреждение/)
    assert.ok([403, 404].includes((await call(`/support-tickets/${report.ticketID}`, other)).status))
    assert.equal((await call(`/v1/problems?search=${encodeURIComponent(order.number)}`, m)).data.total, 1)
    // An attachment may only come from this customer's intake process.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=', 'base64')
    const upload = async (owner: string, purpose: string) => {
      const form = new FormData(); form.set('_payload', JSON.stringify({ owner, purpose })); form.set('file', new Blob([png], { type: 'image/png' }), `damage-${randomUUID()}.png`)
      const response = await fetch(`${base}/api/media`, { method: 'POST', headers: { Cookie: w, Origin: base }, body: form })
      assert.equal(response.status, 201); return (await response.json()).doc.id as string
    }
    const alien = await upload(people[3].id, 'intake'), wrongPurpose = await upload(people[2].id, 'return'), correct = await upload(people[2].id, 'intake')
    for (const evidence of [[alien], [wrongPurpose], [correct, correct]]) assert.equal((await call('/v1/problems', w, { ...input, itemID: items[1].id, evidence })).status, 400)
    const withFile = await call('/v1/problems', w, { ...input, itemID: items[1].id, evidence: [correct] })
    assert.equal(withFile.status, 200); assert.equal(withFile.data.report.evidence[0].id, correct)
    const media = await call(`/media/${correct}`, c); assert.equal(media.status, 200)
    assert.equal((await payload.count({ collection: 'damage-reports', overrideAccess: true, where: { order: { equals: order.id } } })).totalDocs, 2)
  } finally { await payload.destroy() }
})
