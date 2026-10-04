import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { getPayload, createLocalReq, jwtSign, type Payload } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'
import config from '../src/payload.config'

const base = process.env.APP_URL || 'http://localhost:3000'
const suffix = randomUUID()
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=', 'base64')
async function session(payload: Payload, user: any) {
  const req = await createLocalReq({ user: { ...user, collection: 'users' } }, payload), cfg = payload.collections.users.config
  const { sid } = await addSessionToUser({ collectionConfig: cfg, payload, req, user: { ...user, collection: 'users' } })
  const { token } = await jwtSign({ fieldsToSign: { id:user.id, collection:'users', sid }, secret:payload.secret, tokenExpiration:3600 })
  return generatePayloadCookie({ collectionAuthConfig:cfg.auth, cookiePrefix:payload.config.cookiePrefix, token }).split(';')[0]
}
async function request(path: string, cookie: string, data?: unknown, key?: string, method = 'POST') {
  const response = await fetch(`${base}/api${path}`, { method:data === undefined ? 'GET' : method, headers:{ Origin:base, Cookie:cookie, 'Content-Type':'application/json', ...(key ? { 'Idempotency-Key':key } : {}) }, body:data === undefined ? undefined : JSON.stringify(data), signal:AbortSignal.timeout(20000) })
  return { status:response.status, data:await response.json() }
}
async function upload(cookie: string, owner: string, purpose: string) {
  const form = new FormData(); form.set('_payload', JSON.stringify({ owner, purpose })); form.set('file', new Blob([png], { type:'image/png' }), `integration-${suffix}-${purpose}.png`)
  const r = await fetch(`${base}/api/media`, { method:'POST', headers:{ Cookie:cookie, Origin:base }, body:form })
  const data = await r.json(); assert.equal(r.status, 201, `Upload ${purpose}: ${data.errors?.[0]?.message || data.message || ''}`)
  return data.doc.id as string
}
test('persistent intake, payments, media, four warehouse stages, ownership, capacity and support', { timeout:180000 }, async () => {
  const payload = await getPayload({ config })
  try {
    const admin = await payload.create({ collection:'users', overrideAccess:true, context:{ bootstrapAdmin:true }, data:{ email:`admin-${suffix}@test.invalid`, password:randomBytes(32).toString('hex'), role:'admin', active:true } })
    const adminReq = await createLocalReq({ user:{ ...admin, collection:'users' } }, payload)
    const warehouse = await payload.create({ collection:'users', req:adminReq, overrideAccess:true, data:{ email:`warehouse-${suffix}@test.invalid`, password:randomBytes(32).toString('hex'), role:'warehouse', active:true } })
    const client = await payload.create({ collection:'users', overrideAccess:true, context:{ otpRegistration:true }, data:{ email:`client-${suffix}@test.invalid`, password:randomBytes(32).toString('hex'), role:'client', active:true } })
    const other = await payload.create({ collection:'users', overrideAccess:true, context:{ otpRegistration:true }, data:{ email:`other-${suffix}@test.invalid`, password:randomBytes(32).toString('hex'), role:'client', active:true } })
    const [a, w, c, o] = await Promise.all([session(payload, admin), session(payload, warehouse), session(payload, client), session(payload, other)])
    const tariff = await payload.create({ collection:'tariffs', req:adminReq, overrideAccess:true, data:{ code:`test-${suffix}`, name:'Test box', kind:'storage', itemType:'box', testOnly:true, monthlyPrice:640, itemLimit:1, active:true } })
    const wh = await payload.create({ collection:'warehouses', overrideAccess:true, data:{ name:`Test ${suffix}`, active:true } })
    const cell = await payload.create({ collection:'cells', overrideAccess:true, data:{ name:`Test capacity ${suffix}`, warehouse:wh.id, barcode:`CELL-${suffix}`, capacity:1, active:true } })
    const orderData = { items:[{ tariffID:tariff.id, quantity:2, description:'Test inventory', price:1 }], fulfillment:'pickup', amount:1 }
    const requests = await Promise.all([request('/v1/intake',c,orderData,suffix), request('/v1/intake',c,orderData,suffix)])
    assert.deepEqual(requests.map(r => r.status), [200,200]); assert.equal(requests[0].data.order.id, requests[1].data.order.id)
    const order = requests[0].data.order, itemID = order.items[0].id, secondID = order.items[1].id
    assert.equal((await payload.count({ collection:'storage-items', where:{ owner:{ equals:client.id } }, overrideAccess:true })).totalDocs, 2, 'Retry does not create extra items')
    assert.equal((await request('/v1/intake',c,{ ...orderData, fulfillment:'courier', address:'changed' },suffix)).status,409,'Key cannot be reused with different payload')
    assert.equal((await request(`/v1/orders/${order.id}`,o)).status,404)
    assert.equal((await request(`/v1/orders/${order.id}/cancel`,o,{})).status,404)
    assert.equal((await request('/v1/warehouse',c)).status,403)
    assert.ok([403,404].includes((await request('/payments',w)).status),'Warehouse cannot read finance')
    assert.ok([403,404].includes((await request('/payload-jobs',c)).status),'Clients cannot read SMS jobs')
    const p = await request('/v1/payments',c,{ orderID:order.id, amount:1 }); assert.equal(p.status,200); assert.equal(p.data.payment.amount,1280)
    const paymentID = p.data.payment.id
    assert.equal((await request('/v1/payments',c,{ orderID:order.id })).data.payment.id,paymentID)
    assert.equal((await request(`/v1/payments/${paymentID}/simulate`,o,{ result:'paid' })).status,404)
    assert.equal((await request(`/v1/payments/${paymentID}/simulate`,c,{ result:'failed' })).data.payment.status,'failed')
    assert.equal((await request(`/v1/payments/${paymentID}/simulate`,c,{ result:'paid' })).data.payment.status,'paid')
    assert.equal((await request(`/v1/payments/${paymentID}/simulate`,c,{ result:'failed' })).data.payment.status,'paid','Late failure cannot overwrite paid')
    assert.equal((await request(`/v1/payments/${paymentID}/receipt`,c)).status,200)
    const intakeMedia = await upload(w,client.id,'intake')
    assert.ok([403,404].includes((await request(`/media/${intakeMedia}`,o)).status),'S3 metadata remains private')
    const receive = { itemID, barcode:`ITEM-${suffix}`, contents:'Books\nClothes', evidence:[intakeMedia] }
    assert.equal((await request(`/v1/warehouse/orders/${order.id}/receive`,w,receive)).status,400,'Box needs a seal')
    assert.equal((await request(`/v1/warehouse/orders/${order.id}/receive`,w,{ ...receive, seal:'TEST-SEAL' })).status,200)
    assert.equal((await request('/v1/warehouse/place',w,{ orderID:order.id,itemID,cellID:cell.id,barcode:receive.barcode,cellBarcode:cell.barcode })).status,409,'Whole intake must be received before placement')
    assert.equal((await request(`/v1/warehouse/orders/${order.id}/receive`,w,{ ...receive,itemID:secondID,barcode:`ITEM2-${suffix}`,seal:'TEST-SEAL2' })).status,200)
    assert.equal((await request(`/v1/orders/${order.id}`,c)).data.order.backendStatus,'received','All received items advance intake to placement')
    assert.equal((await request(`/storage-items/${itemID}`,w,{ status:'returned' },undefined,'PATCH')).status,403,'Native CRUD cannot bypass workflow')
    const placement = { orderID:order.id,itemID,cellID:cell.id,barcode:receive.barcode,cellBarcode:cell.barcode }
    assert.equal((await request('/v1/warehouse/place',w,{ ...placement,barcode:'wrong' })).status,400)
    const competing = await Promise.all([request('/v1/warehouse/place',w,placement),request('/v1/warehouse/place',w,{ ...placement,itemID:secondID,barcode:`ITEM2-${suffix}` })])
    assert.deepEqual(competing.map(r => r.status).sort(),[200,409],'Cell capacity holds under concurrent placement')
    const firstPlaced = competing[0].status === 200 ? itemID : secondID, lastID = firstPlaced === itemID ? secondID : itemID
    const nextCell = await payload.create({ collection:'cells', overrideAccess:true, data:{ name:`Spare ${suffix}`, warehouse:wh.id, barcode:`SPARE-${suffix}`, capacity:1, active:true } })
    assert.equal((await request('/v1/warehouse/place',w,{ ...placement,itemID:lastID,cellID:nextCell.id,cellBarcode:nextCell.barcode,barcode:lastID === itemID ? receive.barcode : `ITEM2-${suffix}` })).status,200)
    assert.equal((await request(`/v1/orders/${order.id}`,c)).data.order.backendStatus,'completed')
    const returns = await Promise.all([request('/v1/returns',c,{ itemIDs:[firstPlaced],fulfillment:'pickup' },`${suffix}-return1`),request('/v1/returns',c,{ itemIDs:[firstPlaced],fulfillment:'pickup' },`${suffix}-return2`)])
    assert.deepEqual(returns.map(r => r.status).sort(),[200,409],'An item cannot enter two concurrent returns')
    const back = returns.find(r => r.status === 200)!.data.order
    assert.equal((await request(`/v1/warehouse/orders/${back.id}/pick`,w,{ itemID:firstPlaced,barcode:'wrong' })).status,400)
    const correct = firstPlaced === itemID ? receive.barcode : `ITEM2-${suffix}`
    assert.equal((await request(`/v1/warehouse/orders/${back.id}/pick`,w,{ itemID:firstPlaced,barcode:correct })).status,200)
    assert.equal((await request(`/v1/orders/${back.id}/cancel`,c,{})).status,409,'Picked return cannot be cancelled')
    const photo = await upload(w,client.id,'return'), signature = await upload(w,client.id,'signature')
    assert.equal((await request(`/v1/warehouse/orders/${back.id}/complete`,w,{ signature:intakeMedia,evidence:[photo] })).status,400,'Signature purpose is checked')
    assert.equal((await request(`/v1/warehouse/orders/${back.id}/complete`,w,{ signature,evidence:[photo] })).status,200)
    const returned = await payload.findByID({ collection:'storage-items',id:firstPlaced,overrideAccess:true,depth:0 }); assert.equal(returned.status,'returned'); assert.equal(returned.cell,null)
    const report = await request(`/v1/orders/${back.id}/report`,c); assert.equal(report.status,200); assert.equal(report.data.materials.length,2)
    const attachment = await upload(c,other.id,'support')
    assert.equal((await payload.findByID({ collection:'media',id:attachment,overrideAccess:true,depth:0 })).owner,client.id,'Client upload cannot impersonate an owner')
    const ticket = await request('/v1/support',c,{ type:'incident',orderId:back.id,description:'Test support case',attachments:[attachment] }); assert.equal(ticket.status,200)
    const tid = ticket.data.ticketId
    assert.equal((await request(`/v1/support/${tid}/reply`,o,{ text:'forbidden' })).status,404)
    assert.equal((await request(`/v1/support/${tid}/reply`,w,{ text:'forbidden' })).status,403)
    assert.equal((await request(`/v1/support/${tid}/reply`,a,{ text:'Сотрудник отвечает клиенту' })).status,200)
    const dashboard = await request('/v1/dashboard',c); assert.equal(dashboard.status,200); assert.equal(dashboard.data.tickets.find((t:any) => t.id === tid).messages.length,2)
    assert.ok((await payload.count({ collection:'audit-log',overrideAccess:true,where:{ entityID:{ equals:back.id } } })).totalDocs > 0)
    const plan = await payload.create({ collection:'tariffs', overrideAccess:true, data:{ code:`plan-${suffix}`,name:'Test subscription',kind:'subscription',itemType:'box',testOnly:true,active:true,itemLimit:1,monthlyPrice:900 } })
    const planPayment = await request('/v1/payments',c,{ tariffID:plan.id },`${suffix}-plan`)
    assert.equal(planPayment.status,200)
    assert.equal((await request('/v1/payments',c,{ tariffID:plan.id },`${suffix}-plan`)).data.payment.id,planPayment.data.payment.id)
    assert.equal((await request(`/v1/payments/${planPayment.data.payment.id}/simulate`,c,{ result:'paid' })).status,200)
    assert.equal((await request('/v1/dashboard',c)).data.profile.planId,plan.id)
    assert.equal((await request('/v1/subscription/pause',c,{})).status,409,'Active inventory prevents pause')
    const emptyPlanPayment = await request('/v1/payments',o,{ tariffID:plan.id },`${suffix}-empty-plan`)
    assert.equal((await request(`/v1/payments/${emptyPlanPayment.data.payment.id}/simulate`,o,{ result:'paid' })).status,200)
    assert.equal((await request('/v1/subscription/pause',o,{})).status,200)
    assert.equal((await request('/v1/dashboard',o)).data.profile.subscriptionStatus,'paused')
    assert.equal((await request('/v1/payment-method/simulate',c,{})).status,200)
    assert.equal((await request('/v1/dashboard',c)).data.profile.paymentMethod.last4,'4242')
    const changedPhone = `+7999000${String(1000 + Math.floor(Math.random()*8000))}`
    const phoneChange = await request('/v1/profile/phone/request',o,{ phone:changedPhone })
    assert.equal(phoneChange.status,200)
    const phoneCode = phoneChange.data.simulationCode
    assert.equal((await request('/auth/verify-otp','',{ phone:changedPhone,code:phoneCode })).status,400,'A phone-change challenge cannot log in')
    assert.equal((await request('/v1/profile/phone/confirm',c,{ phone:changedPhone,code:phoneCode })).status,400,'A challenge is bound to its account')
    assert.equal((await request('/v1/profile/phone/confirm',o,{ phone:changedPhone,code:phoneCode })).status,200)
    assert.equal((await request('/me',o)).data.user.phone,changedPhone)
    assert.equal((await request('/v1/profile/phone/confirm',o,{ phone:changedPhone,code:phoneCode })).status,400,'Phone-change code cannot be replayed')
    assert.equal((await request('/v1/profile/phone/request',c,{ phone:changedPhone })).status,409)
    // Cancellation refunds a simulated payment once and releases the expected items.
    const cancelled = (await request('/v1/intake',c,{ ...orderData,items:[{ tariffID:tariff.id,quantity:1 }] },`${suffix}-cancel`)).data.order
    const cp = (await request('/v1/payments',c,{ orderID:cancelled.id })).data.payment
    await request(`/v1/payments/${cp.id}/simulate`,c,{ result:'paid' })
    assert.equal((await request(`/v1/orders/${cancelled.id}/cancel`,c,{})).status,200)
    assert.equal((await request(`/v1/orders/${cancelled.id}/cancel`,c,{})).status,200)
    assert.equal((await request(`/v1/payments/${cp.id}`,c)).data.payment.status,'refunded')
    assert.equal((await request(`/v1/payments/${cp.id}/simulate`,c,{ result:'paid' })).data.payment.status,'refunded')
  } finally { await payload.destroy() }
})
