import { DomainError } from './domain'

export type InventoryItem = { id: string; internalID: string; title: string; barcode: string; status: string; cellID: string }
export type InventoryDiscrepancy = { type: 'missing' | 'extra' | 'wrong_cell'; code: string; itemID: string | null; title: string; expectedCellID: string | null }
export const inventoryLabels = { in_progress: 'В работе', completed: 'Завершена', completed_with_discrepancies: 'Завершена с расхождениями', pending: 'Не проверена', matched: 'Соответствует', discrepancy: 'Расхождение' }

export function observedCodes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 5000 || value.some(code => typeof code !== 'string' || !code.trim() || code.trim().length > 80)) {
    throw new DomainError(400, 'INVALID_OBSERVATIONS', 'Укажите фактические коды вещей: каждый от 1 до 80 символов.')
  }
  return [...new Set((value as string[]).map(code => code.trim()))].sort()
}
export const itemCode = (item: InventoryItem) => item.barcode || item.internalID
export function reconcileInventory(cellID: string, expected: InventoryItem[], codes: string[], known: InventoryItem[], sessionSnapshot: InventoryItem[]) {
  const seen = new Set<string>(), actual: Array<{ code: string; itemID: string | null; title: string; registeredCellID: string | null }> = [], discrepancies: InventoryDiscrepancy[] = []
  const byCode = (items: InventoryItem[], code: string) => items.find(i => i.barcode === code) || items.find(i => i.internalID === code)
  for (const code of codes) {
    const item = byCode(expected, code) || byCode(known, code)
    const identity = item?.id || `unknown:${code}`
    if (seen.has(identity)) continue
    seen.add(identity)
    actual.push({ code, itemID: item?.id || null, title: item?.title || 'Неучтённый предмет', registeredCellID: (item && known.find(current => current.id === item.id)?.cellID) || null })
    if (item && expected.some(i => i.id === item.id)) continue
    const expectedCellID = (item && sessionSnapshot.find(i => i.id === item.id)?.cellID) || item?.cellID || null
    discrepancies.push({ type: expectedCellID && expectedCellID !== cellID ? 'wrong_cell' : 'extra', code, itemID: item?.id || null, title: item?.title || 'Неучтённый предмет', expectedCellID })
  }
  for (const item of expected) if (!seen.has(item.id)) discrepancies.push({ type: 'missing', code: itemCode(item), itemID: item.id, title: item.title, expectedCellID: cellID })
  return { actual, discrepancies }
}
export function accountingChanged(expected: InventoryItem[], current: InventoryItem[]) {
  const signature = (items: InventoryItem[]) => JSON.stringify(items.map(({ id, barcode, status, cellID }) => ({ id, barcode, status, cellID })).sort((a, b) => a.id.localeCompare(b.id)))
  return signature(expected) !== signature(current)
}
