import { randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { endpoint, json, body, clientUser, transaction } from './http'
import { DomainError, relationID, text } from './domain'
import { simulationsEnabled } from './simulations'

const needSimulation = () => { if (!simulationsEnabled()) throw new DomainError(503, 'PAYMENT_NOT_CONFIGURED', 'Платёжный провайдер пока не подключён.') }
const id = (v: unknown) => { const s = text(v, 40); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new DomainError(400, 'INVALID_REQUEST', 'Неверный идентификатор.'); return s }
const dto = (p: any) => ({ id: p.id, amount: p.amount, status: p.status, provider: p.provider, orderID: relationID(p.order), tariffID: relationID(p.tariff), paidAt: p.paidAt, receiptURL: p.receiptURL, checkoutUrl: `/#/checkout/${p.id}` })

export const paymentEndpoints = [
  endpoint('/v1/payments', 'post', async req => {
    needSimulation(); const user = clientUser(req), data = await body(req)
    if (Boolean(data.orderID) === Boolean(data.tariffID)) throw new DomainError(400, 'INVALID_REQUEST', 'Укажите заказ или тариф подписки.')
    const entity = id(data.orderID || data.tariffID)
    return json(await transaction(req, [`payment-owner:${user.id}`, `payment-entity:${entity}`, ...(data.orderID ? [`order:${entity}`] : [])], async () => {
      let amount: number, orderID: string | undefined, tariffID: string | undefined
      if (data.orderID) {
        const order = await req.payload.findByID({ collection: 'orders', id: entity, req, overrideAccess: false, depth: 1 })
        if (relationID(order.owner) !== user.id || order.type !== 'intake' || order.status === 'cancelled') throw new DomainError(409, 'PAYMENT_UNAVAILABLE', 'Оплата недоступна для этого заказа.')
        orderID = order.id; amount = (order.items || []).reduce((n, i) => n + (typeof i === 'object' ? i.monthlyPrice : 0), 0)
      } else {
        const tariff = await req.payload.findByID({ collection: 'tariffs', id: entity, req, overrideAccess: false })
        if (!tariff.active || tariff.kind !== 'subscription' || (tariff.testOnly && process.env.APP_ENV !== 'staging')) throw new DomainError(400, 'INVALID_REQUEST', 'Тариф подписки недоступен.')
        const count = await req.payload.count({ collection: 'storage-items', req, overrideAccess: false, where: { status: { in: ['stored', 'reserved', 'picked'] } } })
        if (count.totalDocs > tariff.itemLimit) throw new DomainError(409, 'TARIFF_LIMIT', 'Сначала верните вещи, превышающие лимит тарифа.')
        tariffID = tariff.id; amount = tariff.monthlyPrice
      }
      const operation = data.tariffID ? text(req.headers.get('idempotency-key'), 100) : ''
      if (data.tariffID && !operation) throw new DomainError(400, 'IDEMPOTENCY_REQUIRED', 'Повторите операцию с ключом запроса.')
      const key = `${user.id}:${data.orderID ? 'order' : 'tariff'}:${entity}:${operation}`
      const old = (await req.payload.find({ collection: 'payments', req, overrideAccess: true, limit: 1, depth: 0, where: { idempotencyKey: { equals: key } } })).docs[0]
      if (old) return { ok: true, payment: dto(old) }
      const payment = await req.payload.create({ collection: 'payments', req, overrideAccess: true, data: { owner: user.id, amount, status: 'pending', provider: 'simulation', providerID: `sim_${randomUUID()}`, idempotencyKey: key, order: orderID, tariff: tariffID } })
      if (orderID) await req.payload.update({ collection: 'orders', id: orderID, req, overrideAccess: true, context: { workflow: true }, data: { payment: payment.id } })
      return { ok: true, payment: dto(payment) }
    }))
  }),
  endpoint('/v1/payments/:id', 'get', async req => {
    clientUser(req); const p = await req.payload.findByID({ collection: 'payments', id: id(req.routeParams?.id), req, overrideAccess: false, depth: 0 })
    return json({ ok: true, payment: dto(p), simulation: simulationsEnabled() })
  }),
  endpoint('/v1/payments/:id/receipt', 'get', async req => {
    clientUser(req); const p = await req.payload.findByID({ collection: 'payments', id: id(req.routeParams?.id), req, overrideAccess: false, depth: 0 })
    if (!['paid', 'refunded'].includes(p.status) || p.provider !== 'simulation') throw new DomainError(404, 'NOT_FOUND', 'Квитанция недоступна.')
    return json({ document: 'Тестовая квитанция. Не является фискальным чеком.', payment: dto(p), refundAmount: p.status === 'refunded' ? p.amount : 0, currency: 'RUB' }, 200, { 'Content-Disposition': `attachment; filename="test-payment-${p.id}.json"` })
  }),
  endpoint('/v1/payments/:id/simulate', 'post', async req => {
    needSimulation(); const user = clientUser(req), paymentID = id(req.routeParams?.id), data = await body(req)
    if (!['paid', 'failed'].includes(data.result)) throw new DomainError(400, 'INVALID_RESULT', 'Выберите результат оплаты.')
    const initial = await req.payload.findByID({ collection: 'payments', id: paymentID, req, overrideAccess: false, depth: 0 })
    return json(await transaction(req, [`payment-owner:${user.id}`, `payment:${paymentID}`, ...(initial.order ? [`order:${relationID(initial.order)}`] : [])], async () => {
      const p = await req.payload.findByID({ collection: 'payments', id: paymentID, req, overrideAccess: false, depth: 0 })
      if (p.status === 'paid') return { ok: true, payment: dto(p) }
      if (p.status === 'refunded') return { ok: true, payment: dto(p) }
      if (p.order) {
        const order = await req.payload.findByID({ collection: 'orders', id: relationID(p.order), req, overrideAccess: false })
        if (order.status === 'cancelled') throw new DomainError(409, 'ORDER_CANCELLED', 'Заказ отменён, оплата недоступна.')
      }
      const key = `payment-result:${p.id}:${data.result}`
      const seen = await req.payload.find({ collection: 'integration-events', req, overrideAccess: true, limit: 1, where: { key: { equals: key } } })
      if (seen.totalDocs) return { ok: true, payment: dto(p) }
      // The simulator feeds the same state transition and idempotency boundary used by a provider callback.
      const updated = await req.payload.update({ collection: 'payments', id: p.id, req, overrideAccess: true, data: { status: data.result, paidAt: data.result === 'paid' ? new Date().toISOString() : null, receiptURL: data.result === 'paid' ? `/api/v1/payments/${p.id}/receipt` : null } })
      await req.payload.create({ collection: 'integration-events', req, overrideAccess: true, data: { key, provider: 'simulation-payment', status: 'completed', entityID: p.id, externalID: p.providerID } })
      if (data.result === 'paid' && p.tariff) {
        const tariffID = relationID(p.tariff)
        const current = (await req.payload.find({ collection: 'subscriptions', req, overrideAccess: true, limit: 1, where: { owner: { equals: user.id } } })).docs[0]
        const subscriptionData = { tariff: tariffID, status: 'active' as const, nextChargeAt: null }
        if (current) await req.payload.update({ collection: 'subscriptions', id: current.id, req, overrideAccess: true, data: subscriptionData })
        else await req.payload.create({ collection: 'subscriptions', req, overrideAccess: true, data: { owner: user.id, ...subscriptionData } })
      }
      return { ok: true, payment: dto(updated) }
    }))
  }),
  endpoint('/v1/payment-method/simulate', 'post', async req => {
    needSimulation(); const user = clientUser(req)
    await req.payload.update({ collection: 'users', id: user.id, req, overrideAccess: true, data: { paymentBrand: 'Тестовая карта', paymentLast4: '4242' } })
    return json({ ok: true, paymentMethod: { brand: 'Тестовая карта', last4: '4242' } })
  }),
  endpoint('/v1/subscription/pause', 'post', async req => {
    needSimulation(); const user = clientUser(req)
    return json(await transaction(req, [`client-orders:${user.id}`, `payment-owner:${user.id}`], async () => {
      const items = await req.payload.count({ collection: 'storage-items', req, overrideAccess: false, where: { status: { not_equals: 'returned' } } })
      const orders = await req.payload.count({ collection: 'orders', req, overrideAccess: false, where: { status: { not_in: ['completed', 'cancelled'] } } })
      if (items.totalDocs || orders.totalDocs) throw new DomainError(409, 'SUBSCRIPTION_IN_USE', 'Сначала верните вещи и завершите заказы.')
      const sub = (await req.payload.find({ collection: 'subscriptions', req, overrideAccess: false, limit: 1 })).docs[0]
      if (!sub) throw new DomainError(409, 'NO_SUBSCRIPTION', 'Подписка ещё не оформлена.')
      await req.payload.update({ collection: 'subscriptions', req, id: sub.id, overrideAccess: true, data: { status: 'paused', nextChargeAt: null } })
      return { ok: true }
    }))
  }),
]
