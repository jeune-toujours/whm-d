import { createHash, randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { DomainError, relationID, text, normalizePhone } from './domain'
import { simulationsEnabled } from './simulations'

// Prices below are staging fixtures from the archived wizard, never production rules.
export const testOptions = [
  { id: 'photos', title: 'Фотофиксация содержимого', description: 'Сфотографируем содержимое перед закрытием', price: 390, kind: 'once', cadence: 'разово', label: 'Фото' },
  { id: 'inventory', title: 'Опись вещей', description: 'Подготовим список содержимого', price: 490, kind: 'once', cadence: 'разово', label: 'Опись' },
  { id: 'materials', title: 'Упаковочные материалы', description: 'Коробки и защитные материалы', price: 990, kind: 'once', cadence: 'разово', label: 'Материалы', turnkeyOnly: true },
]
export const testAddresses = [
  { value: 'Москва, ул. Тверская, 18', inZone: true },
  { value: 'Москва, ул. Большая Дмитровка, 12', inZone: true },
  { value: 'Москва, Ленинградский проспект, 36', inZone: true },
  { value: 'Химки, Ленинградское шоссе, 5', inZone: false },
]
export const testSlots = ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00']
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const invalid = (message: string) => new DomainError(400, 'INVALID_REQUEST', message)
export function uuid(value: unknown) {
  const id = text(value, 40)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw invalid('Неверный идентификатор.')
  return id
}
export function requestKey(req: PayloadRequest) {
  const key = text(req.headers.get('idempotency-key'), 80)
  if (!key) throw invalid('Повторите запрос с ключом операции.')
  return `${req.user!.id}:${key}`
}
export async function checkoutConfiguration(req: PayloadRequest) {
  if (!simulationsEnabled()) throw new DomainError(503, 'LOGISTICS_NOT_CONFIGURED', 'Тарифы логистики ещё не настроены.')
  const warehouses = await req.payload.find({ collection: 'warehouses', req, overrideAccess: true, depth: 0, limit: 20, where: { active: { equals: true } } })
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(); date.setUTCDate(date.getUTCDate() + index + 2)
    const id = date.toISOString().slice(0, 10)
    return { id, label: new Date(`${id}T12:00:00Z`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }), short: new Date(`${id}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }), day: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), disabled: false, soldOut: false, slots: testSlots.map(label => ({ label, disabled: false })) }
  })
  return { simulation: true, dates, slots: testSlots, addresses: testAddresses, options: testOptions, insuranceRate: 0.0058, insuranceMinPremium: 100, turnkeyFee: 1490, courierFee: 890, returnFee: 1490, extraTripFee: 890, itemsPerTrip: 3, warehouses: warehouses.docs.map(w => ({ id: w.id, name: w.name, title: w.name, address: w.address || '', hours: 'Тестовый график: ежедневно, 09:00–21:00' })) }
}
export async function quoteOrder(req: PayloadRequest, kind: 'intake' | 'return', data: any) {
  const config = await checkoutConfiguration(req)
  if (!['pickup', 'courier'].includes(data.fulfillment)) throw invalid('Выберите способ передачи.')
  const warehouse = config.warehouses.find(w => w.id === data.warehouseID) || (!data.warehouseID ? config.warehouses[0] : null)
  if (!warehouse) throw invalid('Выберите доступный склад.')
  const date = text(data.date, 10), slot = text(data.slot, 30), address = text(data.address, 500)
  const scheduled = kind === 'return' || data.fulfillment === 'courier'
  if (scheduled && (!config.dates.some(d => d.id === date) || !testSlots.includes(slot))) throw invalid('Выберите доступные дату и время.')
  const phone = data.fulfillment === 'courier' ? normalizePhone(data.phone) : ''
  if (data.fulfillment === 'courier' && !testAddresses.some(a => a.inZone && a.value === address)) throw invalid('Для тестовой доставки выберите адрес из подсказок в зоне обслуживания.')
  const logistics = { fulfillment: data.fulfillment, warehouse, address: data.fulfillment === 'courier' ? address : warehouse.address, date, slot, visitAt: scheduled ? new Date(`${date}T${slot.slice(0, 5)}:00+03:00`).toISOString() : null, phone, apartment: text(data.apartment, 30), intercom: text(data.intercom, 30), entrance: text(data.entrance, 30), floor: text(data.floor, 30), comment: text(data.comment, 500) }
  const current = await req.payload.find({ collection: 'storage-items', req, overrideAccess: false, depth: 0, limit: 1000, where: { status: { in: ['stored', 'reserved', 'picked'] } } })
  const currentMonthly = current.docs.reduce((n, i) => n + i.monthlyPrice, 0)
  let lines: any[] = [], units: any[] = [], services: any[] = [], service = 'self', declaredValue = 0, insurancePremium = 0
  if (kind === 'intake') {
    if (!['self', 'turnkey'].includes(data.service)) throw invalid('Выберите самостоятельную упаковку или под ключ.')
    service = data.service
    if (service === 'turnkey' && data.fulfillment !== 'courier') throw invalid('Под ключ требует выезд курьера.')
    if (!Array.isArray(data.items) || !data.items.length || data.items.length > 20) throw invalid('Выберите вещи.')
    for (const raw of data.items) {
      const quantity = Number(raw.quantity), tariffID = uuid(raw.tariffID)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || lines.some(l => l.tariffID === tariffID)) throw invalid('Неверное количество или повторная позиция.')
      const tariff = await req.payload.findByID({ collection: 'tariffs', id: tariffID, req, overrideAccess: false, depth: 0 })
      if (!tariff.active || tariff.kind !== 'storage' || !tariff.testOnly) throw invalid('Тестовый тариф недоступен.')
      lines.push({ tariffID, quantity, title: tariff.name, type: tariff.itemType, monthlyPrice: tariff.monthlyPrice, description: text(raw.description, 500) })
    }
    if (lines.reduce((n, l) => n + l.quantity, 0) > 50) throw invalid('Не более 50 вещей в заявке.')
    if (data.oversize?.length) throw invalid('Для негабаритной вещи сначала нужен индивидуальный расчёт менеджера.')
    if (data.options !== undefined && (!Array.isArray(data.options) || new Set(data.options).size !== data.options.length)) throw invalid('Неверные услуги.')
    services = (data.options || []).map((code: string) => {
      const option = testOptions.find(o => o.id === code && (!o.turnkeyOnly || service === 'turnkey'))
      if (!option) throw invalid('Услуга недоступна.')
      return { ...option, status: 'Заказана' }
    })
    declaredValue = Number(data.insuranceValue || 0)
    if (!Number.isFinite(declaredValue) || declaredValue < 0 || declaredValue > 100_000_000 || (declaredValue > 0 && declaredValue < 1000)) throw invalid('Проверьте объявленную стоимость.')
    insurancePremium = declaredValue ? Math.max(config.insuranceMinPremium, Math.round(declaredValue * config.insuranceRate)) : 0
    if (declaredValue) services.push({ id: 'insurance', title: 'Страхование (симуляция)', price: insurancePremium, kind: 'monthly', status: 'Заказана', insuredValue: declaredValue })
  } else {
    if (!Array.isArray(data.itemIDs) || !data.itemIDs.length || data.itemIDs.length > 50) throw invalid('Выберите вещи для возврата.')
    const ids = data.itemIDs.map(uuid).sort()
    if (new Set(ids).size !== ids.length) throw invalid('Вещи не должны повторяться.')
    for (const id of ids) {
      const item = await req.payload.findByID({ collection: 'storage-items', id, req, overrideAccess: false, depth: 0 })
      const activeIntake = await req.payload.count({ collection: 'orders', req, overrideAccess: false, where: { and: [{ type: { equals: 'intake' } }, { status: { not_in: ['completed', 'cancelled'] } }, { items: { in: [id] } }] } })
      if (relationID(item.owner) !== req.user!.id || item.status !== 'stored' || item.blockReason || activeIntake.totalDocs) throw new DomainError(409, 'ITEM_UNAVAILABLE', 'Статус вещи изменился. Обновите список возврата.')
      units.push({ id: item.id, internalID: item.internalID, title: item.title, type: item.type, description: item.description || '', monthlyPrice: item.monthlyPrice, startedAt: item.startedAt, seal: item.seal, barcode: item.barcode, contents: item.contents })
    }
  }
  const quantity = kind === 'intake' ? lines.reduce((n, l) => n + l.quantity, 0) : units.length
  const monthly = kind === 'intake' ? lines.reduce((n, l) => n + l.quantity * l.monthlyPrice, 0) + insurancePremium : 0
  const selectedMonthly = units.reduce((n, i) => n + i.monthlyPrice, 0), trips = Math.ceil(quantity / config.itemsPerTrip)
  const deliveryPrice = kind === 'intake' ? service === 'turnkey' ? config.turnkeyFee : data.fulfillment === 'courier' ? config.courierFee : 0 : data.fulfillment === 'courier' ? config.returnFee + (trips - 1) * config.extraTripFee : 0
  const once = deliveryPrice + services.filter(s => s.kind === 'once').reduce((n, s) => n + s.price, 0)
  const input = { items: lines.map(l => ({ tariffID: l.tariffID, quantity: l.quantity, description: l.description })), itemIDs: units.map(i => i.id), service, fulfillment: logistics.fulfillment, warehouseID: warehouse.id, address, date, slot, phone, apartment: logistics.apartment, intercom: logistics.intercom, entrance: logistics.entrance, floor: logistics.floor, comment: logistics.comment, options: services.filter(s => s.id !== 'insurance').map(s => s.id), insuranceValue: declaredValue }
  const quote = { kind, input, lines, units, services, logistics, quantity, trips, monthly, once, amount: monthly + once, currentMonthly, futureMonthly: kind === 'return' ? Math.max(0, currentMonthly - selectedMonthly) : currentMonthly + monthly, deliveryPrice, subtype: units.length === current.docs.length ? 'full' : 'partial', simulation: true }
  return { ...quote, hash: fingerprint(quote) }
}
export async function commitQuotedOrder(req: PayloadRequest, quote: any, key: string, requestHash: string, paymentID?: string) {
  const old = (await req.payload.find({ collection: 'orders', req, overrideAccess: true, depth: 1, limit: 1, where: { idempotencyKey: { equals: key } } })).docs[0]
  if (old) { if (old.requestHash !== requestHash || relationID(old.owner) !== req.user!.id) throw new DomainError(409, 'KEY_REUSED', 'Ключ относится к другой заявке.'); return old }
  const context = { workflow: true }, ids: string[] = [], snapshots: any[] = []
  if (quote.kind === 'intake') {
    for (const line of quote.lines) for (let i = 0; i < line.quantity; i++) {
      const item = await req.payload.create({ collection: 'storage-items', req, overrideAccess: true, context, data: { owner: req.user!.id, internalID: `WHM-${randomUUID().slice(0, 8).toUpperCase()}`, title: line.title, type: line.type, description: line.description, status: 'expected', monthlyPrice: line.monthlyPrice } })
      ids.push(item.id); snapshots.push({ ...line, id: item.id, internalID: item.internalID })
    }
  } else {
    for (const unit of quote.units) {
      const item = await req.payload.findByID({ collection: 'storage-items', req, id: unit.id, overrideAccess: false, depth: 0 })
      if (item.status !== 'stored' || item.blockReason) throw new DomainError(409, 'ITEM_UNAVAILABLE', 'Вещь уже в возврате или недоступна.')
      await req.payload.update({ collection: 'storage-items', req, id: item.id, overrideAccess: true, context, data: { status: 'reserved' } }); ids.push(item.id); snapshots.push(unit)
    }
  }
  const order = await req.payload.create({ collection: 'orders', req, overrideAccess: true, context, depth: 1, data: { owner: req.user!.id, number: `WHM-${quote.kind === 'intake' ? 'S' : 'R'}-${randomUUID().slice(0, 8).toUpperCase()}`, type: quote.kind, status: 'created', items: ids, fulfillment: quote.logistics.fulfillment, address: quote.logistics.address, slot: quote.logistics.slot, idempotencyKey: key, requestHash, payment: paymentID, hasServices: quote.services.length > 0, historySearch: snapshots.map(i => [i.title, i.description, i.internalID].join(' ')).join(' ').toLocaleLowerCase('ru-RU'), details: { ...quote, units: snapshots, consentAt: new Date().toISOString(), version: 2 } } })
  await req.payload.create({ collection: 'order-events', req, overrideAccess: true, data: { owner: req.user!.id, order: order.id, status: 'created', actor: req.user!.id } })
  return order
}
