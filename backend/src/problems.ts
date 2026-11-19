import { randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { endpoint, staffUser, clientUser, body, json, transaction } from './http'
import { DomainError, relationID } from './domain'
import { requestKey, fingerprint } from './ordering'
import { hasRole } from './access'

const invalid = (message: string) => new DomainError(400, 'INVALID_PROBLEM', message)
const uuid = (value: unknown) => { if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) throw invalid('Неверный идентификатор.'); return value.toLowerCase() }
const actorName = (req: PayloadRequest) => [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') || req.user!.role
const evidenceEnabled = () => process.env.PROBLEM_EVIDENCE_ENABLED !== 'false'

async function detail(req: PayloadRequest, id: string) {
  const report = await req.payload.findByID({ collection: 'damage-reports', id, req, overrideAccess: false, depth: 0 })
  const ids = (report.evidence || []).map(relationID)
  const media = ids.length ? await req.payload.find({ collection: 'media', req, overrideAccess: false, depth: 0, pagination: false, where: { id: { in: ids } } }) : { docs: [] }
  return { ok: true, report: { id: report.id, number: report.number, status: report.status, publishedAt: report.publishedAt, publishedByName: report.publishedByName, orderID: relationID(report.order), orderNumber: report.orderNumber, itemID: relationID(report.item), itemLabel: report.itemLabel, ownerID: relationID(report.owner), description: report.description, discoveredAtIntake: report.discoveredAtIntake, createdAt: report.createdAt, createdByName: report.createdByName, ticketID: relationID(report.ticket), evidence: media.docs.map(m => ({ id: m.id, filename: m.filename, url: m.url })) } }
}

export const problemEndpoints = [
  endpoint('/v1/problems/context', 'get', async req => {
    staffUser(req)
    const params = new URL(req.url!).searchParams, search = (params.get('search') || '').trim().slice(0, 100)
    const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1))
    const orders = await req.payload.find({ collection: 'orders', req, overrideAccess: false, depth: 1, sort: '-createdAt', limit: 25, page, where: { and: [{ type: { equals: 'intake' } }, { status: { in: ['created', 'received'] } }, ...(params.get('orderID') ? [{ id: { equals: uuid(params.get('orderID')) } }] : []), ...(search ? [{ number: { like: search } }] : [])] } })
    return json({ ok: true, evidenceEnabled: evidenceEnabled(), page: orders.page, totalPages: orders.totalPages, orders: orders.docs.map(o => ({ id: o.id, number: o.number, ownerID: relationID(o.owner), items: (o.items || []).filter(i => typeof i === 'object' && ['expected', 'received'].includes(i.status)).map(i => typeof i === 'object' ? { id: i.id, title: i.title, internalID: i.internalID } : null) })) })
  }),
  endpoint('/v1/problems', 'get', async req => {
    staffUser(req)
    const params = new URL(req.url!).searchParams, search = (params.get('search') || '').trim().slice(0, 100), page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1))
    const filters: any[] = []
    if (['pending', 'published'].includes(params.get('state') || '')) filters.push({ status: { equals: params.get('state') } })
    if (search) filters.push({ or: ['number', 'orderNumber', 'itemLabel'].map(field => ({ [field]: { like: search } })) })
    const reports = await req.payload.find({ collection: 'damage-reports', req, overrideAccess: false, depth: 0, sort: '-createdAt', page, limit: 25, where: filters.length ? { and: filters } : {} })
    return json({ ok: true, page: reports.page, totalPages: reports.totalPages, total: reports.totalDocs, reports: reports.docs.map(r => ({ id: r.id, number: r.number, status: r.status, orderNumber: r.orderNumber, itemLabel: r.itemLabel, createdAt: r.createdAt })) })
  }),
  endpoint('/v1/problems', 'post', async req => {
    staffUser(req)
    const data = await body(req), orderID = uuid(data.orderID), itemID = uuid(data.itemID), key = requestKey(req)
    if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 5000) throw invalid('Опишите повреждение: от 1 до 5000 символов.')
    if (data.discoveredAtIntake !== true) throw invalid('Подтвердите, что повреждение обнаружено при поступлении.')
    const evidence: string[] = Array.isArray(data.evidence) ? data.evidence.map(uuid) : []
    if ((data.evidence !== undefined && !Array.isArray(data.evidence)) || evidence.length > 5 || new Set(evidence).size !== evidence.length) throw invalid('Допускается до пяти разных материалов.')
    if (evidence.length && !evidenceEnabled()) throw new DomainError(503, 'EVIDENCE_UNAVAILABLE', 'Материалы временно недоступны. Сохраните описание повреждения без файлов.')
    const description = data.description.trim(), hash = fingerprint({ orderID, itemID, description, evidence: [...evidence].sort() })
    return json(await transaction(req, [`order:${orderID}`, `item:${itemID}`, `damage-key:${key}`], async () => {
      const previous = (await req.payload.find({ collection: 'damage-reports', req, overrideAccess: true, depth: 0, limit: 1, where: { idempotencyKey: { equals: key } } })).docs[0]
      if (previous) { if (previous.requestHash !== hash) throw new DomainError(409, 'KEY_REUSED', 'Ключ относится к другому акту.'); return detail(req, previous.id) }
      const order = await req.payload.findByID({ collection: 'orders', id: orderID, req, overrideAccess: false, depth: 0 })
      const item = await req.payload.findByID({ collection: 'storage-items', id: itemID, req, overrideAccess: false, depth: 0 })
      if (order.type !== 'intake' || !['created', 'received'].includes(order.status) || !(order.items || []).map(relationID).includes(itemID) || !['expected', 'received'].includes(item.status) || relationID(order.owner) !== relationID(item.owner)) throw new DomainError(409, 'INTAKE_REQUIRED', 'Фиксация доступна только для вещи в текущей приёмке.')
      const duplicate = await req.payload.count({ collection: 'damage-reports', req, overrideAccess: true, where: { and: [{ order: { equals: orderID } }, { item: { equals: itemID } }] } })
      if (duplicate.totalDocs) throw new DomainError(409, 'REPORT_EXISTS', 'Акт для этой вещи и приёмки уже существует. Откройте его в списке.')
      for (const id of evidence) {
        const media = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: false, depth: 0 })
        if (relationID(media.owner) !== relationID(item.owner) || media.purpose !== 'intake' || media.internalOnly !== true) throw invalid('Материал должен быть внутренним и относиться к приёмке этого клиента.')
      }
      const number = `DMG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`
      const report = await req.payload.create({ collection: 'damage-reports', req, overrideAccess: true, data: { number, status: 'pending', owner: relationID(item.owner), order: orderID, item: itemID, orderNumber: order.number, itemLabel: `${item.title} · ${item.internalID}`, description, discoveredAtIntake: true, evidence, createdBy: req.user!.id, createdByName: actorName(req), idempotencyKey: key, requestHash: hash } })
      return detail(req, report.id)
    }))
  }),
  endpoint('/v1/problems/:id', 'get', async req => { staffUser(req); return json(await detail(req, uuid(req.routeParams?.id))) }),
  endpoint('/v1/problems/:id/publish', 'post', async req => {
    if (!hasRole(req, ['admin', 'manager'])) throw new DomainError(403, 'FORBIDDEN', 'Подтвердить кейс может менеджер или администратор.')
    const id = uuid(req.routeParams?.id), data = await body(req)
    if (data.confirmed !== true) throw invalid('Подтвердите публикацию кейса клиенту.')
    return json(await transaction(req, [`damage-report:${id}`], async () => {
      const report = await req.payload.findByID({ collection: 'damage-reports', id, req, overrideAccess: false, depth: 0 })
      if (report.status === 'published') return detail(req, id)
      if (report.status !== 'pending' || report.ticket) throw new DomainError(409, 'INVALID_STATE', 'Кейс недоступен для подтверждения.')
      const evidence = (report.evidence || []).map(relationID), owner = relationID(report.owner)
      for (const mediaID of evidence) {
        const media = await req.payload.findByID({ collection: 'media', id: mediaID, req, overrideAccess: false, depth: 0 })
        if (relationID(media.owner) !== owner || media.purpose !== 'intake') throw invalid('Проверьте материалы кейса.')
        await req.payload.update({ collection: 'media', id: mediaID, req, overrideAccess: true, data: { internalOnly: false } })
      }
      const ticket = await req.payload.create({ collection: 'support-tickets', req, overrideAccess: true, data: { owner, type: 'incident', subject: `${report.number}: повреждение при поступлении`, status: 'submitted', order: relationID(report.order), item: relationID(report.item), attachments: evidence, details: { source: 'damage-report', reportNumber: report.number } } })
      await req.payload.create({ collection: 'support-messages', req, overrideAccess: true, data: { owner, ticket: ticket.id, author: req.user!.id, authorRole: 'support', text: `При поступлении вещи «${report.itemLabel}» обнаружено повреждение. ${report.description}\nКейс ${report.number} подтверждён. Это операционная фиксация; юридическая форма акта ещё не утверждена. По вопросам дальнейших действий напишите в этом обращении.` } })
      await req.payload.update({ collection: 'damage-reports', id, req, overrideAccess: true, data: { status: 'published', ticket: ticket.id, publishedAt: new Date().toISOString(), publishedBy: req.user!.id, publishedByName: actorName(req) } })
      await req.payload.create({ collection: 'order-events', req, overrideAccess: true, data: { owner, order: relationID(report.order), actor: req.user!.id, status: 'damage_found', note: `${report.number}: ${report.description}` } })
      return detail(req, id)
    }))
  }),
  endpoint('/v1/items/:id/problems', 'get', async req => {
    const user = clientUser(req), id = uuid(req.routeParams?.id)
    const item = await req.payload.findByID({ collection: 'storage-items', id, req, overrideAccess: false, depth: 0 })
    if (relationID(item.owner) !== user.id) throw new DomainError(404, 'NOT_FOUND', 'Вещь недоступна.')
    const reports = await req.payload.find({ collection: 'damage-reports', req, overrideAccess: true, depth: 0, pagination: false, sort: '-createdAt', where: { and: [{ item: { equals: id } }, { owner: { equals: user.id } }, { status: { equals: 'published' } }] } })
    return json({ ok: true, reports: reports.docs.map(r => ({ number: r.number, description: r.description, createdAt: r.createdAt, ticketID: relationID(r.ticket) })) })
  }),
]
