import { randomUUID } from 'node:crypto'
import type { PayloadRequest, Where } from 'payload'
import { endpoint, body, json, staffUser, transaction } from './http'
import { hasRole } from './access'
import { DomainError, relationID, text } from './domain'
import { uuid, requestKey, fingerprint } from './ordering'
import { reconcileInventory, observedCodes, accountingChanged, inventoryLabels, type InventoryItem } from './inventory-domain'
import type { InventoryDetail, InventoryOperation, InventoryCheck } from './inventory-types'

const manager = (req: PayloadRequest) => { staffUser(req); if (!hasRole(req, ['manager', 'admin'])) throw new DomainError(403, 'MANAGER_ONLY', 'Запуск инвентаризации доступен менеджеру.') }
const actorName = (req: PayloadRequest) => `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || req.user!.email
const snapshot = (item: any): InventoryItem => ({ id: item.id, internalID: item.internalID, title: item.title, barcode: item.barcode || '', status: item.status, cellID: relationID(item.cell) })
const label = (status: string) => inventoryLabels[status as keyof typeof inventoryLabels] || status
const expected = (row: any): InventoryItem[] => Array.isArray(row.expectedItems) ? row.expectedItems : []
const sessionDTO = (s: any): InventoryOperation => ({ id: s.id, number: s.number, status: s.status, statusLabel: label(s.status), initiatorName: s.initiatorName, warehouseNames: s.warehouseNames, cellCount: s.cellCount, checkedCount: s.checkedCount, discrepancyCount: s.discrepancyCount, startedAt: s.startedAt, completedAt: s.completedAt })
const checkDTO = (row: any): InventoryCheck => ({ id: row.id, cellID: relationID(row.cell), cellLabel: row.cellLabel, cellBarcode: row.cellBarcode, warehouseID: row.warehouseID, warehouseName: row.warehouseName, zone: row.zone || '', status: row.status, statusLabel: label(row.status), expectedItems: expected(row), observedCodes: row.observedCodes || [], observedItems: row.observedItems || [], discrepancies: row.discrepancies || [], comment: row.comment || '', checkedByID: relationID(row.checkedBy), checkedByName: row.checkedByName || '', checkedAt: row.checkedAt, accountingChanged: Boolean(row.accountingChanged) })
async function rows(req: PayloadRequest, id: string) {
  return (await req.payload.find({ collection: 'inventory-session-cells', req, overrideAccess: false, depth: 0, pagination: false, sort: 'cellLabel', where: { session: { equals: id } } })).docs
}
async function detail(req: PayloadRequest, id: string): Promise<InventoryDetail> {
  const [operation, cells] = await Promise.all([
    req.payload.findByID({ collection: 'inventory-sessions', id, req, overrideAccess: false, depth: 0 }), rows(req, id),
  ])
  return { ok: true, operation: sessionDTO(operation), cells: cells.map(checkDTO) }
}
const pageOf = (value: string | null) => Math.max(1, Math.min(100000, Number.parseInt(value || '1', 10) || 1))

export const inventoryEndpoints = [
  endpoint('/v1/inventory/cells', 'get', async req => {
    staffUser(req)
    const query = new URL(req.url!).searchParams, search = text(query.get('search'), 100), warehouseID = query.get('warehouseID'), zone = text(query.get('zone'), 100)
    const filters: Where[] = []
    if (search) filters.push({ or: [{ name: { contains: search } }, { barcode: { contains: search } }, { zone: { contains: search } }] })
    if (warehouseID) filters.push({ warehouse: { equals: uuid(warehouseID) } })
    if (zone) filters.push({ zone: { equals: zone } })
    const [catalog, warehouses] = await Promise.all([
      req.payload.find({ collection: 'cells', req, overrideAccess: false, depth: 1, sort: 'name', page: pageOf(query.get('page')), limit: 40, where: filters.length ? { and: filters } : undefined }),
      req.payload.find({ collection: 'warehouses', req, overrideAccess: false, depth: 0, pagination: false, sort: 'name' }),
    ])
    const active = catalog.docs.length ? await req.payload.find({ collection: 'inventory-session-cells', req, overrideAccess: false, depth: 1, pagination: false, where: { and: [{ active: { equals: true } }, { cell: { in: catalog.docs.map(c => c.id) } }] } }) : { docs: [] }
    const byCell = new Map(active.docs.map(row => [relationID(row.cell), row]))
    return json({ ok: true, canCreate: hasRole(req, ['admin', 'manager']), page: catalog.page, totalPages: catalog.totalPages, totalDocs: catalog.totalDocs, warehouses: warehouses.docs.map(w => ({ id: w.id, name: w.name })), cells: catalog.docs.map(cell => {
      const busy = byCell.get(cell.id), operation = busy && typeof busy.session === 'object' ? busy.session : null
      return { id: cell.id, name: cell.name, barcode: cell.barcode, zone: cell.zone || '', warehouseID: relationID(cell.warehouse), warehouseName: typeof cell.warehouse === 'object' ? cell.warehouse.name : '', active: cell.active, inventoryID: busy ? relationID(busy.session) : null, inventoryNumber: operation?.number || null }
    }) })
  }),
  endpoint('/v1/inventory', 'get', async req => {
    staffUser(req)
    const query = new URL(req.url!).searchParams, state = query.get('state') || 'open'
    const where: Where | undefined = state === 'open' ? { status: { equals: 'in_progress' } } : state === 'closed' ? { status: { not_equals: 'in_progress' } } : undefined
    const result = await req.payload.find({ collection: 'inventory-sessions', req, overrideAccess: false, depth: 0, limit: 20, page: pageOf(query.get('page')), sort: '-createdAt', where })
    return json({ ok: true, canCreate: hasRole(req, ['admin', 'manager']), operations: result.docs.map(sessionDTO), page: result.page, totalPages: result.totalPages, totalDocs: result.totalDocs })
  }),
  endpoint('/v1/inventory', 'post', async req => {
    manager(req)
    const data = await body(req)
    if (!Array.isArray(data.cellIDs) || !data.cellIDs.length || data.cellIDs.length > 200) throw new DomainError(400, 'INVALID_CELLS', 'Выберите от 1 до 200 ячеек.')
    const cellIDs = [...new Set(data.cellIDs.map(value => uuid(value).toLowerCase()))].sort(), key = requestKey(req), hash = fingerprint(cellIDs)
    return json(await transaction(req, [`inventory-key:${key}`, ...cellIDs.map(id => `inventory-cell:${id}`)], async () => {
      const previous = await req.payload.find({ collection: 'inventory-sessions', req, overrideAccess: true, depth: 0, limit: 1, where: { idempotencyKey: { equals: key } } })
      if (previous.docs[0]) {
        if (previous.docs[0].requestHash !== hash) throw new DomainError(409, 'KEY_REUSED', 'Ключ уже использован для другого набора ячеек.')
        return detail(req, previous.docs[0].id)
      }
      const cells = await req.payload.find({ collection: 'cells', req, overrideAccess: false, depth: 1, pagination: false, where: { id: { in: cellIDs } } })
      if (cells.docs.length !== cellIDs.length) throw new DomainError(400, 'INVALID_CELLS', 'Одна из выбранных ячеек не существует или недоступна.')
      const busy = await req.payload.find({ collection: 'inventory-session-cells', req, overrideAccess: true, depth: 0, pagination: false, where: { and: [{ active: { equals: true } }, { cell: { in: cellIDs } }] } })
      if (busy.docs.length) throw new DomainError(409, 'INVENTORY_CONFLICT', `Уже есть открытая инвентаризация: ${busy.docs.map(c => c.cellLabel).join(', ')}. Обновите каталог.`)
      // One unpaginated query defines the immutable contents snapshot. Ordinary
      // placement/pick/handover continues throughout the later physical count.
      const items = await req.payload.find({ collection: 'storage-items', req, overrideAccess: true, depth: 0, pagination: false, where: { and: [{ cell: { in: cellIDs } }, { status: { not_equals: 'returned' } }] } })
      const startedAt = new Date().toISOString()
      const session = await req.payload.create({ collection: 'inventory-sessions', req, overrideAccess: true, data: { number: `INV-${startedAt.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`, initiator: req.user!.id, initiatorName: actorName(req), warehouseNames: [...new Set(cells.docs.map(c => typeof c.warehouse === 'object' ? c.warehouse.name : relationID(c.warehouse)))].join(', '), status: 'in_progress', cellCount: cellIDs.length, checkedCount: 0, discrepancyCount: 0, startedAt, idempotencyKey: key, requestHash: hash } })
      for (const cell of cells.docs) await req.payload.create({ collection: 'inventory-session-cells', req, overrideAccess: true, data: { session: session.id, cell: cell.id, cellLabel: cell.name, cellBarcode: cell.barcode, warehouseID: relationID(cell.warehouse), warehouseName: typeof cell.warehouse === 'object' ? cell.warehouse.name : relationID(cell.warehouse), zone: cell.zone || '', active: true, status: 'pending', expectedItems: items.docs.filter(i => relationID(i.cell) === cell.id).map(snapshot) } })
      return detail(req, session.id)
    }))
  }),
  endpoint('/v1/inventory/:id', 'get', async req => { staffUser(req); return json(await detail(req, uuid(req.routeParams?.id))) }),
  endpoint('/v1/inventory/:id/cells/:checkID', 'post', async req => {
    staffUser(req)
    const id = uuid(req.routeParams?.id), checkID = uuid(req.routeParams?.checkID), data = await body(req), codes = observedCodes(data.observedCodes)
    if (data.comment !== undefined && (typeof data.comment !== 'string' || data.comment.length > 2000)) throw new DomainError(400, 'INVALID_COMMENT', 'Комментарий должен быть не длиннее 2000 символов.')
    const comment = text(data.comment, 2000), key = requestKey(req), hash = fingerprint({ codes, comment })
    return json(await transaction(req, [`inventory-session:${id}`, `inventory-check-key:${key}`], async () => {
      const session = await req.payload.findByID({ collection: 'inventory-sessions', id, req, overrideAccess: false, depth: 0 })
      const checks = await rows(req, id), check = checks.find(row => row.id === checkID)
      if (!check) throw new DomainError(404, 'NOT_FOUND', 'Проверка ячейки не найдена.')
      if (check.status !== 'pending') {
        if (check.checkKey === key && check.checkHash === hash) return detail(req, id)
        throw new DomainError(409, 'CHECK_CLOSED', 'Результат уже зафиксирован и не может быть перезаписан.')
      }
      if (session.status !== 'in_progress') throw new DomainError(409, 'INVENTORY_CLOSED', 'Инвентаризация завершена.')
      const reused = await req.payload.find({ collection: 'inventory-session-cells', req, overrideAccess: true, limit: 1, depth: 0, where: { checkKey: { equals: key } } })
      if (reused.docs.length) throw new DomainError(409, 'KEY_REUSED', 'Ключ уже использован для другой проверки.')
      const cellID = relationID(check.cell)
      const [current, known] = await Promise.all([
        req.payload.find({ collection: 'storage-items', req, overrideAccess: true, depth: 0, pagination: false, where: { and: [{ cell: { equals: cellID } }, { status: { not_equals: 'returned' } }] } }),
        codes.length ? req.payload.find({ collection: 'storage-items', req, overrideAccess: true, depth: 0, pagination: false, where: { or: [{ barcode: { in: codes } }, { internalID: { in: codes } }, ...(expected(check).length ? [{ id: { in: expected(check).map(item => item.id) } }] : [])] } }) : Promise.resolve({ docs: [] }),
      ])
      const result = reconcileInventory(cellID, expected(check), codes, known.docs.map(snapshot), checks.flatMap(expected))
      if (result.discrepancies.length && !comment) throw new DomainError(400, 'COMMENT_REQUIRED', 'Опишите расхождение в комментарии.')
      await req.payload.update({ collection: 'inventory-session-cells', id: checkID, req, overrideAccess: true, data: { status: result.discrepancies.length ? 'discrepancy' : 'matched', observedCodes: codes, observedItems: result.actual, discrepancies: result.discrepancies, accountingAtCheck: current.docs.map(snapshot), accountingChanged: accountingChanged(expected(check), current.docs.map(snapshot)), comment, checkedBy: req.user!.id, checkedByName: actorName(req), checkedAt: new Date().toISOString(), checkKey: key, checkHash: hash } })
      const updated = await rows(req, id), checkedCount = updated.filter(row => row.status !== 'pending').length, discrepancyCount = updated.filter(row => row.status === 'discrepancy').length
      const completed = checkedCount === session.cellCount
      await req.payload.update({ collection: 'inventory-sessions', id, req, overrideAccess: true, data: { checkedCount, discrepancyCount, ...(completed ? { status: discrepancyCount ? 'completed_with_discrepancies' : 'completed', completedAt: new Date().toISOString() } : {}) } })
      if (completed) await req.payload.update({ collection: 'inventory-session-cells', req, overrideAccess: true, where: { session: { equals: id } }, data: { active: false } })
      return detail(req, id)
    }))
  }),
]
