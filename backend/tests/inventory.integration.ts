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
test('manual three-cell inventory: roles, concurrency, immutable snapshot, progress, audit and no stock changes', { timeout: 180000 }, async () => {
  const payload = await getPayload({ config }), suffix = randomUUID()
  try {
    const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrapAdmin: true }, data: { email: `inv-admin-${suffix}@test.invalid`, password: randomBytes(32).toString('hex'), role: 'admin', active: true } })
    const adminReq = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
    const people = []
    for (const role of ['manager', 'warehouse', 'client'] as const) people.push(await payload.create({ collection: 'users', req: adminReq, overrideAccess: true, data: { email: `inv-${role}-${suffix}@test.invalid`, firstName: role, password: randomBytes(32).toString('hex'), role, active: true } }))
    const [a, m, w, c] = await Promise.all([admin, ...people].map(user => session(payload, user)))
    const warehouse = await payload.create({ collection: 'warehouses', overrideAccess: true, data: { name: `Inventory ${suffix}`, active: true } })
    const cells = await Promise.all([0, 1, 2].map(i => payload.create({ collection: 'cells', overrideAccess: true, data: { name: `INV-${i}-${suffix}`, warehouse: warehouse.id, zone: 'INV', barcode: `INV-CELL-${i}-${suffix}`, capacity: 10, active: true } })))
    const items = await Promise.all([0, 1].map(i => payload.create({ collection: 'storage-items', overrideAccess: true, data: { owner: people[2].id, title: `Inventory item ${i}`, internalID: `INV-I-${i}-${suffix}`, barcode: `INV-B-${i}-${suffix}`, type: 'box', status: 'stored', cell: cells[i].id, monthlyPrice: 1 } })))
    const input = { cellIDs: cells.map(cell => cell.id) }, key = randomUUID()
    for (const path of ['/v1/inventory', '/v1/inventory/cells', '/inventory-sessions', '/inventory-session-cells']) assert.equal((await call(path, c)).status, 403, `Client denied ${path}`)
    assert.equal((await call('/v1/inventory', c, input)).status, 403)
    assert.equal((await call('/v1/inventory', w, input)).status, 403, 'Warehouse cannot launch')
    assert.equal((await call('/v1/inventory', a, { cellIDs: [] })).status, 400)
    assert.equal((await call('/v1/inventory', a, { cellIDs: [randomUUID()] })).status, 400)
    const repeated = await Promise.all([call('/v1/inventory', m, input, key), call('/v1/inventory', m, { cellIDs: [...input.cellIDs].reverse() }, key)])
    assert.deepEqual(repeated.map(r => r.status), [200, 200])
    const result = repeated[0].data, id = result.operation.id, path = `/v1/inventory/${id}`
    assert.equal(repeated[1].data.operation.id, id, 'Concurrent retries create one operation')
    assert.equal((await payload.count({ collection: 'inventory-sessions', overrideAccess: true, where: { initiator: { equals: people[0].id } } })).totalDocs, 1)
    assert.equal(result.operation.cellCount, 3); assert.equal(result.operation.checkedCount, 0); assert.equal(result.cells.length, 3)
    assert.equal(result.cells.reduce((n: number, row: any) => n + row.expectedItems.length, 0), 2)
    assert.equal((await call('/v1/inventory', m, { cellIDs: [cells[0].id] }, key)).status, 409)
    assert.equal((await call('/v1/inventory', a, input)).data.code, 'INVENTORY_CONFLICT')
    assert.equal((await call(path, c)).status, 403)
    const checks = cells.map(cell => result.cells.find((row: any) => row.cellID === cell.id))
    const checkPath = (i: number) => `${path}/cells/${checks[i].id}`
    assert.equal((await call(checkPath(0), c, { observedCodes: [items[0].barcode] })).status, 403)
    for (const collection of ['inventory-sessions', 'inventory-session-cells']) {
      const docID = collection === 'inventory-sessions' ? id : checks[0].id
      assert.equal((await call(`/${collection}`, a, {})).status, 403, 'Native create cannot bypass workflow')
      assert.equal((await call(`/${collection}/${docID}`, a, { status: 'completed' }, undefined, 'PATCH')).status, 403)
      assert.equal((await call(`/${collection}/${docID}`, a, {}, undefined, 'DELETE')).status, 403)
    }
    const catalog = (await call(`/v1/inventory/cells?search=${encodeURIComponent(suffix)}&warehouseID=${warehouse.id}&zone=INV`, w)).data
    assert.equal(catalog.cells.length, 3); assert.ok(catalog.cells.every((row: any) => row.inventoryID === id)); assert.equal(catalog.canCreate, false)
    // Ordinary accounting is allowed to move during the physical count. The
    // immutable launch snapshot must still contain the item in its old cell.
    await payload.update({ collection: 'storage-items', id: items[0].id, overrideAccess: true, context: { workflow: true }, data: { cell: cells[2].id } })
    const beforeItems = await Promise.all(items.map(item => payload.findByID({ collection: 'storage-items', id: item.id, depth: 0, overrideAccess: true })))
    const beforeCells = await Promise.all(cells.map(cell => payload.findByID({ collection: 'cells', id: cell.id, depth: 0, overrideAccess: true })))
    const beforeOrders = (await payload.count({ collection: 'orders', overrideAccess: true, where: { owner: { equals: people[2].id } } })).totalDocs
    assert.deepEqual((await call(path, m)).data.cells.find((row: any) => row.cellID === cells[0].id).expectedItems, checks[0].expectedItems)
    assert.equal((await call(checkPath(0), w, { observedCodes: [] })).data.code, 'COMMENT_REQUIRED')
    assert.equal((await call(path, m)).data.operation.checkedCount, 0, 'Rejected check leaves no partial state')
    const checkKey = randomUUID(), observed = { observedCodes: [items[0].barcode], comment: '' }
    const matched = await call(checkPath(0), w, observed, checkKey)
    assert.equal(matched.status, 200); assert.equal(matched.data.operation.checkedCount, 1)
    const stored = matched.data.cells.find((row: any) => row.id === checks[0].id)
    assert.equal(stored.status, 'matched'); assert.equal(stored.accountingChanged, true); assert.equal(stored.checkedByID, people[1].id)
    assert.equal((await call(checkPath(0), w, observed, checkKey)).data.cells.find((row: any) => row.id === checks[0].id).checkedAt, stored.checkedAt)
    assert.equal((await call(checkPath(0), w, { observedCodes: [] }, checkKey)).status, 409)
    assert.equal((await call(checkPath(0), a, observed)).status, 409, 'Another actor cannot overwrite the result')
    assert.equal((await call(checkPath(1), w, { observedCodes: [items[1].barcode] }, checkKey)).data.code, 'KEY_REUSED')
    assert.equal((await call('/v1/inventory', a, { cellIDs: [cells[0].id] })).status, 409, 'Checked cell stays active until whole inventory closes')
    const completed = await Promise.all([
      call(checkPath(1), w, { observedCodes: [], comment: 'Ожидаемая коробка отсутствует' }),
      call(checkPath(2), a, { observedCodes: [items[1].barcode, 'UNKNOWN-INVENTORY-EXTRA'], comment: 'Чужая коробка и неучтённый предмет' }),
    ])
    assert.deepEqual(completed.map(r => r.status), [200, 200], JSON.stringify(completed.map(r => r.data.code)))
    const closed = (await call(path, m)).data
    assert.equal(closed.operation.checkedCount, 3); assert.equal(closed.operation.discrepancyCount, 2); assert.equal(closed.operation.status, 'completed_with_discrepancies')
    assert.deepEqual(closed.cells.find((row: any) => row.id === checks[2].id).discrepancies.map((d: any) => d.type).sort(), ['extra', 'wrong_cell'])
    assert.deepEqual(await Promise.all(items.map(item => payload.findByID({ collection: 'storage-items', id: item.id, depth: 0, overrideAccess: true }))), beforeItems, 'Inventory does not alter stock, owners, status or dates')
    assert.deepEqual(await Promise.all(cells.map(cell => payload.findByID({ collection: 'cells', id: cell.id, depth: 0, overrideAccess: true }))), beforeCells)
    assert.equal((await payload.count({ collection: 'orders', overrideAccess: true, where: { owner: { equals: people[2].id } } })).totalDocs, beforeOrders)
    assert.ok((await payload.count({ collection: 'audit-log', overrideAccess: true, where: { entityID: { equals: id } } })).totalDocs >= 4, 'Launch and progress are audited')
    const active = await payload.count({ collection: 'inventory-session-cells', overrideAccess: true, where: { and: [{ session: { equals: id } }, { active: { equals: true } }] } })
    assert.equal(active.totalDocs, 0)
    const competing = await Promise.all([call('/v1/inventory', m, input), call('/v1/inventory', a, input)])
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409], 'Overlapping concurrent launches create only one operation')
    const next = competing.find(r => r.status === 200)!.data
    for (const row of next.cells) assert.equal((await call(`/v1/inventory/${next.operation.id}/cells/${row.id}`, w, { observedCodes: row.expectedItems.map((item: any) => item.barcode || item.internalID) })).status, 200)
    assert.equal((await call(`/v1/inventory/${next.operation.id}`, m)).data.operation.status, 'completed')
    assert.ok((await call('/v1/inventory?state=closed', m)).data.operations.some((row: any) => row.id === id))
  } finally { await payload.destroy() }
})
