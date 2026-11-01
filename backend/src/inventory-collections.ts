import type { CollectionConfig, Field } from 'payload'
import { staff, never } from './access'
import { audit } from './audit'

const readonly = { create: never, read: staff, update: never, delete: never }
const json = (name: string, label: string): Field => ({ name, label, type: 'json', required: true })
export const inventoryCollections: CollectionConfig[] = [
  {
    slug: 'inventory-sessions', labels: { singular: 'Инвентаризация', plural: 'Инвентаризации' },
    admin: { group: 'Склад', useAsTitle: 'number', defaultColumns: ['number', 'status', 'checkedCount', 'cellCount', 'createdAt'] },
    access: readonly, hooks: { afterChange: [audit] },
    fields: [
      { name: 'number', label: 'Номер', type: 'text', required: true, unique: true },
      { name: 'status', label: 'Статус', type: 'select', required: true, defaultValue: 'in_progress', options: [{ label: 'В работе', value: 'in_progress' }, { label: 'Завершена', value: 'completed' }, { label: 'Завершена с расхождениями', value: 'completed_with_discrepancies' }], index: true },
      { name: 'initiator', label: 'Инициатор', type: 'relationship', relationTo: 'users', required: true },
      { name: 'initiatorName', label: 'Инициатор при запуске', type: 'text', required: true },
      { name: 'warehouseNames', label: 'Склады при запуске', type: 'text', required: true },
      { name: 'cellCount', label: 'Всего ячеек', type: 'number', required: true },
      { name: 'checkedCount', label: 'Проверено ячеек', type: 'number', required: true, defaultValue: 0 },
      { name: 'discrepancyCount', label: 'Ячеек с расхождениями', type: 'number', required: true, defaultValue: 0 },
      { name: 'startedAt', label: 'Снимок учёта', type: 'date', required: true },
      { name: 'completedAt', label: 'Завершена', type: 'date' },
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: { hidden: true } },
      { name: 'requestHash', type: 'text', required: true, admin: { hidden: true } },
    ],
  },
  {
    slug: 'inventory-session-cells', labels: { singular: 'Проверка ячейки', plural: 'Проверки ячеек' },
    admin: { group: 'Склад', useAsTitle: 'cellLabel', defaultColumns: ['cellLabel', 'session', 'status', 'checkedAt'] },
    access: readonly, hooks: { afterChange: [audit] },
    indexes: [{ fields: ['session', 'cell'], unique: true }],
    fields: [
      { name: 'session', label: 'Инвентаризация', type: 'relationship', relationTo: 'inventory-sessions', required: true, index: true },
      { name: 'cell', label: 'Ячейка', type: 'relationship', relationTo: 'cells', required: true, index: true },
      { name: 'cellLabel', label: 'Адрес при запуске', type: 'text', required: true },
      { name: 'cellBarcode', label: 'Штрихкод ячейки при запуске', type: 'text', required: true },
      { name: 'warehouseID', type: 'text', required: true },
      { name: 'warehouseName', label: 'Склад при запуске', type: 'text', required: true },
      { name: 'zone', label: 'Зона при запуске', type: 'text' },
      { name: 'active', label: 'Ячейка участвует в открытой операции', type: 'checkbox', required: true, defaultValue: true, index: true },
      { name: 'status', label: 'Результат', type: 'select', required: true, defaultValue: 'pending', options: [{ label: 'Не проверена', value: 'pending' }, { label: 'Соответствует', value: 'matched' }, { label: 'Расхождение', value: 'discrepancy' }] },
      json('expectedItems', 'Ожидаемые вещи: снимок запуска'),
      { name: 'observedCodes', label: 'Фактически отмеченные коды', type: 'json' },
      { name: 'observedItems', label: 'Фактический список', type: 'json' },
      { name: 'discrepancies', label: 'Расхождения', type: 'json' },
      { name: 'accountingAtCheck', label: 'Учёт на момент проверки', type: 'json' },
      { name: 'accountingChanged', label: 'Учёт изменился с запуска', type: 'checkbox', defaultValue: false },
      { name: 'comment', label: 'Комментарий', type: 'textarea' },
      { name: 'checkedBy', label: 'Исполнитель', type: 'relationship', relationTo: 'users' },
      { name: 'checkedByName', label: 'Исполнитель при проверке', type: 'text' },
      { name: 'checkedAt', label: 'Время проверки', type: 'date' },
      { name: 'checkKey', type: 'text', unique: true, admin: { hidden: true } },
      { name: 'checkHash', type: 'text', admin: { hidden: true } },
    ],
  },
]
