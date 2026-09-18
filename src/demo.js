const STORAGE_KEY = 'whm-d-client-preview-v1';

export const plans = [
  { id: 'basic', title: 'Базовый', volume: 'до 4 коробок', limit: 4, price: 990 },
  { id: 'standard', title: 'Стандарт', volume: 'до 10 коробок', limit: 10, price: 1990 },
  { id: 'premium', title: 'Премиум', volume: 'до 25 коробок', limit: 25, price: 3490 }
];

const initialUnits = [
  { id: 'BX-104', type: 'box', title: 'Коробка L', description: 'Зимняя одежда, пледы', storedSince: '12 мая 2026', storedSinceLabel: '12 мая 2026', monthlyPrice: 590, status: 'stored', size: '80 × 60 × 40 см', seal: 'PL-832941', contents: ['Зимняя одежда', 'Пледы', 'Сезонная обувь'] },
  { id: 'BX-118', type: 'box', title: 'Коробка M', description: 'Книги и документы', storedSince: '28 июня 2026', storedSinceLabel: '28 июня 2026', monthlyPrice: 390, status: 'stored', size: '60 × 40 × 40 см', seal: 'PL-844120', contents: ['Книги', 'Документы'] },
  { id: 'IT-031', type: 'item', title: 'Велосипед', description: 'Городской велосипед', storedSince: '3 апреля 2026', storedSinceLabel: '3 апреля 2026', monthlyPrice: 850, status: 'stored', size: 'Отдельный предмет', seal: '—', contents: ['Велосипед', 'Замок'] },
  { id: 'IT-044', type: 'item', title: 'Лыжи', description: 'Комплект с палками', storedSince: '19 марта 2026', storedSinceLabel: '19 марта 2026', monthlyPrice: 490, status: 'stored', size: 'Отдельный предмет', seal: '—', contents: ['Лыжи', 'Палки', 'Чехол'] },
  { id: 'BX-122', type: 'box', title: 'Коробка M', description: 'Посуда и декор', storedSince: '7 июля 2026', storedSinceLabel: '7 июля 2026', monthlyPrice: 390, status: 'stored', size: '60 × 40 × 40 см', seal: 'PL-861120', contents: ['Посуда', 'Предметы декора'], lockReason: 'Сейчас на инвентаризации' }
];

function nextChargeDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 1);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function createDemo(scenario = 'standard') {
  const now = new Date();
  const visit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const units = scenario === 'empty' ? [] : structuredClone(initialUnits);
  return {
    version: 1,
    scenario,
    units,
    activeOrder: scenario === 'empty' ? null : {
      id: 'WHM-S-2114', type: 'storage', fulfillment: 'courier', status: 'courier',
      visitAt: visit.toISOString(), visitWindow: '16:00–18:00',
      address: 'Москва, ул. Большая Дмитровка, 21', addressHint: 'Подъезд 2',
      currentMonthlyStorage: units.reduce((total, unit) => total + unit.monthlyPrice, 0),
      futureMonthlyStorage: units.reduce((total, unit) => total + unit.monthlyPrice, 0) + 590,
      history: [{ status: 'created', at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() }],
      items: [{ id: 'BX-NEW', name: 'Коробка L', note: 'Новый заказ', icon: 'box', status: 'Будет принято' }],
      documentAvailable: false
    },
    profile: {
      firstName: 'Анна', lastName: 'Соколова', phone: '+7 999 123-45-67', email: 'anna@example.com',
      planId: 'standard', monthlyPrice: 1990, nextChargeDate: nextChargeDate(),
      paymentMethod: { brand: 'Mastercard', last4: '4242' },
      recentPayments: [
        { id: 'PMT-3312', date: '1 августа 2026', amount: 1990, status: 'paid', hasReceipt: true },
        { id: 'PMT-3201', date: '1 июля 2026', amount: 1990, status: 'paid', hasReceipt: true },
        { id: 'PMT-3099', date: '12 июня 2026', amount: 990, status: 'refunded', hasReceipt: false }
      ]
    },
    tickets: [
      { id: 'SUP-2041', type: 'incident', shortDescription: 'Повреждена коробка при доставке', status: 'in_progress', updatedAt: '27 августа 2026', relatedOrderId: 'WHM-S-1842', messages: [
        { author: 'client', text: 'При получении заметила повреждение упаковки.', date: '25 августа 2026' },
        { author: 'support', text: 'Спасибо, мы проверяем инцидент.', date: '26 августа 2026' }
      ] }
    ]
  };
}

export function loadDemo() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (parsed?.version === 1 && Array.isArray(parsed.units) && parsed.profile) return parsed;
  } catch { /* private mode or stale data */ }
  return createDemo();
}

export function saveDemo(demo) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(demo)); } catch { /* preview still works in memory */ }
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('ru-RU').format(amount || 0) + ' ₽';
}

export function dashboardFrom(demo) {
  const order = demo.activeOrder;
  return {
    units: demo.units,
    activeOrders: order && order.status !== 'completed' && order.status !== 'cancelled' ? [{
      id: order.id, type: order.type === 'return' ? 'return' : 'storage',
      stage: order.status === 'courier' ? 'Курьер в пути' : order.status === 'assembling' ? 'Сборка на складе' : 'Заявка создана',
      nextEventLabel: order.visitWindow ? `Визит ${order.visitWindow}` : 'Подробности в заказе'
    }] : [],
    nextChargeDate: demo.profile.nextChargeDate
  };
}

export function profileFrom(demo) {
  return {
    ...demo.profile,
    hasStoredItems: demo.units.some(unit => unit.status === 'stored'),
    hasActiveOrders: Boolean(demo.activeOrder && !['completed', 'cancelled'].includes(demo.activeOrder.status))
  };
}

export function orderFromIntake(id, payload, demo) {
  const visit = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return {
    id, type: 'storage', fulfillment: payload.deliveryMode === 'self' ? 'pickup' : 'courier',
    status: payload.deliveryMode === 'self' ? 'warehouse_visit' : 'created',
    visitAt: visit.toISOString(), visitWindow: payload.logistics?.slot || '16:00–18:00',
    address: payload.logistics?.address || 'Склад WHM · Химки',
    warehouse: 'Склад WHM · Химки', warehouseAddress: 'Коммунальный проезд, 30',
    currentMonthlyStorage: demo.units.reduce((total, unit) => total + unit.monthlyPrice, 0),
    futureMonthlyStorage: payload.totals?.monthly || 0,
    history: [{ status: 'created', at: new Date().toISOString() }],
    items: payload.items.map((item) => ({ id: item.id, name: item.title, note: `${item.quantity} шт.`, icon: 'box', status: 'Будет принято' })),
    documentAvailable: false
  };
}

export function orderFromReturn(id, payload, demo) {
  const visit = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return {
    id, type: 'return', fulfillment: payload.method === 'courier' ? 'courier' : 'pickup', status: 'created',
    visitAt: visit.toISOString(), visitWindow: payload.delivery?.slot || '15:00–17:00',
    address: payload.delivery?.address?.address || 'Склад WHM — Север',
    currentMonthlyStorage: payload.billing?.currentMonthly || 0,
    futureMonthlyStorage: payload.billing?.futureMonthly || 0,
    history: [{ status: 'created', at: new Date().toISOString() }],
    items: payload.units.map((unit) => ({ id: unit.id, name: unit.title, note: unit.description, icon: unit.type === 'box' ? 'box' : 'bag', status: 'К возврату' })),
    documentAvailable: false
  };
}
