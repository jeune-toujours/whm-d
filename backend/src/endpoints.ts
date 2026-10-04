import { authEndpoints } from './otp'
import { endpoint, body, json, clientUser } from './http'
import { text } from './domain'

export const endpoints = [
  ...authEndpoints,
  endpoint('/me', 'get', async req => {
    const user = clientUser(req)
    return json({ ok: true, user: { id: user.id, firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone, email: user.contactEmail || '' } })
  }),
  endpoint('/v1/profile', 'patch', async req => {
    const user = clientUser(req), data = await body(req)
    const updated = await req.payload.update({ collection: 'users', id: user.id, req, overrideAccess: false, data: { firstName: text(data.firstName, 80), lastName: text(data.lastName, 80), contactEmail: text(data.email, 150) || null } })
    return json({ ok: true, profile: { id: updated.id, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, email: updated.contactEmail } })
  }),
  ...(['storage-items', 'orders', 'tariffs', 'subscriptions', 'payments', 'support-tickets'] as const).map(collection => endpoint(`/v1/${({ 'storage-items': 'items', 'subscriptions': 'subscription', 'support-tickets': 'support' } as Record<string, string>)[collection] || collection}`, 'get', async req => {
    clientUser(req)
    const docs = await req.payload.find({ collection, req, overrideAccess: false, limit: 100, depth: 1, sort: '-createdAt' })
    return json({ ok: true, ...docs })
  })),
]
