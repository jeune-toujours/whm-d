import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileInventory, observedCodes, accountingChanged, type InventoryItem } from '../src/inventory-domain'
const item: InventoryItem = { id: 'one', internalID: 'WHM-1', title: 'Коробка', barcode: 'BAR-1', status: 'stored', cellID: 'A' }
test('empty cell and complete matching contents have no discrepancies', () => {
  assert.deepEqual(reconcileInventory('A', [], [], [], []).discrepancies, [])
  const result = reconcileInventory('A', [item], ['BAR-1', 'WHM-1'], [item], [item])
  assert.equal(result.actual.length, 1, 'Barcode and public ID cannot count one item twice')
  assert.deepEqual(result.discrepancies, [])
})
test('missing, unaccounted extra and wrong cell remain distinct and do not mutate snapshots', () => {
  const foreign = { ...item, id: 'two', barcode: 'BAR-2', internalID: 'WHM-2', cellID: 'B' }, before = JSON.stringify(item)
  const result = reconcileInventory('A', [item], ['UNKNOWN', 'BAR-2'], [foreign], [item, foreign])
  assert.deepEqual(result.discrepancies.map(d => d.type), ['extra', 'wrong_cell', 'missing'])
  assert.equal(result.discrepancies[1].expectedCellID, 'B')
  assert.equal(JSON.stringify(item), before)
})
test('physical count uses launch snapshot even after accounting moves an item', () => {
  const moved = { ...item, cellID: 'B', status: 'picked' }
  const result = reconcileInventory('A', [item], ['BAR-1'], [moved], [item])
  assert.deepEqual(result.discrepancies, [])
  assert.equal(result.actual[0].registeredCellID, 'B')
  assert.equal(accountingChanged([item], [moved]), true)
  assert.equal(accountingChanged([item], [{ ...item, title: 'Переименована' }]), false)
})
test('wrong cell refers to launch position when selected cells changed in accounting', () => {
  const result = reconcileInventory('B', [], ['BAR-1'], [{ ...item, cellID: 'B' }], [item])
  assert.equal(result.discrepancies[0].type, 'wrong_cell')
  assert.equal(result.discrepancies[0].expectedCellID, 'A')
})
test('observation normalization accepts empty counts and rejects malformed or excessive input', () => {
  assert.deepEqual(observedCodes([]), [])
  assert.deepEqual(observedCodes([' B ', 'A', 'B']), ['A', 'B'])
  for (const input of [undefined, {}, [1], [' '], ['x'.repeat(81)], Array(5001).fill('A')]) assert.throws(() => observedCodes(input))
})
