export function intakeInput(value) {
  const logistics = value.logistics || {};
  return { service:value.service, fulfillment:value.deliveryMode === 'self' ? 'pickup' : 'courier', items:value.items.map(i => ({ tariffID:i.id,quantity:i.quantity,description:i.description || '' })), options:value.options.map(o => o.id), insuranceValue:value.insurance?.declaredValue || 0, oversize:value.oversizeItems, warehouseID:logistics.warehouse?.id, address:logistics.address || '', date:logistics.date || '', slot:logistics.slot || '', phone:logistics.phone || '', apartment:logistics.apartment || '', intercom:logistics.intercom || '', entrance:logistics.entrance || '', floor:logistics.floor || '', comment:logistics.comment || '', consent:value.consent === true };
}
export function returnInput(value) {
  const delivery=value.delivery || {}, address=delivery.address || {};
  return { itemIDs:value.selectedIds, fulfillment:value.method, warehouseID:address.warehouse?.id, address:address.address || '', date:delivery.date || '', slot:delivery.slot || '', phone:address.phone || '', apartment:address.apartment || '', intercom:address.intercom || '', entrance:address.entrance || '', floor:address.floor || '', comment:address.comment || '', consent:value.consent === true };
}
export async function operationKey(id, payload) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
  return `${id}:${Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,32)}`;
}
export function historyDates(order) {
  const date=value=>value ? new Date(value).toLocaleString('ru-RU') : '';
  return { ...order, createdAt:date(order.createdAt), completedAt:date(order.completedAt), actualAt:date(order.actualAt), items:order.items.map(i=>({ ...i, storedSince:i.storedSince ? new Date(i.storedSince).toLocaleDateString('ru-RU') : '', returnedAt:i.returnedAt ? new Date(i.returnedAt).toLocaleDateString('ru-RU') : '' })), timeline:order.timeline.map(t=>({ ...t,date:date(t.date) })) };
}
