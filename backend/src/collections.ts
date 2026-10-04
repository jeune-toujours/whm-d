import type { CollectionConfig, Field, SelectField, CollectionAfterChangeHook } from 'payload'
import { admin, staff, office, owned, officeOwned, self, never, hasRole, userOf, supportOwned, supportOffice, supportMessages } from './access'
import { DomainError } from './domain'

const owner: Field = { name: 'owner', label: 'Клиент', type: 'relationship', relationTo: 'users', required: true, index: true }
const name: Field = { name: 'name', label: 'Название', type: 'text', required: true }
const choice = (field: string, options: string[], defaultValue?: string): SelectField => ({ name: field, type: 'select', options, required: true, defaultValue })
const audit: CollectionAfterChangeHook = async ({ req, doc, previousDoc, operation, collection }) => {
  const fields = collection.fields.filter((field): field is Field & { name: string } => 'name' in field).map(f => f.name).filter(k => JSON.stringify(doc[k]) !== JSON.stringify(previousDoc?.[k]))
  // audit-log has no change hook. Do not mutate the request context: nested context
  // persists across writes and would suppress the remaining audits in a workflow.
  await req.payload.create({ collection: 'audit-log', overrideAccess: true, req, data: { actor: req.user?.id, entity: collection.slug, entityID: String(doc.id), action: operation, changedFields: fields.join(',') } })
  return doc
}
const immutableWorkflow: CollectionConfig['hooks'] = {
  beforeChange: [({ data, originalDoc, req, operation }) => {
    if (operation === 'update' && !req.context.workflow) {
      for (const key of ['owner', 'status', 'cell', 'items', 'monthlyPrice', 'startedAt', 'returnedAt', 'picked', 'signature', 'evidence', 'payment', 'barcode', 'seal', 'contents', 'media', 'details', 'closedAt', 'historySearch', 'hasServices']) {
        if (data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key])) throw new DomainError(403, 'WORKFLOW_REQUIRED', 'Изменение выполняется через складской процесс.')
      }
    }
    return data
  }], afterChange: [audit],
}
const internal = (slug: string, fields: Field[], read = office): CollectionConfig => ({ slug, admin: { group: 'Системные записи' }, access: { create: never, read, update: never, delete: never }, fields })

