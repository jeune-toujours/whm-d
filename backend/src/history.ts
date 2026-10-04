import type { PayloadRequest } from 'payload'
import { endpoint, json, clientUser } from './http'
import { relationID, DomainError, text } from './domain'
import { fingerprint, uuid } from './ordering'

export async function captureOrder(req: PayloadRequest, order: any) {
  const ids = (order.items || []).map(relationID)
  const items = await req.payload.find({ collection: 'storage-items', req, overrideAccess: true, depth: 0, limit: 50, where: { id: { in: ids } } })
  const previous = order.details as any
  const details = { ...(previous || {}), units: items.docs.map(i => ({ id: i.id, internalID: i.internalID, title: i.title, type: i.type, description: i.description || '', contents: i.contents || '', monthlyPrice: i.monthlyPrice, startedAt: i.startedAt, returnedAt: i.returnedAt, seal: i.seal || '', barcode: i.barcode || '' })), capturedAt: new Date().toISOString() }
  await req.payload.update({ collection: 'orders', req, id: order.id, overrideAccess: true, context: { workflow: true }, data: { details } })
}
export async function historyDTO(req: PayloadRequest, order: any) {
  const details = (order.details || {}) as any, allItems = (order.items || []).filter((i: any) => typeof i === 'object')
  const snapshot = Array.isArray(details.units) ? details.units : allItems
  const events = await req.payload.find({ collection: 'order-events', req, overrideAccess: false, depth: 0, limit: 1000, sort: 'createdAt', where: { order: { equals: order.id } } })
  const related = snapshot.length ? await req.payload.find({ collection: 'orders', req, overrideAccess: false, depth: 1, limit: 200, sort: '-closedAt', where: { and: [{ id: { not_equals: order.id } }, { items: { in: snapshot.map((i: any) => i.id) } }, { status: { equals: 'completed' } }] } }) : { docs: [] }
  const payment: any = typeof order.payment === 'object' ? order.payment : null, charged = payment && ['paid', 'refunded'].includes(payment.status), refund = payment?.status === 'refunded' ? payment.amount : 0
  const closed = order.closedAt || events.docs.find(e => ['completed', 'cancelled'].includes(e.status))?.createdAt || order.updatedAt
  const labels: Record<string, string> = { created: 'Заявка создана', received: 'Принято складом', placed: 'Размещено на хранение', picking: 'Сборка на складе', ready: order.fulfillment === 'courier' ? 'Подготовлено к доставке' : 'Готово к выдаче', completed: order.type === 'return' ? 'Вещи переданы клиенту — заказ завершён' : 'Заказ завершён', cancelled: 'Заказ отменён' }
  const items = snapshot.map((s: any) => {
    const current = allItems.find((i: any) => i.id === s.id), returned = related.docs.find((o: any) => o.type === 'return' && (o.items || []).some((i: any) => relationID(i) === s.id))
    return { ...s, storedSince: s.startedAt || null, returnedAt: s.returnedAt || current?.returnedAt || returned?.closedAt || '', currentStatus: order.status === 'cancelled' ? 'cancelled' : current?.status || 'unavailable', archived: current?.status === 'returned', returnOrderId: returned?.id, available: Boolean(current) }
  })
  const quoteServices = details.services || []
  return { id: order.id, number: order.number, type: order.type, subtype: details.subtype || 'partial', status: order.status, createdAt: order.createdAt, completedAt: closed, completedYear: new Date(closed).getFullYear(), completedTimestamp: new Date(closed).getTime(), method: order.fulfillment, methodLabel: order.fulfillment === 'courier' ? details.input?.service === 'turnkey' ? 'Под ключ, курьером' : 'Курьер' : 'Самостоятельно', address: details.logistics?.address || order.address || '', plannedAt: [details.logistics?.date, order.slot].filter(Boolean).join(' · '), actualAt: order.status === 'completed' ? closed : '', trips: details.trips || 1, storageAfter: details.futureMonthly ?? null, currentCount: items.filter((i: any) => ['stored', 'reserved', 'picked'].includes(i.currentStatus)).length, returnedCount: items.filter((i: any) => i.currentStatus === 'returned').length, cancellationReason: order.status === 'cancelled' ? 'Заявка отменена до передачи вещей' : '', items, services: quoteServices.map((s: any) => ({ ...s, status: order.status === 'cancelled' ? 'Отменена' : 'Заказана; выполнение отдельно не подтверждено', material: ['photos', 'inventory'].includes(s.id), document: false })), relatedOrderIds: related.docs.map(o => o.id), relatedOrders: related.docs.map(o => ({ id: o.id, number: o.number, type: o.type, count: o.items?.length || 0, completedAt: o.closedAt })), financial: { storage: charged && order.type === 'intake' ? details.monthly ?? payment.amount : 0, delivery: charged ? details.deliveryPrice || 0 : 0, materials: charged ? quoteServices.find((s: any) => s.id === 'materials')?.price || 0 : 0, services: charged ? quoteServices.filter((s: any) => !['materials', 'insurance'].includes(s.id)).map((s: any) => ({ title: s.title, amount: s.price })) : [], discount: 0, refund, paid: charged ? payment.amount - refund : 0, receiptAvailable: false, simulationReceipt: charged, paymentID: payment?.id, paymentStatus: payment?.status || 'not_required', periods: [] }, timeline: events.docs.filter(e => labels[e.status]).map(e => ({ label: labels[e.status], date: e.createdAt })), snapshotAvailable: details.version === 2 && !details.legacySnapshot, simulation: true }
}
export const historyEndpoints = [
  endpoint('/v1/history', 'get', async req => {
    clientUser(req)
    const query = new URL(req.url || 'http://localhost').searchParams, type = query.get('type'), status = query.get('status'), method = query.get('method'), period = query.get('period'), search = text(query.get('search'), 100), oldest = query.get('sort') === 'oldest'
    const filters: any[] = [{ status: { in: ['completed', 'cancelled'] } }]
    if (['intake', 'return'].includes(type || '')) filters.push({ type: { equals: type } })
    if (['completed', 'cancelled'].includes(status || '')) filters.push({ status: { equals: status } })
    if (['pickup', 'courier'].includes(method || '')) filters.push({ fulfillment: { equals: method } })
    if (/^\d{4}$/.test(period || '')) filters.push({ closedAt: { greater_than_equal: `${period}-01-01T00:00:00Z`, less_than: `${Number(period) + 1}-01-01T00:00:00Z` } })
    if (query.get('services') === 'true') filters.push({ hasServices: { equals: true } })
    if (search) filters.push({ or: [{ number: { contains: search } }, { historySearch: { contains: search } }] })
    const filterHash = fingerprint({ type, status, method, period, search, oldest, services: query.get('services') }), cursor = query.get('cursor')
    if (cursor) {
      let value: any; try { value = JSON.parse(Buffer.from(cursor, 'base64url').toString()) } catch { throw new DomainError(400, 'INVALID_CURSOR', 'Повторите загрузку истории.') }
      if (value.filterHash !== filterHash || !Number.isFinite(Date.parse(value.at))) throw new DomainError(400, 'INVALID_CURSOR', 'Сбросьте страницу при смене фильтров.')
      const comparator = oldest ? 'greater_than' : 'less_than'
      filters.push({ or: [{ closedAt: { [comparator]: value.at } }, { and: [{ closedAt: { equals: value.at } }, { id: { [comparator]: uuid(value.id) } }] }] })
    }
    const result = await req.payload.find({ collection: 'orders', req, overrideAccess: false, depth: 1, pagination: false, limit: 21, sort: oldest ? 'closedAt,id' : '-closedAt,-id', where: { and: filters } })
    const page = result.docs.slice(0, 20), last = page.at(-1), nextCursor = result.docs.length > 20 && last ? Buffer.from(JSON.stringify({ at: last.closedAt, id: last.id, filterHash })).toString('base64url') : null
    return json({ ok: true, orders: await Promise.all(page.map(o => historyDTO(req, o))), nextCursor })
  }),
  endpoint('/v1/history/:id', 'get', async req => {
    clientUser(req); const order = await req.payload.findByID({ collection: 'orders', req, id: uuid(req.routeParams?.id), overrideAccess: false, depth: 1 })
    if (!['completed', 'cancelled'].includes(order.status)) throw new DomainError(409, 'ACTIVE_ORDER', 'Активная заявка доступна на экране отслеживания.')
    return json({ ok: true, order: await historyDTO(req, order) })
  }),
]
