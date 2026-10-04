import { randomUUID, createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { endpoint, body, json, clientUser, staffUser, transaction } from './http'
import { DomainError, text, relationID, assertTransition } from './domain'
import { hasRole } from './access'
import { checkoutConfiguration, quoteOrder, commitQuotedOrder, requestKey, fingerprint } from './ordering'
import { historyEndpoints, captureOrder } from './history'

const bad = (message: string) => new DomainError(400, 'INVALID_REQUEST', message)
const conflict = (message: string) => new DomainError(409, 'CONFLICT', message)
const required = (value: unknown, max = 200) => { const v = text(value, max); if (!v) throw bad('Заполните обязательные поля.'); return v }
const idOf = (value: unknown) => { const id = required(value, 40); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw bad('Неверный идентификатор.'); return id }
const idsOf = (value: unknown) => { if (!Array.isArray(value) || !value.length || value.length > 50) throw bad('Выберите от 1 до 50 вещей.'); const ids = value.map(idOf); if (new Set(ids).size !== ids.length) throw bad('Вещи не должны повторяться.'); return ids }
const terminal = (status: string) => ['completed', 'cancelled'].includes(status)
const wf = { workflow: true }
const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('ru-RU') : ''
export const labels: Record<string, string> = { created: 'Заявка создана', received: 'Принято на склад', placed: 'Размещено', picking: 'Идёт подбор', ready: 'Готово к выдаче', completed: 'Заказ завершён', cancelled: 'Отменён', expected: 'Ожидает приёмки', stored: 'На хранении', reserved: 'Заказан возврат', picked: 'Подобрано', returned: 'Возвращено' }
const stateMap: Record<string, string> = { created: 'created', received: 'storing', placed: 'storing', picking: 'assembling', ready: 'pickup_ready', completed: 'completed', cancelled: 'cancelled' }

export function itemDTO(item: any) {
  return { id: item.id, internalID: item.internalID, title: item.title, type: item.type, description: item.description || '', contents: (item.contents || '').split('\n').filter(Boolean), seal: item.seal || '—', barcode: item.barcode || '', status: item.status, statusLabel: labels[item.status], monthlyPrice: item.monthlyPrice, storedSince: dateLabel(item.startedAt), storedSinceLabel: dateLabel(item.startedAt), size: item.type === 'box' ? 'Коробка' : 'Отдельный предмет', media: (item.media || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ id: m.id, url: m.url, filename: m.filename, mimeType: m.mimeType })), ...(item.status !== 'stored' || item.blockReason ? { lockReason: item.blockReason || labels[item.status] || 'Недоступно для возврата' } : {}) }
}
export function orderDTO(order: any, events: any[] = []) {
  const items = (order.items || []).filter((i: any) => typeof i === 'object').map(itemDTO), details = (order.details || {}) as any
  const status = order.status === 'created' && order.type === 'intake' && order.fulfillment === 'pickup' ? 'warehouse_visit' : order.status === 'received' ? 'warehouse_received' : order.status === 'ready' && order.fulfillment === 'courier' ? 'delivery_ready' : stateMap[order.status] || 'created'
  const visibleEvents = events.filter(e => relationID(e.order) === order.id)
  const historyMap: Record<string, string> = { ...stateMap, received: 'warehouse_received', placed: 'storing', ready: order.fulfillment === 'courier' ? 'delivery_ready' : 'pickup_ready' }
  return { id: order.id, number: order.number, type: order.type === 'intake' ? 'storage' : 'return', fulfillment: order.fulfillment, status, backendStatus: order.status, statusLabel: status === 'delivery_ready' ? 'Готово к доставке' : labels[order.status], visitAt: details.logistics?.visitAt || null, visitWindow: order.slot || '', address: order.address || '', addressHint: [details.logistics?.apartment && 'Кв. ' + details.logistics.apartment, details.logistics?.entrance && 'Подъезд ' + details.logistics.entrance, details.logistics?.floor && 'Этаж ' + details.logistics.floor].filter(Boolean).join(', '), warehouse: details.logistics?.warehouse?.name || '', warehouseAddress: details.logistics?.warehouse?.address || '', workingHours: details.logistics?.warehouse?.hours || '', courier: { name: 'Не назначен', vehicle: '', plate: '' }, pickupInstructions: 'Передача согласовывается с сотрудником склада.', scheduleNotice: 'Тестовый слот; реальная доставка не назначена.', currentMonthlyStorage: details.currentMonthly ?? 0, futureMonthlyStorage: details.futureMonthly ?? 0, cancelReason: visibleEvents.find(e => e.status === 'cancelled')?.note || '', documentAvailable: false, cancelledFrom: null, events: visibleEvents.map(e => ({ status: e.status, label: labels[e.status] || e.status, at: e.createdAt, note: e.status === 'cancelled' ? e.note : '' })), history: visibleEvents.map(e => ({ status: historyMap[e.status] || 'created', at: e.createdAt })), items: items.map((i: any) => ({ ...i, name: i.title, note: i.description, icon: i.type === 'box' ? 'box' : 'bag', itemStatus: i.status, status: i.statusLabel })), createdAt: order.createdAt, updatedAt: order.updatedAt, paymentID: relationID(order.payment), paymentStatus: typeof order.payment === 'object' ? order.payment?.status : null, signature: relationID(order.signature), evidence: (order.evidence || []).map(relationID) }
}
const event = (req: PayloadRequest, order: any, status: string, note = '') => req.payload.create({ collection: 'order-events', req, overrideAccess: true, data: { owner: relationID(order.owner), order: order.id, status, actor: req.user!.id, note } })
async function orderByID(req: PayloadRequest, id: string, client = false) {
  const order = await req.payload.findByID({ collection: 'orders', id, req, overrideAccess: false, depth: 1 })
  if (client && relationID(order.owner) !== req.user!.id) throw new DomainError(404, 'NOT_FOUND', 'Заказ недоступен.')
  return order
}
async function replay(req: PayloadRequest, key: string, fingerprint: string) {
  const record = (await req.payload.find({ collection: 'orders', req, overrideAccess: true, depth: 1, limit: 1, where: { idempotencyKey: { equals: key } } })).docs[0]
  if (record && (relationID(record.owner) !== req.user!.id || record.requestHash !== fingerprint)) throw conflict('Этот ключ уже использован для другой заявки.')
  return record
}
const keyFor = (req: PayloadRequest) => `${req.user!.id}:${required(req.headers.get('idempotency-key'), 80)}`
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex')
function delivery(data: any) {
  if (!['pickup', 'courier'].includes(data.fulfillment)) throw bad('Выберите способ передачи.')
  const address = text(data.address, 500), slot = text(data.slot, 150)
  if (data.fulfillment === 'courier' && !address) throw bad('Укажите адрес.')
  return { fulfillment: data.fulfillment as 'pickup' | 'courier', address, slot }
}
async function ownedMedia(req: PayloadRequest, ids: string[], owner: string, purpose?: string) {
  for (const id of ids) {
    const media = await req.payload.findByID({ collection: 'media', req, id, overrideAccess: false, depth: 0 })
    if (relationID(media.owner) !== owner || (purpose && media.purpose !== purpose)) throw bad('Материал должен принадлежать клиенту и нужному процессу.')
  }
}

