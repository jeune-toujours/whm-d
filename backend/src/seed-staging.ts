import { getPayload } from 'payload'
import { randomBytes, randomUUID } from 'node:crypto'
import config from './payload.config'
import { simulationsEnabled } from './simulations'

if (!simulationsEnabled()) throw new Error('Test fixtures require APP_ENV=staging and SIMULATE_INTEGRATIONS=true')
const payload = await getPayload({ config })
const phone = process.env.STAGING_TEST_PHONE || '+79990000001'
let client = (await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { phone: { equals: phone } } })).docs[0]
if (!client) client = await payload.create({ collection: 'users', overrideAccess: true, context: { otpRegistration: true }, data: { email: `${randomUUID()}@client.whm.invalid`, password: randomBytes(48).toString('base64url'), phone, firstName: 'Тестовый', lastName: 'Клиент', role: 'client', active: true } })
if (client.role !== 'client') throw new Error('Fixture phone is not a client')
const catalog = [
  { code: 'test-box-s', name: 'Коробка S', monthlyPrice: 490, itemType: 'box' },
  { code: 'test-box-m', name: 'Коробка M', monthlyPrice: 790, itemType: 'box' },
  { code: 'test-box-l', name: 'Коробка L', monthlyPrice: 1190, itemType: 'box' },
  { code: 'test-box-xl', name: 'Коробка XL', monthlyPrice: 1690, itemType: 'box' },
  { code: 'test-bike', name: 'Велосипед', monthlyPrice: 1490, itemType: 'item' },
  { code: 'test-ski', name: 'Лыжи', monthlyPrice: 790, itemType: 'item' },
  { code: 'test-suitcase', name: 'Чемодан', monthlyPrice: 890, itemType: 'item' },
  { code: 'test-picture', name: 'Картина', monthlyPrice: 1290, itemType: 'item' },
] as const
for (const t of catalog) {
  if (!(await payload.count({ collection: 'tariffs', overrideAccess: true, where: { code: { equals: t.code } } })).totalDocs) await payload.create({ collection: 'tariffs', overrideAccess: true, data: { ...t, kind: 'storage', testOnly: true, active: true, itemLimit: 1, rules: 'Тестовые данные staging. Коммерческий тариф не утверждён.' } })
}
for (const [code, name, monthlyPrice, itemLimit] of [['basic', 'Базовый', 990, 4], ['standard', 'Стандарт', 1990, 10], ['premium', 'Премиум', 3490, 25]] as const) {
  const testCode = `test-plan-${code}`
  if (!(await payload.count({ collection: 'tariffs', overrideAccess: true, where: { code: { equals: testCode } } })).totalDocs) await payload.create({ collection: 'tariffs', overrideAccess: true, data: { code: testCode, name, kind: 'subscription', itemType: 'box', monthlyPrice, itemLimit, testOnly: true, active: true, rules: 'Тестовый переход тарифа через симуляцию оплаты. Автосписание и календарь начислений не включены.' } })
}
let warehouse = (await payload.find({ collection: 'warehouses', overrideAccess: true, limit: 1, where: { name: { equals: 'Тестовый склад WHM' } } })).docs[0]
if (!warehouse) warehouse = await payload.create({ collection: 'warehouses', overrideAccess: true, data: { name: 'Тестовый склад WHM', address: 'Виртуальный склад для проверки staging', active: true } })
const cells = []
for (let i = 1; i <= 8; i++) {
  const barcode = `TEST-CELL-A-${String(i).padStart(2, '0')}`
  let cell = (await payload.find({ collection: 'cells', overrideAccess: true, limit: 1, where: { barcode: { equals: barcode } } })).docs[0]
  if (!cell) cell = await payload.create({ collection: 'cells', overrideAccess: true, data: { name: `A-${String(i).padStart(2, '0')}`, barcode, warehouse: warehouse.id, zone: 'Тестовая зона A', capacity: 10, active: true } })
  cells.push(cell)
}
const fixtures = [
  { internalID: 'TEST-DEMO-001', title: 'Коробка M', type: 'box', description: 'Тестовые книги и документы', monthlyPrice: 790, contents: 'Книги\nПапка с документами' },
  { internalID: 'TEST-DEMO-002', title: 'Коробка S', type: 'box', description: 'Тестовая сезонная одежда', monthlyPrice: 490, contents: 'Куртка\nСвитер' },
  { internalID: 'TEST-DEMO-003', title: 'Велосипед', type: 'item', description: 'Тестовый отдельный предмет', monthlyPrice: 1490, contents: '' },
] as const
for (const [index, item] of fixtures.entries()) {
  if (!(await payload.count({ collection: 'storage-items', overrideAccess: true, where: { internalID: { equals: item.internalID } } })).totalDocs) await payload.create({ collection: 'storage-items', overrideAccess: true, context: { workflow: true }, data: { ...item, owner: client.id, status: 'stored', cell: cells[index].id, barcode: `TEST-ITEM-${index + 1}`, seal: item.type === 'box' ? `TEST-SEAL-${index + 1}` : undefined, startedAt: new Date().toISOString() } })
}
console.log('Staging fixtures ready: test client, 11 tariffs, 8 cells, 3 sample items. Existing data preserved.')
await payload.destroy()
process.exit(0)
