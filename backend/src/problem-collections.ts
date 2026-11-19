import type { CollectionConfig } from 'payload'
import { never, staff } from './access'
import { audit } from './audit'

const access = { create: never, read: staff, update: never, delete: never }
export const problemCollections: CollectionConfig[] = [
  {
    slug: 'damage-reports', labels: { singular: 'Акт повреждения', plural: 'Акты повреждений' },
    admin: { group: 'Склад', useAsTitle: 'number', defaultColumns: ['number', 'status', 'orderNumber', 'itemLabel', 'createdAt'] },
    access, hooks: { afterChange: [audit] }, indexes: [{ fields: ['order', 'item'], unique: true }],
    fields: [
      { name: 'number', label: 'Номер', type: 'text', required: true, unique: true },
      { name: 'status', label: 'Статус кейса', type: 'select', required: true, defaultValue: 'pending', index: true, options: [{ label: 'Внутренняя фиксация', value: 'pending' }, { label: 'Клиент уведомлён', value: 'published' }] },
      { name: 'owner', label: 'Клиент', type: 'relationship', relationTo: 'users', required: true },
      { name: 'order', label: 'Приёмка', type: 'relationship', relationTo: 'orders', required: true, index: true },
      { name: 'item', label: 'Вещь', type: 'relationship', relationTo: 'storage-items', required: true, index: true },
      { name: 'orderNumber', label: 'Номер заказа при фиксации', type: 'text', required: true },
      { name: 'itemLabel', label: 'Вещь при фиксации', type: 'text', required: true },
      { name: 'description', label: 'Опись повреждения', type: 'textarea', required: true },
      { name: 'discoveredAtIntake', label: 'Обнаружено при поступлении', type: 'checkbox', required: true, defaultValue: true },
      { name: 'evidence', label: 'Материалы', type: 'relationship', relationTo: 'media', hasMany: true },
      { name: 'createdBy', label: 'Зафиксировал', type: 'relationship', relationTo: 'users', required: true },
      { name: 'createdByName', label: 'Имя сотрудника при фиксации', type: 'text', required: true },
      { name: 'ticket', label: 'Обращение после подтверждения', type: 'relationship', relationTo: 'support-tickets' },
      { name: 'publishedAt', label: 'Клиент уведомлён', type: 'date' },
      { name: 'publishedBy', label: 'Подтвердил кейс', type: 'relationship', relationTo: 'users' },
      { name: 'publishedByName', label: 'Имя при подтверждении', type: 'text' },
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: { hidden: true } },
      { name: 'requestHash', type: 'text', required: true, admin: { hidden: true } },
    ],
  },
]