export const workflowEndpoints = [
  endpoint('/v1/dashboard', 'get', async req => {
    const user = clientUser(req)
    const [items, orders, events, tariffs, subscriptions, payments, tickets, messages, warehouses] = await Promise.all([
      req.payload.find({ collection: 'storage-items', req, overrideAccess: false, limit: 1000, depth: 1, sort: '-createdAt' }),
      req.payload.find({ collection: 'orders', req, overrideAccess: false, limit: 200, depth: 2, sort: '-createdAt' }),
      req.payload.find({ collection: 'order-events', req, overrideAccess: false, limit: 1000, depth: 0, sort: 'createdAt' }),
      req.payload.find({ collection: 'tariffs', req, overrideAccess: false, limit: 100, depth: 0, where: process.env.APP_ENV === 'staging' ? {} : { testOnly: { equals: false } } }),
      req.payload.find({ collection: 'subscriptions', req, overrideAccess: false, limit: 1, depth: 1, sort: '-createdAt' }),
      req.payload.find({ collection: 'payments', req, overrideAccess: false, limit: 100, depth: 0, sort: '-createdAt' }),
      req.payload.find({ collection: 'support-tickets', req, overrideAccess: false, limit: 100, depth: 1, sort: '-updatedAt' }),
      req.payload.find({ collection: 'support-messages', req, overrideAccess: false, limit: 1000, depth: 0, sort: 'createdAt' }),
      req.payload.find({ collection: 'warehouses', req, overrideAccess: true, limit: 20, depth: 0, where: { active: { equals: true } } }),
    ])
    const recentPayments = payments.docs.map(p => ({ id: p.id, date: dateLabel(p.createdAt), amount: p.amount, status: p.status, hasReceipt: Boolean(p.receiptURL), receiptURL: p.receiptURL }))
    const mapped = orders.docs.map(o => orderDTO(o, events.docs)), sub = subscriptions.docs[0], activeIDs = new Set(mapped.filter(o => !terminal(o.backendStatus)).flatMap(o => o.items.map((i: any) => i.id)))
    return json({ ok: true, staging: process.env.APP_ENV === 'staging', userID: user.id, units: items.docs.map(i => ({ ...itemDTO(i), ...(activeIDs.has(i.id) ? { lockReason: 'Вещь участвует в активной заявке' } : {}) })), homeUnits: items.docs.filter(i => i.status === 'stored' && !activeIDs.has(i.id)).map(itemDTO), orders: mapped, activeOrders: mapped.filter(o => !terminal(o.backendStatus)), profile: { firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '', email: user.contactEmail || '', planId: relationID(sub?.tariff), monthlyPrice: items.docs.filter(i => ['stored', 'reserved', 'picked'].includes(i.status)).reduce((n, i) => n + i.monthlyPrice, 0), subscriptionStatus: sub?.status || null, nextChargeDate: dateLabel(sub?.nextChargeAt), paymentMethod: user.paymentLast4 ? { brand: user.paymentBrand, last4: user.paymentLast4 } : null, recentPayments, hasStoredItems: items.docs.some(i => ['stored', 'reserved', 'picked'].includes(i.status)), hasActiveOrders: mapped.some(o => !terminal(o.backendStatus)) }, tariffs: tariffs.docs.map(t => ({ id: t.id, code: t.code, kind: t.kind, title: t.name, monthlyPrice: t.monthlyPrice, price: t.monthlyPrice, itemLimit: t.itemLimit, itemType: t.itemType || 'box', testOnly: t.testOnly, rules: t.rules })), warehouses: warehouses.docs.map(w => ({ id: w.id, name: w.name, address: w.address || '' })), tickets: tickets.docs.map(t => ({ id: t.id, type: t.type, attachments: (t.attachments || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ filename: m.filename, url: m.url })), shortDescription: t.subject, status: t.status, closeReason:t.closeReason || '', relatedItemId:relationID(t.item), updatedAt: dateLabel(t.updatedAt), relatedOrderId: relationID(t.order), messages: messages.docs.filter(m => relationID(m.ticket) === t.id).map(m => ({ author: m.authorRole, text: m.text, date: dateLabel(m.createdAt) })) })) })
  }),
  endpoint('/v1/checkout-config', 'get', async req => { clientUser(req); return json({ ok: true, config: await checkoutConfiguration(req) }) }),
  ...(['intake', 'return'] as const).map(kind => endpoint(kind === 'intake' ? '/v1/intake/quote' : '/v1/returns/quote', 'post', async req => { clientUser(req); return json({ ok: true, quote: await quoteOrder(req, kind, await body(req)) }) })),
  ...(['intake', 'return'] as const).map(kind => endpoint(kind === 'intake' ? '/v1/intake' : '/v1/returns', 'post', async req => {
    const user = clientUser(req), data = await body(req), key = requestKey(req), requestHash = fingerprint(data)
    if (data.consent !== true) throw bad('Подтвердите условия оформления.')
    const ids = kind === 'return' ? idsOf(data.itemIDs) : []
    return json(await transaction(req, [`client-orders:${user.id}`, `idempotency:${key}`, ...ids.map(i => `item:${i}`)], async () => {
      const existing = await replay(req, key, requestHash); if (existing) return { ok: true, order: orderDTO(existing) }
      const quote = await quoteOrder(req, kind, data)
      if (data.quoteHash && data.quoteHash !== quote.hash) throw conflict('Расчёт изменился. Проверьте сумму ещё раз.')
      if (kind === 'return' && quote.amount > 0) throw conflict('Сначала оплатите обратную доставку через checkout.')
      const order = await commitQuotedOrder(req, quote, key, requestHash)
      return { ok: true, order: orderDTO(order) }
    }))
  })),
  ...historyEndpoints,
  endpoint('/v1/orders/:id', 'get', async req => {
    clientUser(req); const id = idOf(req.routeParams?.id), order = await orderByID(req, id, true)
    const events = await req.payload.find({ collection: 'order-events', req, overrideAccess: false, limit: 100, depth: 0, sort: 'createdAt', where: { order: { equals: id } } })
    return json({ ok: true, order: orderDTO(order, events.docs) })
  }),
  endpoint('/v1/orders/:id/cancel', 'post', async req => {
    const user = clientUser(req), id = idOf(req.routeParams?.id)
    const initial = await orderByID(req, id, true), ids = (initial.items || []).map(relationID)
    return json(await transaction(req, [`client-orders:${user.id}`, `payment-owner:${user.id}`, `order:${id}`, ...ids.map(i => `item:${i}`)], async () => {
      const order = await orderByID(req, id, true)
      if (order.status === 'cancelled') return { ok: true }
      const details = order.details as any
      if (order.type !== 'intake' || order.fulfillment !== 'courier' || order.status !== 'created' || !details?.logistics?.visitAt || new Date(details.logistics.visitAt).getTime() - Date.now() < 2 * 3600_000) throw conflict('Отмена доступна только для курьерской сдачи не позднее чем за 2 часа до визита. Для других изменений обратитесь в поддержку.')
      assertTransition(order.type, order.status, 'cancelled')
      for (const itemID of ids) await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { status: order.type === 'intake' ? 'returned' : 'stored' } })
      if (order.payment) {
        const payment = await req.payload.findByID({ collection: 'payments', id: relationID(order.payment), req, overrideAccess: true, depth: 0 })
        if (payment.provider === 'simulation') {
          await req.payload.update({ collection: 'payments', id: payment.id, req, overrideAccess: true, data: { status: payment.status === 'paid' ? 'refunded' : 'failed' } })
          await req.payload.create({ collection: 'integration-events', req, overrideAccess: true, data: { key: `cancel-payment:${payment.id}`, provider: 'simulation-payment', status: 'completed', entityID: payment.id } })
        }
      }
      await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { status: 'cancelled', closedAt: new Date().toISOString() } }); await event(req, order, 'cancelled', 'Отменено клиентом')
      return { ok: true }
    }))
  }),
  endpoint('/v1/orders/:id/report', 'get', async req => {
    clientUser(req); const id = idOf(req.routeParams?.id), order = await orderByID(req, id, true)
    const events = (await req.payload.find({ collection: 'order-events', req, overrideAccess: false, depth: 0, sort: 'createdAt', limit: 1000, where: { order: { equals: id } } })).docs
    const mediaIDs = [...(order.evidence || []).map(relationID), relationID(order.signature)].filter(Boolean)
    const materials = await Promise.all(mediaIDs.map(mediaID => req.payload.findByID({ collection: 'media', id: mediaID, req, overrideAccess: false, depth: 0 })))
    return json({ document: 'Отчёт о тестовой операции. Не является юридическим актом.', order: orderDTO(order, events), materials: materials.map(m => ({ purpose: m.purpose, filename: m.filename, url: m.url })) }, 200, { 'Content-Disposition': `attachment; filename="order-${order.number}.json"` })
  }),
  endpoint('/v1/support', 'post', async req => {
    const user = clientUser(req), data = await body(req), message = required(data.description, 5000), key = requestKey(req), requestHash = fingerprint(data)
    if (!['incident', 'technical'].includes(data.type)) throw bad('Выберите тип обращения.')
    const order = data.orderId ? await orderByID(req, idOf(data.orderId), true) : undefined
    const item = data.unitId ? await req.payload.findByID({ collection: 'storage-items', id: idOf(data.unitId), req, overrideAccess: false }) : undefined
    if (item && relationID(item.owner) !== user.id) throw bad('Вещь недоступна.')
    const attachments = Array.isArray(data.attachments) && data.attachments.length ? idsOf(data.attachments) : []
    if (attachments.length > 5) throw bad('Максимум пять вложений.')
    await ownedMedia(req, attachments, user.id, 'support')
    for (const attachment of attachments) {
      const media = await req.payload.findByID({ collection: 'media', req, id: attachment, overrideAccess: false, depth: 0 })
      if ((media.supportType || 'incident') !== data.type) throw bad('Вложение должно относиться к выбранному каналу обращения.')
    }
    return json(await transaction(req, [`support:${user.id}`], async () => {
      const existing = (await req.payload.find({ collection: 'support-tickets', req, overrideAccess: true, limit: 1, where: { idempotencyKey: { equals: key } } })).docs[0]
      if (existing) { if ((existing.details as any)?.requestHash !== requestHash || relationID(existing.owner) !== user.id) throw conflict('Ключ относится к другому обращению.'); return { ok: true, ticketId: existing.id } }
      const ticket = await req.payload.create({ collection: 'support-tickets', req, overrideAccess: true, data: { owner: user.id, type: data.type, subject: message.slice(0, 100), status: 'submitted', order: order?.id, item: item?.id, attachments, idempotencyKey: key, details: { requestHash, route: data.type === 'technical' ? 'developer-email' : 'backoffice', section: text(data.section, 100), appVersion: text(data.appVersion, 100), platform: text(data.platform, 200) } } })
      await req.payload.create({ collection: 'support-messages', req, overrideAccess: true, data: { owner: user.id, ticket: ticket.id, author: user.id, authorRole: 'client', text: message } })
      if (data.type === 'technical') await req.payload.jobs.queue({ task: 'developer-email', input: { ticketID: ticket.id }, req })
      return { ok: true, ticketId: ticket.id, expectedResponse: data.type === 'technical' ? 'Обращение направлено в тестовый inbox разработчика. Реальное email не отправляется.' : 'Инцидент принят. Срок ответа ещё не установлен.' }
    }))
  }),
  endpoint('/v1/support/:id/reply', 'post', async req => {
    const user = req.user; if (!user || user.active === false || !['client', 'manager', 'admin'].includes(user.role)) throw new DomainError(403, 'FORBIDDEN', 'Недостаточно прав.')
    const id = idOf(req.routeParams?.id), data = await body(req), message = required(data.text, 5000), key = requestKey(req)
    return json(await transaction(req, [`ticket:${id}`], async () => {
      const ticket = await req.payload.findByID({ collection: 'support-tickets', id, req, overrideAccess: false })
      if (user.role !== 'client' && ticket.type === 'technical') throw new DomainError(403, 'DEVELOPER_CHANNEL', 'Техническое обращение обрабатывается через канал разработчика.')
      const previous = (await req.payload.find({ collection: 'support-messages', req, overrideAccess: true, depth: 0, limit: 1, where: { idempotencyKey: { equals: key } } })).docs[0]
      if (previous) { if (relationID(previous.ticket) !== id || previous.text !== message || relationID(previous.author) !== user.id) throw conflict('Ключ относится к другому сообщению.'); return { ok: true } }
      if (['resolved', 'rejected'].includes(ticket.status)) throw conflict('Обращение закрыто.')
      const reply = await req.payload.create({ collection: 'support-messages', req, overrideAccess: true, data: { owner: relationID(ticket.owner), ticket: id, author: user.id, authorRole: user.role === 'client' ? 'client' : 'support', text: message, idempotencyKey: key } })
      if (ticket.type === 'technical') await req.payload.jobs.queue({ task: 'developer-email', input: { ticketID: ticket.id, messageID: reply.id }, req })
      await req.payload.update({ collection: 'support-tickets', id, req, overrideAccess: true, data: { status: user.role === 'client' ? ticket.status : 'in_progress' } })
      return { ok: true }
    }))
  }),
  endpoint('/v1/warehouse', 'get', async req => {
    staffUser(req)
    const [orders, items, cells, tickets, messages] = await Promise.all([
      req.payload.find({ collection: 'orders', req, overrideAccess: false, limit: 200, depth: 1, sort: '-createdAt' }),
      req.payload.find({ collection: 'storage-items', req, overrideAccess: false, limit: 1000, depth: 1 }),
      req.payload.find({ collection: 'cells', req, overrideAccess: false, limit: 1000, depth: 1, sort: 'name' }),
      hasRole(req, ['admin', 'manager']) ? req.payload.find({ collection: 'support-tickets', req, overrideAccess: false, limit: 100, depth: 1, sort: '-updatedAt', where: { type: { equals: 'incident' } } }) : { docs: [] },
      hasRole(req, ['admin', 'manager']) ? req.payload.find({ collection: 'support-messages', req, overrideAccess: false, limit: 1000, depth: 0, sort: 'createdAt' }) : { docs: [] },
    ])
    return json({ ok: true, role: req.user!.role, orders: orders.docs.map(o => ({ ...orderDTO(o), type: o.type, ownerID: relationID(o.owner), clientName: typeof o.owner === 'object' ? `${o.owner.firstName || ''} ${o.owner.lastName || ''}`.trim() : '', picked: (o.picked || []).map(relationID) })), items: items.docs.map(i => ({ ...itemDTO(i), ownerID: relationID(i.owner), cell: relationID(i.cell), cellName: typeof i.cell === 'object' ? i.cell?.name : '' })), cells: cells.docs.map(c => ({ id: c.id, name: c.name, barcode: c.barcode, capacity: c.capacity, active: c.active, occupied: items.docs.filter(i => relationID(i.cell) === c.id && i.status !== 'returned').length })), tickets: tickets.docs.map(t => ({ id: t.id, subject: t.subject, attachments: (t.attachments || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ filename: m.filename, url: m.url })), status: t.status, type: t.type, messages: messages.docs.filter(m => relationID(m.ticket) === t.id).map(m => ({ text: m.text, author: m.authorRole, date: dateLabel(m.createdAt) })) })) })
  }),
  endpoint('/v1/warehouse/orders/:id/receive', 'post', async req => {
    staffUser(req); const id = idOf(req.routeParams?.id), data = await body(req), itemID = idOf(data.itemID), barcode = required(data.barcode, 80), seal = text(data.seal, 80), evidence = idsOf(data.evidence)
    return json(await transaction(req, [`order:${id}`, `item:${itemID}`, `barcode:${barcode}`], async () => {
      const order = await orderByID(req, id); if (order.type !== 'intake' || order.status !== 'created' || !(order.items || []).map(relationID).includes(itemID)) throw conflict('Приёмка недоступна для этой заявки.')
      if (((order.details as any)?.amount > 0 && !order.payment) || (order.payment && (await req.payload.findByID({ collection: 'payments', id: relationID(order.payment), req, overrideAccess: true, depth: 0 })).status !== 'paid')) throw conflict('Сначала подтвердите оплату заявки.')
      const item = await req.payload.findByID({ collection: 'storage-items', id: itemID, req, overrideAccess: false })
      if (item.status !== 'expected') throw conflict('Вещь уже принята.')
      if (item.type === 'box' && !seal) throw bad('Укажите пломбу коробки.')
      await ownedMedia(req, evidence, relationID(order.owner), 'intake')
      const duplicate = await req.payload.find({ collection: 'storage-items', req, overrideAccess: true, limit: 1, where: { barcode: { equals: barcode } } }); if (duplicate.totalDocs) throw conflict('Штрихкод уже используется.')
      await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { barcode, seal, contents: text(data.contents, 5000), media: evidence, status: 'received' } })
      // Populated relations can be cached on this request. Count fresh rows in the transaction.
      const pending = await req.payload.count({ collection: 'storage-items', req, overrideAccess: true, where: { and: [{ id: { in: (order.items || []).map(relationID) } }, { status: { not_equals: 'received' } }] } })
      if (!pending.totalDocs) { await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { status: 'received' } }); await event(req, order, 'received') }
      else await event(req, order, 'created', `Принята вещь ${item.internalID}`)
      return { ok: true }
    }))
  }),
  endpoint('/v1/warehouse/place', 'post', async req => {
    staffUser(req); const data = await body(req), itemID = idOf(data.itemID), cellID = idOf(data.cellID), orderID = idOf(data.orderID)
    return json(await transaction(req, [`order:${orderID}`, `item:${itemID}`, `cell:${cellID}`], async () => {
      const item = await req.payload.findByID({ collection: 'storage-items', id: itemID, req, overrideAccess: false }), cell = await req.payload.findByID({ collection: 'cells', id: cellID, req, overrideAccess: false })
      const order = await orderByID(req, orderID)
      if (order.type !== 'intake' || order.status !== 'received' || !(order.items || []).map(relationID).includes(itemID) || item.status !== 'received') throw conflict('Вещь не готова к размещению.')
      if (data.barcode !== item.barcode || data.cellBarcode !== cell.barcode || !cell.active) throw bad('Отсканируйте штрихкоды вещи и активной ячейки.')
      const occupied = await req.payload.count({ collection: 'storage-items', req, overrideAccess: true, where: { and: [{ cell: { equals: cellID } }, { status: { not_equals: 'returned' } }] } })
      if (occupied.totalDocs >= cell.capacity) throw conflict('В ячейке нет места.')
      await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { cell: cellID, status: 'stored', startedAt: new Date().toISOString() } })
      const pending = await req.payload.count({ collection: 'storage-items', req, overrideAccess: true, where: { and: [{ id: { in: (order.items || []).map(relationID) } }, { status: { not_equals: 'stored' } }] } })
      await event(req, order, 'received', 'Вещь размещена на хранение')
      if (!pending.totalDocs) { await event(req, order, 'placed'); await captureOrder(req, order); await req.payload.update({ collection: 'orders', id: orderID, req, overrideAccess: true, context: wf, data: { status: 'completed', closedAt: new Date().toISOString() } }); await event(req, order, 'completed') }
      return { ok: true }
    }))
  }),
  endpoint('/v1/warehouse/orders/:id/pick', 'post', async req => {
    staffUser(req); const id = idOf(req.routeParams?.id), data = await body(req), itemID = idOf(data.itemID)
    return json(await transaction(req, [`order:${id}`, `item:${itemID}`], async () => {
      const order = await orderByID(req, id)
      if (order.type !== 'return' || !['created', 'picking'].includes(order.status) || !(order.items || []).map(relationID).includes(itemID)) throw conflict('Подбор недоступен.')
      const item = await req.payload.findByID({ collection: 'storage-items', id: itemID, req, overrideAccess: false })
      if (item.status !== 'reserved' || item.barcode !== data.barcode) throw bad('Отсканируйте правильный штрихкод вещи.')
      const picked = [...(order.picked || []).map(relationID), itemID]
      await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { status: 'picked' } })
      if (order.status === 'created') await event(req, order, 'picking')
      const status = picked.length === (order.items || []).length ? 'ready' : 'picking'
      await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { picked, status } })
      await event(req, order, status, `Подобрана вещь ${item.internalID}`); return { ok: true }
    }))
  }),
  endpoint('/v1/warehouse/orders/:id/complete', 'post', async req => {
    staffUser(req); const id = idOf(req.routeParams?.id), data = await body(req), signature = idOf(data.signature), evidence = idsOf(data.evidence), initial = await orderByID(req, id), ids = (initial.items || []).map(relationID)
    const cells = (initial.items || []).filter(i => typeof i === 'object').map(i => relationID((i as any).cell)).filter(Boolean)
    return json(await transaction(req, [`order:${id}`, ...ids.map(i => `item:${i}`), ...cells.map(i => `cell:${i}`)], async () => {
      const order = await orderByID(req, id)
      if (order.type !== 'return' || order.status !== 'ready' || (order.picked || []).length !== ids.length) throw conflict('Заказ не собран полностью.')
      await ownedMedia(req, [signature], relationID(order.owner), 'signature'); await ownedMedia(req, evidence, relationID(order.owner), 'return')
      for (const itemID of ids) await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { status: 'returned', cell: null, returnedAt: new Date().toISOString() } })
      await captureOrder(req, order)
      await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { status: 'completed', closedAt: new Date().toISOString(), signature, evidence } }); await event(req, order, 'completed', 'Передача подтверждена подписью и фото')
      return { ok: true }
    }))
  }),
]
