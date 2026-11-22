// Country code is displayed separately. Preserve overlong input as invalid;
// never silently truncate a pasted telephone number to a different number.
export function nationalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 && /^[78]/.test(digits) ? digits.slice(1) : digits;
}

export function formatNationalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8)].filter(Boolean).join(' ');
}

export function courierAddress(value, catalog = []) {
  const address = String(value || '').trim().replace(/\s+/g, ' ');
  const match = catalog.find(item => item.value.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim() === address.toLocaleLowerCase('ru-RU'));
  return { address: match?.value || address, valid: address.length >= 8 && address.length <= 500 && match?.inZone !== false, blocked: match?.inZone === false, manual: !match && address.length >= 8 };
}
