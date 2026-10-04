import { randomUUID, createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { endpoint, body, json, clientUser, staffUser, transaction } from './http'
import { DomainError, text, relationID, assertTransition } from './domain'
import { hasRole } from './access'

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
  return { id: item.id, internalID: item.internalID, title: item.title, type: item.type, description: item.description || '', contents: (item.contents || '').split('\n').filter(Boolean), seal: item.seal || '—', barcode: item.barcode || '', status: item.status, statusLabel: labels[item.status], monthlyPrice: item.monthlyPrice, storedSince: dateLabel(item.startedAt), storedSinceLabel: dateLabel(item.startedAt), size: item.type === 'box' ? 'Коробка' : 'Отдельный предмет', media: (item.media || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ id: m.id, url: m.url, filename: m.filename, mimeType: m.mimeType })), ...(item.status !== 'stored' ? { lockReason: labels[item.status] || 'Недоступно для возврата' } : {}) }
}
export function orderDTO(order: any, events: any[] = []) {
  const items = (order.items || []).filter((i: any) => typeof i === 'object').map(itemDTO)
  return { id: order.id, number: order.number, type: order.type === 'intake' ? 'storage' : 'return', fulfillment: order.fulfillment, status: stateMap[order.status] || 'created', backendStatus: order.status, statusLabel: labels[order.status], visitAt: null, visitWindow: order.slot || '', address: order.address || '', warehouse: '', warehouseAddress: '', workingHours: '', courier: null, pickupInstructions: 'Передача согласовывается с сотрудником склада.', scheduleNotice: 'Указанное время — пожелание. Сотрудник подтвердит передачу.', currentMonthlyStorage: 0, futureMonthlyStorage: items.reduce((n: number, i: any) => n + (i.monthlyPrice || 0), 0), cancelReason: '', documentAvailable: false, cancelledFrom: null, events: events.filter(e => relationID(e.order) === order.id).map(e => ({ status: e.status, label: labels[e.status] || e.status, at: e.createdAt, note: e.note })), history: events.filter(e => relationID(e.order) === order.id).map(e => ({ status: stateMap[e.status] || 'created', at: e.createdAt })), items: items.map((i: any) => ({ ...i, name: i.title, note: i.description, icon: i.type === 'box' ? 'box' : 'bag', status: i.statusLabel })), createdAt: order.createdAt, updatedAt: order.updatedAt, paymentID: relationID(order.payment), paymentStatus: typeof order.payment === 'object' ? order.payment?.status : null, signature: relationID(order.signature), evidence: (order.evidence || []).map(relationID) }
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
    const mapped = orders.docs.map(o => orderDTO(o, events.docs)), sub = subscriptions.docs[0]
    return json({ ok: true, staging: process.env.APP_ENV === 'staging', units: items.docs.map(itemDTO), orders: mapped, activeOrders: mapped.filter(o => !terminal(o.backendStatus)), profile: { firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '', email: user.contactEmail || '', planId: relationID(sub?.tariff), monthlyPrice: items.docs.filter(i => ['stored', 'reserved', 'picked'].includes(i.status)).reduce((n, i) => n + i.monthlyPrice, 0), subscriptionStatus: sub?.status || null, nextChargeDate: dateLabel(sub?.nextChargeAt), paymentMethod: user.paymentLast4 ? { brand: user.paymentBrand, last4: user.paymentLast4 } : null, recentPayments, hasStoredItems: items.docs.some(i => ['stored', 'reserved', 'picked'].includes(i.status)), hasActiveOrders: mapped.some(o => !terminal(o.backendStatus)) }, tariffs: tariffs.docs.map(t => ({ id: t.id, code: t.code, kind: t.kind, title: t.name, monthlyPrice: t.monthlyPrice, price: t.monthlyPrice, itemLimit: t.itemLimit, itemType: t.itemType || 'box', testOnly: t.testOnly, rules: t.rules })), warehouses: warehouses.docs.map(w => ({ id: w.id, name: w.name, address: w.address || '' })), tickets: tickets.docs.map(t => ({ id: t.id, type: t.type, attachments: (t.attachments || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ filename: m.filename, url: m.url })), shortDescription: t.subject, status: t.status, updatedAt: dateLabel(t.updatedAt), relatedOrderId: relationID(t.order), messages: messages.docs.filter(m => relationID(m.ticket) === t.id).map(m => ({ author: m.authorRole, text: m.text, date: dateLabel(m.createdAt) })) })) })
  }),
  endpoint('/v1/intake', 'post', async req => {
    const user = clientUser(req), data = await body(req), key = keyFor(req)
    if (!Array.isArray(data.items) || !data.items.length || data.items.length > 20) throw bad('Выберите вещи.')
    const lines = data.items.map((i: any) => ({ tariffID: idOf(i.tariffID), quantity: Number(i.quantity), description: text(i.description, 500) }))
    if (lines.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20) || lines.reduce((n, i) => n + i.quantity, 0) > 50) throw bad('Неверное количество вещей.')
    const logistics = delivery(data), fingerprint = hash({ lines, logistics })
    return json(await transaction(req, [`client-orders:${user.id}`, `idempotency:${key}`], async () => {
      const existing = await replay(req, key, fingerprint); if (existing) return { ok: true, order: orderDTO(existing) }
      const created: string[] = []
      for (const line of lines) {
        const tariff = await req.payload.findByID({ collection: 'tariffs', id: line.tariffID, req, overrideAccess: false })
        if (!tariff.active || tariff.kind !== 'storage' || (tariff.testOnly && process.env.APP_ENV !== 'staging')) throw bad('Тариф недоступен.')
        for (let i = 0; i < line.quantity; i++) {
          const item = await req.payload.create({ collection: 'storage-items', req, overrideAccess: true, context: wf, data: { owner: user.id, internalID: `WHM-${randomUUID().slice(0, 8).toUpperCase()}`, title: tariff.name, type: tariff.itemType || 'box', description: line.description, status: 'expected', monthlyPrice: tariff.monthlyPrice } })
          created.push(item.id)
        }
      }
      const order = await req.payload.create({ collection: 'orders', req, overrideAccess: true, context: wf, depth: 1, data: { owner: user.id, number: `S-${randomUUID().slice(0, 8).toUpperCase()}`, type: 'intake', status: 'created', items: created, ...logistics, idempotencyKey: key, requestHash: fingerprint } })
      await event(req, order, 'created')
      return { ok: true, order: orderDTO(order) }
    }))
  }),
  endpoint('/v1/returns', 'post', async req => {
    const user = clientUser(req), data = await body(req), ids = idsOf(data.itemIDs), logistics = delivery(data), key = keyFor(req), fingerprint = hash({ ids: [...ids].sort(), logistics })
    return json(await transaction(req, [`client-orders:${user.id}`, `idempotency:${key}`, ...ids.map(i => `item:${i}`)], async () => {
      const existing = await replay(req, key, fingerprint); if (existing) return { ok: true, order: orderDTO(existing) }
      for (const id of ids) {
        const item = await req.payload.findByID({ collection: 'storage-items', id, req, overrideAccess: false })
        if (relationID(item.owner) !== user.id || item.status !== 'stored') throw conflict('Вещь уже в возврате или недоступна.')
        await req.payload.update({ collection: 'storage-items', id, req, overrideAccess: true, context: wf, data: { status: 'reserved' } })
      }
      const order = await req.payload.create({ collection: 'orders', req, overrideAccess: true, context: wf, depth: 1, data: { owner: user.id, number: `R-${randomUUID().slice(0, 8).toUpperCase()}`, type: 'return', status: 'created', items: ids, ...logistics, idempotencyKey: key, requestHash: fingerprint } })
      await event(req, order, 'created'); return { ok: true, order: orderDTO(order) }
    }))
  }),
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
      assertTransition(order.type, order.status, 'cancelled')
      for (const itemID of ids) await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { status: order.type === 'intake' ? 'returned' : 'stored' } })
      if (order.payment) {
        const payment = await req.payload.findByID({ collection: 'payments', id: relationID(order.payment), req, overrideAccess: true, depth: 0 })
        if (payment.provider === 'simulation') {
          await req.payload.update({ collection: 'payments', id: payment.id, req, overrideAccess: true, data: { status: payment.status === 'paid' ? 'refunded' : 'failed' } })
          await req.payload.create({ collection: 'integration-events', req, overrideAccess: true, data: { key: `cancel-payment:${payment.id}`, provider: 'simulation-payment', status: 'completed', entityID: payment.id } })
        }
      }
      await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { status: 'cancelled' } }); await event(req, order, 'cancelled', 'Отменено клиентом')
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
    const user = clientUser(req), data = await body(req), message = required(data.description, 5000)
    if (!['incident', 'technical'].includes(data.type)) throw bad('Выберите тип обращения.')
    const order = data.orderId ? await orderByID(req, idOf(data.orderId), true) : undefined
    const item = data.unitId ? await req.payload.findByID({ collection: 'storage-items', id: idOf(data.unitId), req, overrideAccess: false }) : undefined
    if (item && relationID(item.owner) !== user.id) throw bad('Вещь недоступна.')
    const attachments = Array.isArray(data.attachments) && data.attachments.length ? idsOf(data.attachments) : []
    if (attachments.length > 5) throw bad('Максимум пять вложений.')
    await ownedMedia(req, attachments, user.id, 'support')
    return json(await transaction(req, [`support:${user.id}`], async () => {
      const ticket = await req.payload.create({ collection: 'support-tickets', req, overrideAccess: true, data: { owner: user.id, type: data.type, subject: message.slice(0, 100), status: 'submitted', order: order?.id, item: item?.id, attachments } })
      await req.payload.create({ collection: 'support-messages', req, overrideAccess: true, data: { owner: user.id, ticket: ticket.id, author: user.id, authorRole: 'client', text: message } })
      return { ok: true, ticketId: ticket.id, expectedResponse: 'Обращение сохранено. Сотрудник ответит в переписке.' }
    }))
  }),
  endpoint('/v1/support/:id/reply', 'post', async req => {
    const user = req.user; if (!user || user.active === false || !['client', 'manager', 'admin'].includes(user.role)) throw new DomainError(403, 'FORBIDDEN', 'Недостаточно прав.')
    const id = idOf(req.routeParams?.id), data = await body(req), message = required(data.text, 5000)
    return json(await transaction(req, [`ticket:${id}`], async () => {
      const ticket = await req.payload.findByID({ collection: 'support-tickets', id, req, overrideAccess: false })
      if (ticket.status === 'resolved') throw conflict('Обращение закрыто.')
      await req.payload.create({ collection: 'support-messages', req, overrideAccess: true, data: { owner: relationID(ticket.owner), ticket: id, author: user.id, authorRole: user.role === 'client' ? 'client' : 'support', text: message } })
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
      hasRole(req, ['admin', 'manager']) ? req.payload.find({ collection: 'support-tickets', req, overrideAccess: false, limit: 100, depth: 1, sort: '-updatedAt' }) : { docs: [] },
      hasRole(req, ['admin', 'manager']) ? req.payload.find({ collection: 'support-messages', req, overrideAccess: false, limit: 1000, depth: 0, sort: 'createdAt' }) : { docs: [] },
    ])
    return json({ ok: true, role: req.user!.role, orders: orders.docs.map(o => ({ ...orderDTO(o), type: o.type, ownerID: relationID(o.owner), clientName: typeof o.owner === 'object' ? `${o.owner.firstName || ''} ${o.owner.lastName || ''}`.trim() : '', picked: (o.picked || []).map(relationID) })), items: items.docs.map(i => ({ ...itemDTO(i), ownerID: relationID(i.owner), cell: relationID(i.cell), cellName: typeof i.cell === 'object' ? i.cell?.name : '' })), cells: cells.docs.map(c => ({ id: c.id, name: c.name, barcode: c.barcode, capacity: c.capacity, active: c.active, occupied: items.docs.filter(i => relationID(i.cell) === c.id && i.status !== 'returned').length })), tickets: tickets.docs.map(t => ({ id: t.id, subject: t.subject, attachments: (t.attachments || []).filter((m: any) => typeof m === 'object').map((m: any) => ({ filename: m.filename, url: m.url })), status: t.status, type: t.type, messages: messages.docs.filter(m => relationID(m.ticket) === t.id).map(m => ({ text: m.text, author: m.authorRole, date: dateLabel(m.createdAt) })) })) })
  }),
  endpoint('/v1/warehouse/orders/:id/receive', 'post', async req => {
    staffUser(req); const id = idOf(req.routeParams?.id), data = await body(req), itemID = idOf(data.itemID), barcode = required(data.barcode, 80), seal = text(data.seal, 80), evidence = idsOf(data.evidence)
    return json(await transaction(req, [`order:${id}`, `item:${itemID}`, `barcode:${barcode}`], async () => {
      const order = await orderByID(req, id); if (order.type !== 'intake' || order.status !== 'created' || !(order.items || []).map(relationID).includes(itemID)) throw conflict('Приёмка недоступна для этой заявки.')
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
      await event(req, order, 'received', `Размещена вещь ${item.internalID} в ${cell.name}`)
      if (!pending.totalDocs) { await event(req, order, 'placed'); await req.payload.update({ collection: 'orders', id: orderID, req, overrideAccess: true, context: wf, data: { status: 'completed' } }); await event(req, order, 'completed') }
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
      for (const itemID of ids) await req.payload.update({ collection: 'storage-items', id: itemID, req, overrideAccess: true, context: wf, data: { status: 'returned', cell: null } })
      await req.payload.update({ collection: 'orders', id, req, overrideAccess: true, context: wf, data: { status: 'completed', signature, evidence } }); await event(req, order, 'completed', 'Передача подтверждена подписью и фото')
      return { ok: true }
    }))
  }),
]
