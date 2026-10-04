import { authEndpoints } from './otp'
import { endpoint, body, json, clientUser } from './http'
import { text, DomainError } from './domain'
import { workflowEndpoints } from './workflows'
import { paymentEndpoints } from './payments'

export const endpoints = [
  ...authEndpoints,
  ...workflowEndpoints,
  ...paymentEndpoints,
  endpoint('/me', 'get', async req => {
    const user = clientUser(req)
    return json({ ok: true, user: { id: user.id, firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone, email: user.contactEmail || '' } })
  }),
  endpoint('/v1/profile', 'patch', async req => {
    const user = clientUser(req), data = await body(req)
    const updated = await req.payload.update({ collection: 'users', id: user.id, req, overrideAccess: false, data: { firstName: text(data.firstName, 80), lastName: text(data.lastName, 80), contactEmail: text(data.email, 150) || null } })
    return json({ ok: true, profile: { id: updated.id, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, email: updated.contactEmail } })
  }),
  endpoint('/v1/profile/deactivate', 'post', async req => {
    const user = clientUser(req)
    const items = await req.payload.count({ collection: 'storage-items', req, overrideAccess: false, where: { status: { not_equals: 'returned' } } })
    const orders = await req.payload.count({ collection: 'orders', req, overrideAccess: false, where: { status: { not_in: ['completed', 'cancelled'] } } })
    if (items.totalDocs || orders.totalDocs) throw new DomainError(409, 'ACCOUNT_IN_USE', 'Сначала верните вещи и завершите активные заказы.')
    await req.payload.update({ collection: 'users', req, id: user.id, overrideAccess: true, data: { active: false } })
    return json({ ok: true })
  }),
  ...(['storage-items', 'orders', 'tariffs', 'subscriptions', 'payments', 'support-tickets'] as const).map(collection => endpoint(`/v1/${({ 'storage-items': 'items', 'subscriptions': 'subscription', 'support-tickets': 'support' } as Record<string, string>)[collection] || collection}`, 'get', async req => {
    clientUser(req)
    const docs = await req.payload.find({ collection, req, overrideAccess: false, limit: 100, depth: 1, sort: '-createdAt' })
    return json({ ok: true, ...docs })
  })),
]