export const collections: CollectionConfig[] = [
  {
    slug: 'users', labels: { singular: 'Пользователь', plural: 'Пользователи' },
    auth: { useSessions: true, tokenExpiration: 60 * 60 * 24 * 7, maxLoginAttempts: 5, lockTime: 900_000, cookies: { sameSite: 'Lax', secure: process.env.APP_URL?.startsWith('https://') || false } },
    admin: { useAsTitle: 'firstName', group: 'Клиенты и сотрудники' },
    access: { create: admin, read: self, update: self, delete: never, admin: ({ req }) => hasRole(req, ['admin', 'manager', 'warehouse']) },
    fields: [
      { name: 'phone', type: 'text', unique: true, index: true, access: { update: ({ req }) => hasRole(req, ['admin']) } },
      { name: 'firstName', type: 'text' }, { name: 'lastName', type: 'text' }, { name: 'contactEmail', type: 'email' },
      { ...choice('role', ['client', 'manager', 'warehouse', 'admin'], 'client'), access: { create: ({ req }) => hasRole(req, ['admin']), update: ({ req }) => hasRole(req, ['admin']) } },
      { name: 'active', type: 'checkbox', defaultValue: true, access: { create: ({ req }) => hasRole(req, ['admin']), update: ({ req }) => hasRole(req, ['admin']) } },
      { name: 'notifications', type: 'checkbox', defaultValue: true },
      { name: 'paymentBrand', type: 'text', access: { create: () => false, update: () => false } },
      { name: 'paymentLast4', type: 'text', access: { create: () => false, update: () => false } },
    ],
    hooks: {
      beforeChange: [({ data, operation, req }) => {
        if (operation === 'create' && !hasRole(req, ['admin']) && !(req.context.bootstrapAdmin && data.role === 'admin') && !(req.context.otpRegistration && data.role === 'client')) {
          throw new DomainError(403, 'REGISTRATION_DENIED', 'Создание аккаунта недоступно.')
        }
        return data
      }],
      beforeLogin: [({ user }) => { if (user.active === false || user.role === 'client') throw new DomainError(403, 'STAFF_LOGIN_ONLY', 'Для клиентов используется вход по SMS.'); return user }], afterChange: [audit],
    },
  },
  {
    slug: 'storage-items', labels: { singular: 'Вещь', plural: 'Вещи' }, admin: { useAsTitle: 'title', group: 'Склад' },
    access: { create: never, read: owned, update: staff, delete: never }, hooks: immutableWorkflow,
    fields: [owner, { name: 'internalID', type: 'text', unique: true, required: true }, { name: 'title', type: 'text', required: true },
      choice('type', ['box', 'item'], 'box'), { name: 'description', type: 'textarea' }, { name: 'contents', type: 'textarea' },
      { name: 'barcode', type: 'text', unique: true, index: true }, { name: 'seal', type: 'text' },
      choice('status', ['expected', 'received', 'stored', 'reserved', 'picked', 'returned'], 'expected'),
      { name: 'cell', type: 'relationship', relationTo: 'cells' }, { name: 'monthlyPrice', type: 'number', min: 0, required: true, defaultValue: 0 },
      { name: 'startedAt', type: 'date' }, { name: 'returnedAt', type: 'date' }, { name: 'blockReason', type: 'text' }, { name: 'media', type: 'relationship', relationTo: 'media', hasMany: true },
    ],
  },
  {
    slug: 'orders', labels: { singular: 'Заказ', plural: 'Заказы' }, admin: { useAsTitle: 'number', group: 'Клиенты и сотрудники' },
    access: { create: never, read: owned, update: staff, delete: never }, hooks: immutableWorkflow,
    fields: [owner, { name: 'number', type: 'text', required: true, unique: true }, choice('type', ['intake', 'return']),
      choice('status', ['created', 'received', 'placed', 'picking', 'ready', 'completed', 'cancelled'], 'created'),
      { name: 'items', type: 'relationship', relationTo: 'storage-items', hasMany: true, required: true },
      choice('fulfillment', ['pickup', 'courier'], 'pickup'), { name: 'address', type: 'textarea' }, { name: 'slot', type: 'text' },
      { name: 'assignee', type: 'relationship', relationTo: 'users' }, { name: 'picked', type: 'relationship', relationTo: 'storage-items', hasMany: true },
      { name: 'signature', type: 'relationship', relationTo: 'media' }, { name: 'evidence', type: 'relationship', relationTo: 'media', hasMany: true },
      { name: 'idempotencyKey', type: 'text', unique: true, required: true, access: { read: ({ req }) => hasRole(req, ['admin', 'manager']) } },
      { name: 'requestHash', type: 'text', access: { read: ({ req }) => hasRole(req, ['admin', 'manager']) } },
      { name: 'payment', type: 'relationship', relationTo: 'payments' },
      { name: 'details', type: 'json' }, { name: 'closedAt', type: 'date', index: true },
      { name: 'historySearch', type: 'text' }, { name: 'hasServices', type: 'checkbox', defaultValue: false },
    ],
  },
  internal('order-events', [owner, { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true }, { name: 'status', type: 'text', required: true }, { name: 'actor', type: 'relationship', relationTo: 'users' }, { name: 'note', type: 'text' }], owned),
  { slug: 'warehouses', admin: { useAsTitle: 'name', group: 'Склад' }, access: { create: admin, read: staff, update: admin, delete: never }, fields: [name, { name: 'address', type: 'textarea' }, { name: 'active', type: 'checkbox', defaultValue: true }] },
  { slug: 'cells', admin: { useAsTitle: 'name', group: 'Склад' }, access: { create: admin, read: staff, update: admin, delete: never }, hooks: { afterChange: [audit] }, fields: [name, { name: 'warehouse', type: 'relationship', relationTo: 'warehouses', required: true }, { name: 'zone', type: 'text' }, { name: 'barcode', type: 'text', unique: true, required: true }, { name: 'capacity', type: 'number', min: 1, defaultValue: 1, required: true }, { name: 'active', type: 'checkbox', defaultValue: true }] },
  { slug: 'tariffs', admin: { useAsTitle: 'name', group: 'Коммерция' }, access: { create: admin, read: ({ req }) => { if (hasRole(req, ['admin', 'manager'])) return true; const user = userOf(req); return user && user.active !== false ? { active: { equals: true } } : false }, update: admin, delete: never }, hooks: { afterChange: [audit] }, fields: [name, { name: 'code', type: 'text', unique: true, required: true }, choice('kind', ['storage', 'subscription'], 'storage'), choice('itemType', ['box', 'item'], 'box'), { name: 'testOnly', type: 'checkbox', defaultValue: false }, { name: 'monthlyPrice', type: 'number', min: 0, required: true }, { name: 'itemLimit', type: 'number', min: 1, required: true }, { name: 'rules', type: 'textarea' }, { name: 'active', type: 'checkbox', defaultValue: false }] },
  { slug: 'subscriptions', admin: { group: 'Коммерция' }, access: { create: never, read: officeOwned, update: never, delete: never }, hooks: { afterChange: [audit] }, fields: [owner, { name: 'tariff', type: 'relationship', relationTo: 'tariffs', required: true }, choice('status', ['pending', 'active', 'paused', 'cancelled'], 'pending'), { name: 'nextChargeAt', type: 'date' }, { name: 'providerCustomerID', type: 'text', access: { read: ({ req }) => hasRole(req, ['admin', 'manager']) } }] },
  { ...internal('payments', [owner, { name: 'amount', type: 'number', min: 0, required: true }, choice('status', ['pending', 'paid', 'failed', 'refunded'], 'pending'), { name: 'provider', type: 'text' }, { name: 'providerID', type: 'text', unique: true }, { name: 'idempotencyKey', type: 'text', unique: true }, { name: 'order', type: 'relationship', relationTo: 'orders' }, { name: 'tariff', type: 'relationship', relationTo: 'tariffs' }, { name: 'checkout', type: 'json' }, { name: 'receiptURL', type: 'text' }, { name: 'paidAt', type: 'date' }], officeOwned), hooks: { afterChange: [audit] } },
  { slug: 'support-tickets', admin: { useAsTitle: 'subject', group: 'Поддержка' }, access: { create: never, read: supportOwned, update: supportOffice, delete: never }, hooks: { beforeChange: [({ data, originalDoc, operation }) => {
    if (operation === 'update') for (const key of ['owner', 'type', 'order', 'item', 'attachments', 'details', 'idempotencyKey']) {
      if (data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key])) throw new DomainError(403, 'TICKET_LINKS_IMMUTABLE', 'Связи обращения с клиентом, вещью и вложениями менять нельзя.')
    }
    return data
  }], afterChange: [audit] }, fields: [owner, choice('type', ['technical', 'incident']), { name: 'details', type: 'json' }, { name: 'idempotencyKey', type: 'text', unique: true }, { name: 'subject', type: 'text', required: true }, choice('status', ['submitted', 'in_progress', 'resolved', 'rejected', 'answered'], 'submitted'), { name: 'closeReason', type: 'textarea' }, { name: 'order', type: 'relationship', relationTo: 'orders' }, { name: 'item', type: 'relationship', relationTo: 'storage-items' }, { name: 'attachments', type: 'relationship', relationTo: 'media', hasMany: true }] },
  internal('support-messages', [owner, { name: 'ticket', type: 'relationship', relationTo: 'support-tickets', required: true, index: true }, { name: 'author', type: 'relationship', relationTo: 'users', required: true }, choice('authorRole', ['client', 'support']), { name: 'text', type: 'textarea', required: true }, { name: 'idempotencyKey', type: 'text', unique: true }], supportMessages),
  internal('integration-events', [{ name: 'key', type: 'text', required: true, unique: true }, { name: 'provider', type: 'text', required: true }, choice('status', ['pending', 'completed', 'failed'], 'pending'), { name: 'externalID', type: 'text' }, { name: 'entityID', type: 'text' }, { name: 'errorCode', type: 'text' }]),
  internal('audit-log', [{ name: 'actor', type: 'relationship', relationTo: 'users' }, { name: 'entity', type: 'text', required: true }, { name: 'entityID', type: 'text', required: true }, { name: 'action', type: 'text', required: true }, { name: 'changedFields', type: 'text' }], admin),
  internal('otp-challenges', [{ name: 'phoneKey', type: 'text', required: true, index: true }, { name: 'ipKey', type: 'text', required: true, index: true }, { name: 'hash', type: 'text', required: true }, { name: 'expiresAt', type: 'date', required: true }, { name: 'attempts', type: 'number', defaultValue: 0, required: true }, { name: 'consumed', type: 'checkbox', defaultValue: false }], never),
  {
    slug: 'media', admin: { group: 'Склад', useAsTitle: 'filename' }, access: { create: ({ req }) => hasRole(req, ['client', 'warehouse', 'manager', 'admin']), read: ({ req }) => hasRole(req, ['warehouse']) ? { purpose: { not_equals: 'support' } } : hasRole(req, ['admin', 'manager']) ? { supportType: { not_equals: 'technical' } } : owned({ req }), update: never, delete: admin },
    upload: { mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'], disableLocalStorage: true, filesRequiredOnCreate: true },
    fields: [owner, { name: 'supportType', type: 'select', options: ['incident', 'technical'], defaultValue: 'incident' }, { name: 'purpose', type: 'select', options: ['intake', 'return', 'signature', 'document', 'support'], required: true }],
    hooks: { beforeValidate: [({ req, data }) => {
      if (req.user?.role === 'client' && data) {
        if (data.purpose !== 'support') throw new DomainError(403, 'SUPPORT_FILES_ONLY', 'Клиент может загружать только вложения обращения.')
        data.owner = req.user.id
      }
      return data
    }] },
  },
]
