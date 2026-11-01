import type { InventoryItem, InventoryDiscrepancy } from './inventory-domain'
export type InventoryOperation = {
  id: string; number: string; status: string; statusLabel: string; initiatorName: string; warehouseNames: string;
  cellCount: number; checkedCount: number; discrepancyCount: number; startedAt: string; completedAt?: string | null;
}
export type InventoryCheck = {
  id: string; cellID: string; cellLabel: string; cellBarcode: string; warehouseID: string; warehouseName: string; zone: string;
  status: string; statusLabel: string; expectedItems: InventoryItem[]; observedCodes: string[];
  observedItems: Array<{ code: string; itemID: string | null; title: string; registeredCellID: string | null }>;
  discrepancies: InventoryDiscrepancy[]; comment: string; checkedByID: string; checkedByName: string; checkedAt?: string | null;
  accountingChanged: boolean;
}
export type InventoryDetail = { ok: true; operation: InventoryOperation; cells: InventoryCheck[] }
export type InventoryCellOption = { id: string; name: string; barcode: string; zone: string; warehouseID: string; warehouseName: string; active: boolean; inventoryID: string | null; inventoryNumber: string | null }
