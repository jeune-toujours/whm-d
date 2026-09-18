<script>
  import { tick } from 'svelte';

  /*
   * WHM-11 — История хранения и заказов
   *
   * Автономный Svelte 5-компонент на основе UI-фреймворка WHM-3 / WHM-9.
   *
   * Интеграционные hooks:
   * - onBack()
   * - onOpenActiveOrder(activeOrder)
   * - onOpenItem(item, { archived, order })
   * - onOpenReceipt(order)
   * - onOpenDocument(service, order)
   * - onOpenSupport({ orderId, orderNumber })
   * - onOpenRelatedOrder(orderId)
   * - onRetry()
   * - onTrack(eventName, payload)
   */

  const demoOrders = [
    {
      id: 'return-2048',
      number: 'WHM-R-2048',
      type: 'return',
      subtype: 'partial',
      status: 'completed',
      createdAt: '17 августа 2026, 14:20',
      completedAt: '20 августа 2026, 16:42',
      completedYear: 2026,
      completedTimestamp: 1787244120000,
      method: 'courier',
      methodLabel: 'Доставка курьером',
      address: 'Москва, ул. Большая Дмитровка, 21',
      plannedAt: '20 августа, 15:00–17:00',
      actualAt: '20 августа 2026, 16:42',
      trips: 1,
      storageAfter: 980,
      sourceOrderId: 'intake-1842',
      relatedOrderIds: ['intake-1842'],
      items: [
        {
          id: 'BX-104',
          type: 'box',
          title: 'Коробка L',
          description: 'Зимняя одежда, пледы',
          size: '80 × 60 × 40 см',
          storedSince: '12 мая 2026',
          returnedAt: '20 августа 2026',
          monthlyPrice: 590,
          currentStatus: 'returned',
          seal: 'PL-832941',
          archived: true
        },
        {
          id: 'IT-031',
          type: 'item',
          title: 'Городской велосипед',
          description: 'Чёрный, 28 дюймов',
          size: 'Отдельный предмет',
          storedSince: '12 мая 2026',
          returnedAt: '20 августа 2026',
          monthlyPrice: 850,
          currentStatus: 'returned',
          seal: '—',
          archived: true
        }
      ],
      services: [],
      financial: {
        storage: 0,
        delivery: 1490,
        materials: 0,
        services: [],
        discount: 0,
        refund: 0,
        paid: 1490,
        receiptAvailable: true
      },
      timeline: [
        { label: 'Заявка создана', date: '17 августа, 14:20' },
        { label: 'Передана на склад', date: '17 августа, 16:05' },
        { label: 'Вещи собраны', date: '19 августа, 18:10' },
        { label: 'Передано в доставку', date: '20 августа, 14:47' },
        { label: 'Передано вам', date: '20 августа, 16:42' },
        { label: 'Заказ завершён', date: '20 августа, 16:44' }
      ]
    },
    {
      id: 'intake-1842',
      number: 'WHM-S-1842',
      type: 'intake',
      status: 'completed',
      createdAt: '9 мая 2026, 11:04',
      completedAt: '12 мая 2026, 19:15',
      completedYear: 2026,
      completedTimestamp: 1778613300000,
      method: 'courier',
      methodLabel: 'Под ключ, курьером',
      address: 'Москва, ул. Большая Дмитровка, 21',
      plannedAt: '12 мая, 17:00–19:00',
      actualAt: '12 мая 2026, 18:26',
      trips: 2,
      currentCount: 4,
      returnedCount: 2,
      relatedOrderIds: ['return-2048', 'return-1921'],
      items: [
        {
          id: 'BX-104', type: 'box', title: 'Коробка L', description: 'Зимняя одежда, пледы',
          size: '80 × 60 × 40 см', storedSince: '12 мая 2026', returnedAt: '20 августа 2026',
          monthlyPrice: 590, currentStatus: 'returned', seal: 'PL-832941', archived: true,
          returnOrderId: 'return-2048'
        },
        {
          id: 'IT-031', type: 'item', title: 'Городской велосипед', description: 'Чёрный, 28 дюймов',
          size: 'Отдельный предмет', storedSince: '12 мая 2026', returnedAt: '20 августа 2026',
          monthlyPrice: 850, currentStatus: 'returned', seal: '—', archived: true,
          returnOrderId: 'return-2048'
        },
        {
          id: 'BX-118', type: 'box', title: 'Книги и документы', description: 'Книги, архив, папки',
          size: '60 × 40 × 40 см', storedSince: '12 мая 2026', returnedAt: '',
          monthlyPrice: 390, currentStatus: 'stored', seal: 'PL-832955', archived: false
        },
        {
          id: 'IT-044', type: 'item', title: 'Лыжи и палки', description: 'Комплект в чехле',
          size: 'Отдельный предмет', storedSince: '12 мая 2026', returnedAt: '',
          monthlyPrice: 490, currentStatus: 'stored', seal: 'PL-832960', archived: false
        },
        {
          id: 'BX-121', type: 'box', title: 'Посуда и декор', description: 'Хрупкие предметы',
          size: '60 × 40 × 40 см', storedSince: '12 мая 2026', returnedAt: '',
          monthlyPrice: 390, currentStatus: 'stored', seal: 'PL-832964', archived: false
        },
        {
          id: 'BX-122', type: 'box', title: 'Спортивная экипировка', description: 'Форма и защитный инвентарь',
          size: '80 × 60 × 40 см', storedSince: '12 мая 2026', returnedAt: '',
          monthlyPrice: 590, currentStatus: 'stored', seal: 'PL-832967', archived: false
        }
      ],
      services: [
        { id: 'photo', title: 'Фотофиксация', status: 'Выполнена', price: 690, date: '12 мая 2026', material: true },
        { id: 'inventory', title: 'Опись вещей', status: 'Выполнена', price: 990, date: '12 мая 2026', material: true },
        { id: 'insurance', title: 'Страхование', status: 'Действует', price: 790, date: '12 мая 2026', insuredValue: 50000, document: true },
        { id: 'materials', title: 'Упаковочные материалы', status: 'Выполнена', price: 1630, date: '12 мая 2026' }
      ],
      financial: {
        storage: 12640,
        delivery: 2380,
        materials: 1630,
        services: [
          { title: 'Фотофиксация', amount: 690 },
          { title: 'Опись вещей', amount: 990 },
          { title: 'Страхование', amount: 790 }
        ],
        discount: 480,
        refund: 0,
        paid: 18640,
        receiptAvailable: true,
        periods: [
          { label: 'Май 2026', amount: 1940 },
          { label: 'Июнь 2026', amount: 3300 },
          { label: 'Июль 2026', amount: 3300 },
          { label: 'Август 2026', amount: 4100 }
        ]
      },
      timeline: [
        { label: 'Заявка создана', date: '9 мая, 11:04' },
        { label: 'Вещи приняты у вас', date: '12 мая, 18:26' },
        { label: 'Принято складом', date: '12 мая, 18:58' },
        { label: 'Размещено на хранение', date: '12 мая, 19:12' },
        { label: 'Заказ завершён', date: '12 мая, 19:15' }
      ]
    },
    {
      id: 'return-1921',
      number: 'WHM-R-1921',
      type: 'return',
      subtype: 'partial',
      status: 'completed',
      createdAt: '1 июля 2026, 09:35',
      completedAt: '4 июля 2026, 12:18',
      completedYear: 2026,
      completedTimestamp: 1783167480000,
      method: 'pickup',
      methodLabel: 'Самостоятельное получение',
      address: 'Склад WHM — Север, Сигнальный проезд, 16',
      plannedAt: '4 июля, 11:00–13:00',
      actualAt: '4 июля 2026, 12:18',
      trips: 1,
      storageAfter: 2430,
      sourceOrderId: 'intake-1842',
      relatedOrderIds: ['intake-1842'],
      items: [
        {
          id: 'BX-107', type: 'box', title: 'Сезонная обувь', description: 'Две пары обуви',
          size: '40 × 30 × 30 см', storedSince: '12 мая 2026', returnedAt: '4 июля 2026',
          monthlyPrice: 290, currentStatus: 'returned', seal: 'PL-832944', archived: true
        }
      ],
      services: [],
      financial: {
        storage: 0, delivery: 0, materials: 0, services: [], discount: 0, refund: 0,
        paid: 0, receiptAvailable: false
      },
      timeline: [
        { label: 'Заявка создана', date: '1 июля, 09:35' },
        { label: 'Передана на склад', date: '1 июля, 10:20' },
        { label: 'Вещи собраны', date: '3 июля, 17:40' },
        { label: 'Подготовлено к выдаче', date: '4 июля, 09:06' },
        { label: 'Передано вам', date: '4 июля, 12:18' },
        { label: 'Заказ завершён', date: '4 июля, 12:20' }
      ]
    },
    {
      id: 'intake-1770',
      number: 'WHM-S-1770',
      type: 'intake',
      status: 'cancelled',
      createdAt: '13 февраля 2026, 16:08',
      completedAt: '15 февраля 2026, 10:32',
      completedYear: 2026,
      completedTimestamp: 1771151520000,
      method: 'courier',
      methodLabel: 'Курьерский забор',
      address: 'Москва, ул. Малая Бронная, 14',
      plannedAt: '15 февраля, 10:00–12:00',
      actualAt: '',
      trips: 1,
      cancellationReason: 'Заказ отменён по вашему запросу до приезда курьера',
      currentCount: 0,
      returnedCount: 0,
      relatedOrderIds: [],
      items: [
        { id: 'DRAFT-01', type: 'box', title: 'Коробка M', description: 'Заявлено клиентом', size: '60 × 40 × 40 см', monthlyPrice: 390, currentStatus: 'cancelled', archived: true },
        { id: 'DRAFT-02', type: 'box', title: 'Коробка M', description: 'Заявлено клиентом', size: '60 × 40 × 40 см', monthlyPrice: 390, currentStatus: 'cancelled', archived: true }
      ],
      services: [
        { id: 'materials', title: 'Упаковочные материалы', status: 'Отменена', price: 0, date: '15 февраля 2026' }
      ],
      financial: {
        storage: 0, delivery: 1490, materials: 0, services: [], discount: 0,
        refund: 1490, paid: 0, receiptAvailable: true
      },
      timeline: [
        { label: 'Заявка создана', date: '13 февраля, 16:08' },
        { label: 'Оплата подтверждена', date: '13 февраля, 16:11' },
        { label: 'Заказ отменён', date: '15 февраля, 10:32' },
        { label: 'Средства возвращены', date: '15 февраля, 10:35' }
      ]
    },
    {
      id: 'return-1420',
      number: 'WHM-R-1420',
      type: 'return',
      subtype: 'full',
      status: 'completed',
      createdAt: '18 ноября 2025, 13:44',
      completedAt: '22 ноября 2025, 18:03',
      completedYear: 2025,
      completedTimestamp: 1763834580000,
      method: 'courier',
      methodLabel: 'Доставка курьером',
      address: 'Москва, ул. Большая Дмитровка, 21',
      plannedAt: '22 ноября, 17:00–19:00',
      actualAt: '22 ноября 2025, 18:03',
      trips: 1,
      storageAfter: 0,
      sourceOrderId: 'intake-1264',
      relatedOrderIds: [],
      items: [
        { id: 'BX-081', type: 'box', title: 'Книги', description: 'Домашняя библиотека', size: '60 × 40 × 40 см', storedSince: '8 марта 2025', returnedAt: '22 ноября 2025', monthlyPrice: 350, currentStatus: 'returned', seal: 'PL-601294', archived: true },
        { id: 'BX-082', type: 'box', title: 'Одежда', description: 'Летняя одежда', size: '60 × 40 × 40 см', storedSince: '8 марта 2025', returnedAt: '22 ноября 2025', monthlyPrice: 350, currentStatus: 'returned', seal: 'PL-601297', archived: true }
      ],
      services: [],
      financial: {
        storage: 0, delivery: 1490, materials: 0, services: [], discount: 200, refund: 0,
        paid: 1290, receiptAvailable: true
      },
      timeline: [
        { label: 'Заявка создана', date: '18 ноября, 13:44' },
        { label: 'Передана на склад', date: '18 ноября, 14:12' },
        { label: 'Вещи собраны', date: '21 ноября, 16:20' },
        { label: 'Передано в доставку', date: '22 ноября, 16:56' },
        { label: 'Передано вам', date: '22 ноября, 18:03' },
        { label: 'Заказ завершён', date: '22 ноября, 18:05' }
      ]
    }
  ];

  const demoActiveOrder = {
    id: 'active-2114',
    number: 'WHM-R-2114',
    type: 'return',
    statusLabel: 'Собираем вещи на складе',
    updatedAt: 'сегодня, 12:40'
  };

  let {
    orders = demoOrders,
    activeOrder = demoActiveOrder,
    initialTheme = 'bumblebee',
    loading = false,
    errorMessage = '',
    onBack = () => {},
    onOpenActiveOrder = null,
    onOpenItem = null,
    onOpenReceipt = null,
    onOpenDocument = null,
    onOpenSupport = null,
    onOpenRelatedOrder = null,
    onRetry = () => {},
    onTrack = () => {}
  } = $props();

  let initialized = $state(false);
  let theme = $state('bumblebee');
  let searchQuery = $state('');
  let typeFilter = $state('all');
  let statusFilter = $state('all');
  let periodFilter = $state('all');
  let methodFilter = $state('all');
  let servicesOnly = $state(false);
  let sortOrder = $state('newest');
  let filterSheetOpen = $state(false);
  let draftStatusFilter = $state('all');
  let draftPeriodFilter = $state('all');
  let draftMethodFilter = $state('all');
  let draftServicesOnly = $state(false);
  let selectedOrderId = $state('');
  let expandedCardIds = $state([]);
  let detailItemsExpanded = $state(false);
  let periodsExpanded = $state(false);
  let itemPreview = $state(null);
  let receiptPreview = $state(null);
  let documentPreview = $state(null);
  let toastMessage = $state('');
  let listScrollY = $state(0);

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    initialized = true;
  });

  let isDark = $derived(theme === 'halloween');
  let selectedOrder = $derived(orders.find((order) => order.id === selectedOrderId) ?? null);
  let advancedFilterCount = $derived(
    Number(statusFilter !== 'all') +
      Number(periodFilter !== 'all') +
      Number(methodFilter !== 'all') +
      Number(servicesOnly)
  );

  let filteredOrders = $derived.by(() => {
    const query = normalize(searchQuery);
    const result = orders.filter((order) => {
      if (typeFilter !== 'all' && order.type !== typeFilter) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (periodFilter !== 'all' && String(order.completedYear) !== periodFilter) return false;
      if (methodFilter !== 'all' && order.method !== methodFilter) return false;
      if (servicesOnly && order.services.length === 0) return false;
      if (!query) return true;

      const haystack = [
        order.number,
        order.type === 'intake' ? 'сдача хранение' : 'возврат вещи',
        order.methodLabel,
        ...order.items.flatMap((item) => [item.id, item.title, item.description])
      ]
        .filter(Boolean)
        .join(' ');

      return normalize(haystack).includes(query);
    });

    return [...result].sort((a, b) =>
      sortOrder === 'newest'
        ? b.completedTimestamp - a.completedTimestamp
        : a.completedTimestamp - b.completedTimestamp
    );
  });

  let groupedOrders = $derived.by(() => {
    const groups = new Map();
    for (const order of filteredOrders) {
      if (!groups.has(order.completedYear)) groups.set(order.completedYear, []);
      groups.get(order.completedYear).push(order);
    }
    return [...groups.entries()].map(([year, yearOrders]) => ({ year, orders: yearOrders }));
  });

  function normalize(value) {
    return String(value ?? '').trim().toLocaleLowerCase('ru-RU');
  }

  function formatMoney(value) {
    const number = Number(value ?? 0);
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(number) + ' ₽';
  }

  function pluralUnits(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'единица';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'единицы';
    return 'единиц';
  }

  function orderTypeLabel(order) {
    if (order.type === 'intake') return 'Сдача на хранение';
    return order.subtype === 'full' ? 'Полный возврат' : 'Возврат вещей';
  }

  function dateLabel(order) {
    if (order.status === 'cancelled') return `Отменён ${order.completedAt.split(',')[0]}`;
    if (order.type === 'intake') return `Принято ${order.completedAt.split(',')[0]}`;
    return `Возвращено ${order.completedAt.split(',')[0]}`;
  }

  function itemStatusLabel(item) {
    if (item.currentStatus === 'stored') return 'На хранении';
    if (item.currentStatus === 'returned') return item.returnedAt ? `Возвращено ${item.returnedAt}` : 'Возвращено';
    return 'Заказ отменён';
  }

  function cardItems(order) {
    return expandedCardIds.includes(order.id) ? order.items : order.items.slice(0, 5);
  }

  function toggleCardItems(orderId, event) {
    event?.stopPropagation();
    expandedCardIds = expandedCardIds.includes(orderId)
      ? expandedCardIds.filter((id) => id !== orderId)
      : [...expandedCardIds, orderId];
    onTrack('history_items_toggled', { orderId, expanded: expandedCardIds.includes(orderId) });
  }

  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function openFilterSheet() {
    draftStatusFilter = statusFilter;
    draftPeriodFilter = periodFilter;
    draftMethodFilter = methodFilter;
    draftServicesOnly = servicesOnly;
    filterSheetOpen = true;
  }

  function applyFilters() {
    statusFilter = draftStatusFilter;
    periodFilter = draftPeriodFilter;
    methodFilter = draftMethodFilter;
    servicesOnly = draftServicesOnly;
    filterSheetOpen = false;
    onTrack('history_filters_applied', {
      type: typeFilter,
      status: statusFilter,
      period: periodFilter,
      method: methodFilter,
      servicesOnly
    });
  }

  function resetAdvancedFilters() {
    draftStatusFilter = 'all';
    draftPeriodFilter = 'all';
    draftMethodFilter = 'all';
    draftServicesOnly = false;
  }

  function resetAllFilters() {
    searchQuery = '';
    typeFilter = 'all';
    statusFilter = 'all';
    periodFilter = 'all';
    methodFilter = 'all';
    servicesOnly = false;
    sortOrder = 'newest';
  }

  async function openOrder(order) {
    if (!selectedOrderId) {
      listScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    }
    selectedOrderId = order.id;
    detailItemsExpanded = false;
    periodsExpanded = false;
    onTrack('history_order_opened', { orderId: order.id, type: order.type });
    await tick();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function closeOrder() {
    selectedOrderId = '';
    itemPreview = null;
    receiptPreview = null;
    documentPreview = null;
    await tick();
    if (typeof window !== 'undefined') window.scrollTo({ top: listScrollY, behavior: 'instant' });
  }

  function handleCardKeydown(event, order) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openOrder(order);
    }
  }

  function openActiveOrder() {
    onTrack('history_active_order_opened', { orderId: activeOrder?.id });
    if (typeof onOpenActiveOrder === 'function') onOpenActiveOrder(activeOrder);
    else showToast(`Открываем заказ ${activeOrder?.number}`);
  }

  function openItem(item, order) {
    onTrack('history_item_opened', { orderId: order.id, itemId: item.id, archived: Boolean(item.archived) });
    if (typeof onOpenItem === 'function') onOpenItem(item, { archived: Boolean(item.archived), order });
    else itemPreview = { item, order };
  }

  function openReceipt(order) {
    onTrack('history_receipt_opened', { orderId: order.id });
    if (typeof onOpenReceipt === 'function') onOpenReceipt(order);
    else receiptPreview = order;
  }

  function openService(service, order) {
    onTrack('history_service_opened', { orderId: order.id, serviceId: service.id });
    if (service.document && typeof onOpenDocument === 'function') onOpenDocument(service, order);
    else documentPreview = { service, order };
  }

  function openSupport(order) {
    onTrack('history_support_opened', { orderId: order.id });
    if (typeof onOpenSupport === 'function') {
      onOpenSupport({ orderId: order.id, orderNumber: order.number });
    } else {
      showToast(`Номер ${order.number} добавлен в обращение`);
    }
  }

  function openRelated(orderId) {
    const localOrder = orders.find((order) => order.id === orderId);
    if (localOrder) {
      openOrder(localOrder);
      return;
    }
    if (typeof onOpenRelatedOrder === 'function') onOpenRelatedOrder(orderId);
    else showToast('Связанный заказ будет открыт в приложении');
  }

  function showToast(message) {
    toastMessage = message;
    setTimeout(() => {
      if (toastMessage === message) toastMessage = '';
    }, 2800);
  }

  function handleSearchInput(event) {
    searchQuery = event.currentTarget.value;
    onTrack('history_search', { hasQuery: Boolean(searchQuery.trim()) });
  }
</script>

<svelte:head>
  <title>WHM — История заказов</title>
  <meta
    name="description"
    content="История сдачи, хранения и возврата вещей в WHM"
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  <header class="app-header">
    <button class="brand" type="button" aria-label="На главный экран" onclick={onBack}>
      <span class="brand-mark" aria-hidden="true"><img src="/bee.svg" alt="" /></span>
      <span class="brand-name">WHM</span>
    </button>

    <div class="header-actions">
      <button
        class="theme-toggle"
        type="button"
        aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        title={isDark ? 'Светлая тема' : 'Тёмная тема'}
        onclick={toggleTheme}
      >
        {#if isDark}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.4"></circle>
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 15.1A8.4 8.4 0 0 1 8.9 3.5 8.6 8.6 0 1 0 20.5 15.1Z"></path>
          </svg>
        {/if}
      </button>
      <button class="profile-button" type="button" aria-label="Профиль">АМ</button>
    </div>
  </header>

  <main class="history-shell">
    {#if selectedOrder}
      <section class="detail-view screen-enter" aria-labelledby="detail-title">
        <div class="detail-topbar">
          <button class="back-button" type="button" aria-label="Назад к истории" onclick={closeOrder}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
          </button>
          <span>История заказов</span>
        </div>

        <article class="detail-hero">
          <div class="detail-heading">
            <div>
              <p class="order-kicker">{orderTypeLabel(selectedOrder)}</p>
              <h1 id="detail-title">{selectedOrder.number}</h1>
            </div>
            <span class:cancelled={selectedOrder.status === 'cancelled'} class="status-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {#if selectedOrder.status === 'completed'}
                  <path d="m5 12 4 4L19 6"></path>
                {:else}
                  <path d="M7 7l10 10M17 7 7 17"></path>
                {/if}
              </svg>
              {selectedOrder.status === 'completed' ? 'Завершён' : 'Отменён'}
            </span>
          </div>
          <div class="hero-facts">
            <div><span>Создан</span><strong>{selectedOrder.createdAt}</strong></div>
            <div><span>{selectedOrder.status === 'cancelled' ? 'Отменён' : 'Завершён'}</span><strong>{selectedOrder.completedAt}</strong></div>
            <div><span>Способ передачи</span><strong>{selectedOrder.methodLabel}</strong></div>
          </div>
          {#if selectedOrder.cancellationReason}
            <div class="warning-banner">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5v.01M12 3 2.8 20h18.4Z"></path></svg>
              <p>{selectedOrder.cancellationReason}</p>
            </div>
          {/if}
        </article>

        <article class="detail-section timeline-section">
          <div class="section-heading-row">
            <div>
              <h2>Как прошёл заказ</h2>
              <p>Только этапы, которые были видны вам</p>
            </div>
          </div>
          <ol class="timeline">
            {#each selectedOrder.timeline as entry, index}
              <li class:last={index === selectedOrder.timeline.length - 1}>
                <span class="timeline-dot" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"></path></svg>
                </span>
                <div><strong>{entry.label}</strong><span>{entry.date}</span></div>
              </li>
            {/each}
          </ol>
        </article>

        <article class="detail-section">
          <div class="section-heading-row">
            <div>
              <h2>{selectedOrder.type === 'intake' ? 'Что сдали' : 'Что вернули'}</h2>
              <p>{selectedOrder.items.length} {pluralUnits(selectedOrder.items.length)}</p>
            </div>
            {#if selectedOrder.type === 'intake'}
              <span class="cycle-label">
                {selectedOrder.currentCount > 0
                  ? `На хранении ${selectedOrder.currentCount} из ${selectedOrder.items.length}`
                  : 'Все вещи возвращены'}
              </span>
            {/if}
          </div>

          <div class="detail-items">
            {#each (detailItemsExpanded ? selectedOrder.items : selectedOrder.items.slice(0, 5)) as item}
              <button class="detail-item" type="button" onclick={() => openItem(item, selectedOrder)}>
                <span class="item-image" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d={item.type === 'box' ? 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z M4 7.5l8 4.5 8-4.5M12 12v9' : 'M7 17a3 3 0 1 0 0 .01M17 17a3 3 0 1 0 0 .01M7 17l3-7h4l3 7M9 7h4l2 3'}></path></svg>
                </span>
                <span class="item-main">
                  <span class="item-title-row"><strong>{item.title}</strong><small>{item.id}</small></span>
                  <span class="item-description">{item.description}</span>
                  <span class:returned={item.currentStatus === 'returned'} class:cancelled={item.currentStatus === 'cancelled'} class="item-status">
                    {itemStatusLabel(item)}
                  </span>
                </span>
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
              </button>
            {/each}
          </div>
          {#if selectedOrder.items.length > 5}
            <button class="expand-button" type="button" onclick={() => {
              detailItemsExpanded = !detailItemsExpanded;
              onTrack('history_items_toggled', { orderId: selectedOrder.id, expanded: detailItemsExpanded });
            }}>
              {detailItemsExpanded ? 'Свернуть' : `Показать ещё ${selectedOrder.items.length - 5}`}
              <svg class:rotated={detailItemsExpanded} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
            </button>
          {/if}
        </article>

        {#if selectedOrder.services.length > 0}
          <article class="detail-section">
            <div class="section-heading-row">
              <div>
                <h2>Дополнительные услуги</h2>
                <p>Зафиксированы на момент выполнения</p>
              </div>
            </div>
            <div class="service-list">
              {#each selectedOrder.services as service}
                <div class="service-row">
                  <span class="service-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      {#if service.id === 'photo'}<path d="M4 7h4l1.5-2h5L16 7h4v12H4Z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path>
                      {:else if service.id === 'insurance'}<path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6Z M9 12l2 2 4-4"></path>
                      {:else}<path d="M6 3h9l3 3v15H6Z M9 10h6M9 14h6M9 18h4"></path>{/if}
                    </svg>
                  </span>
                  <span class="service-copy">
                    <strong>{service.title}</strong>
                    <span>{service.status} · {service.date}</span>
                    {#if service.insuredValue}<span>Объявленная стоимость {formatMoney(service.insuredValue)}</span>{/if}
                  </span>
                  <span class="service-price">{formatMoney(service.price)}</span>
                  {#if service.material || service.document}
                    <button class="small-link" type="button" onclick={() => openService(service, selectedOrder)}>
                      {service.document ? 'Документ' : 'Материалы'}
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          </article>
        {/if}

        <article class="detail-section">
          <div class="section-heading-row">
            <div>
              <h2>Передача вещей</h2>
              <p>{selectedOrder.methodLabel}</p>
            </div>
          </div>
          <dl class="info-grid">
            <div><dt>Плановое время</dt><dd>{selectedOrder.plannedAt}</dd></div>
            <div><dt>Фактическое время</dt><dd>{selectedOrder.actualAt || 'Передача не состоялась'}</dd></div>
            <div><dt>{selectedOrder.method === 'courier' ? 'Адрес' : 'Место выдачи'}</dt><dd>{selectedOrder.address}</dd></div>
            <div><dt>Поездки</dt><dd>{selectedOrder.trips}</dd></div>
          </dl>
        </article>

        <article class="detail-section finance-section">
          <div class="section-heading-row">
            <div>
              <h2>Оплата</h2>
              <p>Исторические суммы не пересчитываются</p>
            </div>
          </div>
          <div class="finance-groups">
            {#if selectedOrder.financial.storage > 0}
              <div class="finance-group">
                <div class="finance-line strong-line"><span>Хранение за период</span><strong>{formatMoney(selectedOrder.financial.storage)}</strong></div>
                {#if selectedOrder.financial.periods?.length}
                  {#each (periodsExpanded ? selectedOrder.financial.periods : []) as period}
                    <div class="finance-line sub-line"><span>{period.label}</span><span>{formatMoney(period.amount)}</span></div>
                  {/each}
                  <button class="finance-expand" type="button" onclick={() => (periodsExpanded = !periodsExpanded)}>
                    {periodsExpanded ? 'Скрыть расчётные периоды' : 'Показать расчётные периоды'}
                    <svg class:rotated={periodsExpanded} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
                  </button>
                {/if}
              </div>
            {/if}
            <div class="finance-group">
              {#if selectedOrder.financial.delivery > 0}
                <div class="finance-line"><span>{selectedOrder.type === 'return' ? 'Возврат и доставка' : 'Забор и доставка'}</span><span>{formatMoney(selectedOrder.financial.delivery)}</span></div>
              {/if}
              {#if selectedOrder.financial.materials > 0}
                <div class="finance-line"><span>Упаковочные материалы</span><span>{formatMoney(selectedOrder.financial.materials)}</span></div>
              {/if}
              {#each selectedOrder.financial.services as service}
                <div class="finance-line"><span>{service.title}</span><span>{formatMoney(service.amount)}</span></div>
              {/each}
              {#if selectedOrder.financial.discount > 0}
                <div class="finance-line discount-line"><span>Скидка</span><span>−{formatMoney(selectedOrder.financial.discount)}</span></div>
              {/if}
              {#if selectedOrder.financial.refund > 0}
                <div class="finance-line refund-line"><span>Возврат средств</span><span>−{formatMoney(selectedOrder.financial.refund)}</span></div>
              {/if}
            </div>
          </div>
          <div class="finance-total">
            <span>Итого оплачено</span>
            <strong>{selectedOrder.financial.paid > 0 ? formatMoney(selectedOrder.financial.paid) : 'Без оплаты'}</strong>
          </div>
          {#if selectedOrder.financial.receiptAvailable}
            <button class="secondary-button receipt-button" type="button" onclick={() => openReceipt(selectedOrder)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z M9 8h6M9 12h6"></path></svg>
              Открыть чек
            </button>
          {/if}
        </article>

        {#if selectedOrder.relatedOrderIds.length > 0 || selectedOrder.sourceOrderId}
          <article class="detail-section">
            <div class="section-heading-row">
              <div>
                <h2>Связанные заказы</h2>
                <p>{selectedOrder.type === 'intake' ? 'Возвраты из этой сдачи' : 'Исходная сдача вещей'}</p>
              </div>
            </div>
            <div class="related-list">
              {#each [...new Set([...(selectedOrder.sourceOrderId ? [selectedOrder.sourceOrderId] : []), ...selectedOrder.relatedOrderIds])] as relatedId}
                {@const related = orders.find((order) => order.id === relatedId)}
                <button class="related-order" type="button" onclick={() => openRelated(relatedId)}>
                  <span class="related-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M8 12h8M12 8l4 4-4 4M4 5h16v14H4Z"></path></svg>
                  </span>
                  <span>
                    <strong>{related?.number ?? 'Связанный заказ'}</strong>
                    <small>{related ? `${orderTypeLabel(related)} · ${related.items.length} ${pluralUnits(related.items.length)}` : 'Открыть заказ'}</small>
                  </span>
                  <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
                </button>
              {/each}
            </div>
          </article>
        {/if}

        <div class="detail-actions">
          <button class="secondary-button" type="button" onclick={() => openSupport(selectedOrder)}>
            Нужна помощь по заказу
          </button>
          <button class="text-button" type="button" onclick={closeOrder}>Вернуться к истории</button>
        </div>
      </section>
    {:else}
      <section class="list-view screen-enter" aria-labelledby="history-title">
        <div class="page-heading">
          <div>
            <p class="page-kicker">Ваши заказы</p>
            <h1 id="history-title">История заказов</h1>
            <p>Сдача, хранение, возвраты и оплата в одном месте.</p>
          </div>
          <div class="order-count"><strong>{orders.length}</strong><span>всего</span></div>
        </div>

        {#if activeOrder}
          <button class="active-order-banner" type="button" onclick={openActiveOrder}>
            <span class="active-pulse" aria-hidden="true"></span>
            <span class="active-copy">
              <strong>Есть активный заказ</strong>
              <span>{activeOrder.number} · {activeOrder.statusLabel}</span>
            </span>
            <span class="active-time">{activeOrder.updatedAt}</span>
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
          </button>
        {/if}

        <div class="search-and-sort">
          <label class="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>
            <input
              type="search"
              value={searchQuery}
              placeholder="Номер заказа, коробка или вещь"
              aria-label="Поиск по истории"
              oninput={handleSearchInput}
            />
            {#if searchQuery}
              <button type="button" aria-label="Очистить поиск" onclick={() => (searchQuery = '')}>
                <svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"></path></svg>
              </button>
            {/if}
          </label>
          <label class="sort-field">
            <span class="sr-only">Сортировка</span>
            <select bind:value={sortOrder} aria-label="Сортировка заказов">
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>
          </label>
        </div>

        <div class="filter-bar">
          <div class="type-filters" role="tablist" aria-label="Тип заказа">
            {#each [
              { id: 'all', label: 'Все' },
              { id: 'intake', label: 'Сдача' },
              { id: 'return', label: 'Возврат' }
            ] as filter}
              <button
                type="button"
                role="tab"
                aria-selected={typeFilter === filter.id}
                class:active={typeFilter === filter.id}
                onclick={() => {
                  typeFilter = filter.id;
                  onTrack('history_type_filter', { type: filter.id });
                }}
              >{filter.label}</button>
            {/each}
          </div>
          <button class:active={advancedFilterCount > 0} class="filter-button" type="button" onclick={openFilterSheet}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>
            Фильтры
            {#if advancedFilterCount > 0}<span>{advancedFilterCount}</span>{/if}
          </button>
        </div>

        {#if advancedFilterCount > 0}
          <div class="active-filter-chips" aria-label="Активные фильтры">
            {#if statusFilter !== 'all'}<span>{statusFilter === 'completed' ? 'Завершённые' : 'Отменённые'}</span>{/if}
            {#if periodFilter !== 'all'}<span>{periodFilter} год</span>{/if}
            {#if methodFilter !== 'all'}<span>{methodFilter === 'courier' ? 'Курьер' : 'Самостоятельно'}</span>{/if}
            {#if servicesOnly}<span>С услугами</span>{/if}
            <button type="button" onclick={resetAllFilters}>Сбросить</button>
          </div>
        {/if}

        {#if loading}
          <div class="skeleton-list" aria-label="Загрузка истории" aria-live="polite">
            {#each [1, 2, 3] as row}
              <div class="skeleton-card">
                <span class="skeleton skeleton-title"></span>
                <span class="skeleton skeleton-line"></span>
                <span class="skeleton skeleton-line short"></span>
                <span class="skeleton skeleton-block"></span>
              </div>
            {/each}
          </div>
        {:else if errorMessage}
          <div class="state-card">
            <span class="state-icon error" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.01M12 3 2.8 20h18.4Z"></path></svg>
            </span>
            <h2>Не удалось загрузить историю</h2>
            <p>{errorMessage}</p>
            <button class="primary-button" type="button" onclick={onRetry}>Повторить</button>
          </div>
        {:else if orders.length === 0}
          <div class="state-card">
            <span class="state-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z M9 8h6M9 12h6"></path></svg>
            </span>
            <h2>Здесь появятся завершённые заказы</h2>
            <p>После сдачи или возврата вещей вы сможете посмотреть состав, даты и оплату.</p>
            <button class="primary-button" type="button" onclick={onBack}>На главный экран</button>
          </div>
        {:else if filteredOrders.length === 0}
          <div class="state-card compact-state">
            <span class="state-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8.5 8.5l5 5M13.5 8.5l-5 5"></path></svg>
            </span>
            <h2>Заказы не найдены</h2>
            <p>Измените запрос или сбросьте выбранные фильтры.</p>
            <button class="secondary-button" type="button" onclick={resetAllFilters}>Сбросить фильтры</button>
          </div>
        {:else}
          <div class="year-groups">
            {#each groupedOrders as group}
              <section class="year-group" aria-labelledby={`year-${group.year}`}>
                <div class="year-heading">
                  <h2 id={`year-${group.year}`}>{group.year}</h2>
                  <span>{group.orders.length}</span>
                </div>
                <div class="order-list">
                  {#each group.orders as order}
                    <div
                      class:cancelled={order.status === 'cancelled'}
                      class="order-card"
                      role="button"
                      tabindex="0"
                      aria-label={`Открыть заказ ${order.number}`}
                      onclick={() => openOrder(order)}
                      onkeydown={(event) => handleCardKeydown(event, order)}
                    >
                      <div class="order-card-head">
                        <div>
                          <span class:intake={order.type === 'intake'} class="type-badge">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              {#if order.type === 'intake'}
                                <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z M4 7.5l8 4.5 8-4.5M12 12v9"></path>
                              {:else}
                                <path d="M5 12h12M13 8l4 4-4 4M5 5v14"></path>
                              {/if}
                            </svg>
                            {orderTypeLabel(order)}
                          </span>
                          <h3>{order.number}</h3>
                          <p>{dateLabel(order)}</p>
                        </div>
                        <span class:cancelled={order.status === 'cancelled'} class="status-pill small">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            {#if order.status === 'completed'}<path d="m5 12 4 4L19 6"></path>{:else}<path d="M7 7l10 10M17 7 7 17"></path>{/if}
                          </svg>
                          {order.status === 'completed' ? 'Завершён' : 'Отменён'}
                        </span>
                      </div>

                      {#if order.type === 'intake' && order.status === 'completed'}
                        <div class="cycle-summary">
                          <span><strong>{order.items.length}</strong> сдано</span>
                          <span><strong>{order.currentCount}</strong> на хранении</span>
                          <span><strong>{order.returnedCount}</strong> возвращено</span>
                        </div>
                      {/if}

                      <div class="card-items" aria-label="Состав заказа">
                        {#each cardItems(order) as item}
                          <div class="card-item-line">
                            <span class="mini-placeholder" aria-hidden="true"></span>
                            <span><strong>{item.title}</strong><small>{item.id}</small></span>
                            <span class:returned={item.currentStatus === 'returned'} class:cancelled={item.currentStatus === 'cancelled'} class="mini-status">
                              {item.currentStatus === 'stored' ? 'Хранится' : item.currentStatus === 'returned' ? 'Возвращено' : 'Отменено'}
                            </span>
                          </div>
                        {/each}
                        {#if order.items.length > 5}
                          <button class="show-more-inline" type="button" onclick={(event) => toggleCardItems(order.id, event)}>
                            {expandedCardIds.includes(order.id) ? 'Свернуть' : `Показать ещё ${order.items.length - 5}`}
                            <svg class:rotated={expandedCardIds.includes(order.id)} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
                          </button>
                        {/if}
                      </div>

                      <div class="card-footer">
                        <div class="payment-summary">
                          {#if order.type === 'intake' && order.financial.storage > 0}
                            <span>Хранение <strong>{formatMoney(order.financial.storage)}</strong></span>
                            <span>Разово <strong>{formatMoney(order.financial.paid - order.financial.storage)}</strong></span>
                          {:else}
                            <span>{order.type === 'return' ? 'Возврат' : 'Оплачено'} <strong>{order.financial.paid > 0 ? formatMoney(order.financial.paid) : 'Без оплаты'}</strong></span>
                          {/if}
                        </div>
                        {#if order.services.length > 0}
                          <div class="service-tags" aria-label="Дополнительные услуги">
                            {#each order.services.slice(0, 3) as service}<span>{service.title}</span>{/each}
                            {#if order.services.length > 3}<span>Ещё {order.services.length - 3}</span>{/if}
                          </div>
                        {/if}
                        <div class="method-row">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={order.method === 'courier' ? 'M3 7h11v9H3Z M14 10h4l3 3v3h-7Z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' : 'M4 10 12 4l8 6v10H4Z M9 20v-6h6v6'}></path></svg>
                          <span>{order.methodLabel}</span>
                          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </main>

  {#if filterSheetOpen}
    <div class="modal-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && (filterSheetOpen = false)}>
      <div class="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="modal-head">
          <div><h2 id="filter-title">Фильтры</h2><p>Уточните историю заказов</p></div>
          <button class="icon-button" type="button" aria-label="Закрыть" onclick={() => (filterSheetOpen = false)}>
            <svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"></path></svg>
          </button>
        </div>

        <div class="filter-section">
          <span class="filter-label">Статус</span>
          <div class="choice-grid three">
            {#each [{ id: 'all', label: 'Все' }, { id: 'completed', label: 'Завершён' }, { id: 'cancelled', label: 'Отменён' }] as option}
              <button class:active={draftStatusFilter === option.id} type="button" onclick={() => (draftStatusFilter = option.id)}>{option.label}</button>
            {/each}
          </div>
        </div>

        <div class="filter-section">
          <span class="filter-label">Период</span>
          <div class="choice-grid three">
            {#each [{ id: 'all', label: 'Весь период' }, { id: '2026', label: '2026' }, { id: '2025', label: '2025' }] as option}
              <button class:active={draftPeriodFilter === option.id} type="button" onclick={() => (draftPeriodFilter = option.id)}>{option.label}</button>
            {/each}
          </div>
        </div>

        <div class="filter-section">
          <span class="filter-label">Способ передачи</span>
          <div class="choice-grid three">
            {#each [{ id: 'all', label: 'Все' }, { id: 'courier', label: 'Курьер' }, { id: 'pickup', label: 'Самостоятельно' }] as option}
              <button class:active={draftMethodFilter === option.id} type="button" onclick={() => (draftMethodFilter = option.id)}>{option.label}</button>
            {/each}
          </div>
        </div>

        <label class="toggle-row">
          <span><strong>Только с дополнительными услугами</strong><small>Фото, опись, страхование и упаковка</small></span>
          <input type="checkbox" bind:checked={draftServicesOnly} />
          <span class="toggle-control" aria-hidden="true"></span>
        </label>

        <div class="sheet-actions">
          <button class="secondary-button" type="button" onclick={resetAdvancedFilters}>Сбросить</button>
          <button class="primary-button" type="button" onclick={applyFilters}>Показать заказы</button>
        </div>
      </div>
    </div>
  {/if}

  {#if itemPreview}
    <div class="modal-backdrop centered" role="presentation" onclick={(event) => event.target === event.currentTarget && (itemPreview = null)}>
      <div class="preview-modal" role="dialog" aria-modal="true" aria-labelledby="item-preview-title">
        <div class="modal-head">
          <div><h2 id="item-preview-title">{itemPreview.item.title}</h2><p>{itemPreview.item.id}</p></div>
          <button class="icon-button" type="button" aria-label="Закрыть" onclick={() => (itemPreview = null)}>
            <svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"></path></svg>
          </button>
        </div>
        <div class="large-placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z M4 7.5l8 4.5 8-4.5M12 12v9"></path></svg>
        </div>
        <span class:archived={itemPreview.item.archived} class="preview-badge">
          {itemPreview.item.archived ? 'Архивная карточка' : 'Сейчас на хранении'}
        </span>
        <p class="preview-description">{itemPreview.item.description}</p>
        <dl class="preview-grid">
          <div><dt>Размер</dt><dd>{itemPreview.item.size}</dd></div>
          <div><dt>Начало хранения</dt><dd>{itemPreview.item.storedSince || 'Не применимо'}</dd></div>
          <div><dt>Возврат</dt><dd>{itemPreview.item.returnedAt || 'На хранении'}</dd></div>
          <div><dt>Пломба</dt><dd>{itemPreview.item.seal || 'Не назначена'}</dd></div>
          <div><dt>Тариф на момент заказа</dt><dd>{formatMoney(itemPreview.item.monthlyPrice)}/мес.</dd></div>
        </dl>
        <div class="info-banner">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5v.01M12 3 2.8 20h18.4Z"></path></svg>
          <p>{itemPreview.item.archived ? 'Карточка доступна только для просмотра. Данные сохранены на момент возврата.' : 'Это актуальная карточка вещи на хранении.'}</p>
        </div>
        <button class="primary-button full" type="button" onclick={() => (itemPreview = null)}>Понятно</button>
      </div>
    </div>
  {/if}

  {#if receiptPreview}
    <div class="modal-backdrop centered" role="presentation" onclick={(event) => event.target === event.currentTarget && (receiptPreview = null)}>
      <div class="preview-modal receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <div class="modal-head">
          <div><h2 id="receipt-title">Чек по заказу</h2><p>{receiptPreview.number}</p></div>
          <button class="icon-button" type="button" aria-label="Закрыть" onclick={() => (receiptPreview = null)}><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"></path></svg></button>
        </div>
        <div class="receipt-paper">
          <div class="receipt-brand"><span class="brand-mark tiny" aria-hidden="true"><img src="/bee.svg" alt="" /></span><strong>WHM</strong></div>
          <p>Электронный кассовый чек</p>
          <div><span>Заказ</span><strong>{receiptPreview.number}</strong></div>
          <div><span>Дата</span><strong>{receiptPreview.completedAt}</strong></div>
          <div class="receipt-total"><span>Оплачено</span><strong>{formatMoney(receiptPreview.financial.paid)}</strong></div>
          {#if receiptPreview.financial.refund > 0}<div><span>Возвращено</span><strong>{formatMoney(receiptPreview.financial.refund)}</strong></div>{/if}
          <small>Фискальный документ будет открыт через интеграцию приложения.</small>
        </div>
        <button class="primary-button full" type="button" onclick={() => showToast('Чек подготовлен к скачиванию')}>Скачать PDF</button>
      </div>
    </div>
  {/if}

  {#if documentPreview}
    <div class="modal-backdrop centered" role="presentation" onclick={(event) => event.target === event.currentTarget && (documentPreview = null)}>
      <div class="preview-modal" role="dialog" aria-modal="true" aria-labelledby="document-title">
        <div class="modal-head">
          <div><h2 id="document-title">{documentPreview.service.title}</h2><p>{documentPreview.order.number}</p></div>
          <button class="icon-button" type="button" aria-label="Закрыть" onclick={() => (documentPreview = null)}><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"></path></svg></button>
        </div>
        <div class="document-placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6Z M9 10h6M9 14h6M9 18h4"></path></svg>
        </div>
        <p class="preview-description">
          {documentPreview.service.document
            ? `Страховой документ на сумму ${formatMoney(documentPreview.service.insuredValue)}`
            : 'Материалы услуги доступны в карточках связанных единиц хранения.'}
        </p>
        <button class="primary-button full" type="button" onclick={() => (documentPreview = null)}>Закрыть</button>
      </div>
    </div>
  {/if}

  {#if toastMessage}
    <div class="toast" role="status" aria-live="polite">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
      {toastMessage}
    </div>
  {/if}
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { min-width: 320px; background: var(--color-base-100, white); }
  :global(body) { margin: 0; font-family: "Open Sans", sans-serif; }
  :global(button), :global(input), :global(select), :global(textarea) { font: inherit; font-family: "Open Sans", sans-serif; }
  :global(button) { -webkit-tap-highlight-color: transparent; }

  .whm-app {
    --page-gutter: clamp(1rem, 3vw, 2.5rem);
    --header-height: 5.25rem;
    --content-max: 72rem;
    --reading-max: 61rem;
    --type-h1: clamp(2.25rem, 4.2vw, 4.1rem);
    --type-heading: clamp(1.25rem, 2vw, 1.7rem);
    --type-body: 1rem;
    --type-caption: 0.75rem;
    --soft-border: color-mix(in oklab, var(--color-base-content) 12%, transparent);
    --muted-border: color-mix(in oklab, var(--color-base-content) 7%, transparent);
    --soft-content: color-mix(in oklab, var(--color-base-content) 62%, transparent);
    --faint-content: color-mix(in oklab, var(--color-base-content) 42%, transparent);
    --primary-soft: color-mix(in oklab, var(--color-primary) 18%, var(--color-base-100));
    --primary-faint: color-mix(in oklab, var(--color-primary) 9%, var(--color-base-100));
    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-family: "Open Sans", sans-serif;
    font-size: var(--type-body);
    line-height: 1.5;
    transition: background-color 200ms ease, color 200ms ease;
  }

  .whm-app[data-theme='bumblebee'] {
    color-scheme: light;
    --color-base-100: oklch(100% 0 0);
    --color-base-200: oklch(97% 0 0);
    --color-base-300: oklch(92% 0 0);
    --color-base-content: oklch(20% 0 0);
    --color-primary: oklch(85% 0.199 91.936);
    --color-primary-content: oklch(42% 0.095 57.708);
    --color-secondary: oklch(75% 0.183 55.934);
    --color-secondary-content: oklch(40% 0.123 38.172);
    --color-success: oklch(76% 0.177 163.223);
    --color-success-content: oklch(37% 0.077 168.94);
    --color-warning: oklch(82% 0.189 84.429);
    --color-error: oklch(70% 0.191 22.216);
    --color-error-content: oklch(39% 0.141 25.723);
    --radius-selector: 1rem;
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .whm-app[data-theme='halloween'] {
    color-scheme: dark;
    --color-base-100: oklch(21% 0.006 56.043);
    --color-base-200: oklch(14% 0.004 49.25);
    --color-base-300: oklch(0% 0 0);
    --color-base-content: oklch(84.955% 0 0);
    --color-primary: oklch(76% 0.188 70.08);
    --color-primary-content: oklch(19.693% 0.004 196.779);
    --color-secondary: oklch(45.98% 0.248 305.03);
    --color-secondary-content: oklch(89.196% 0.049 305.03);
    --color-success: oklch(62.705% 0.169 149.213);
    --color-success-content: oklch(12.541% 0.033 149.213);
    --color-warning: oklch(66.584% 0.157 58.318);
    --color-error: oklch(65.72% 0.199 27.33);
    --color-error-content: oklch(13.144% 0.039 27.33);
    --radius-selector: 1rem;
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  h1, h2, h3, p { margin: 0; }
  button, input, select { color: inherit; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid color-mix(in oklab, var(--color-primary) 62%, transparent); outline-offset: 2px; }
  svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .ambient { position: fixed; z-index: -1; border-radius: 999px; pointer-events: none; opacity: 0.62; }
  .ambient-one { top: -17rem; right: -13rem; width: 38rem; height: 38rem; background: radial-gradient(circle, var(--primary-soft), transparent 68%); }
  .ambient-two { bottom: -21rem; left: -17rem; width: 44rem; height: 44rem; background: radial-gradient(circle, color-mix(in oklab, var(--color-secondary) 11%, transparent), transparent 67%); }

  .app-header {
    position: relative;
    z-index: 20;
    width: min(100%, var(--content-max));
    height: var(--header-height);
    margin: 0 auto;
    padding: 0 var(--page-gutter);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand, .header-actions, .detail-topbar, .order-card-head, .section-heading-row, .type-badge,
  .status-pill, .method-row, .filter-bar, .type-filters, .search-field, .sort-field, .modal-head,
  .sheet-actions, .receipt-brand, .preview-badge, .finance-expand, .show-more-inline, .expand-button {
    display: flex;
    align-items: center;
  }

  .brand { gap: 0.7rem; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .brand-mark { position: relative; width: 1.9rem; height: 1.9rem; display: inline-grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 0.18rem; transform: rotate(-8deg); flex: 0 0 auto; }
  .brand-mark span { display: block; border-radius: 0.18rem; background: var(--color-primary); }
  .brand-mark span:nth-child(3) { grid-column: 1 / 3; }
  .brand-mark span:nth-child(2) { background: var(--color-secondary); }
  .brand-mark.tiny { width: 1.35rem; height: 1.35rem; gap: 0.12rem; }
  .brand-name { font-weight: 800; letter-spacing: 0.13em; }
  .header-actions { gap: 0.65rem; }

  .theme-toggle, .profile-button, .back-button, .icon-button {
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    padding: 0;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
    cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }
  .theme-toggle:hover, .profile-button:hover, .back-button:hover, .icon-button:hover { border-color: var(--color-primary); background: var(--color-base-200); }
  .theme-toggle:active, .profile-button:active, .back-button:active, .icon-button:active { transform: scale(0.96); }
  .theme-toggle svg, .back-button svg, .icon-button svg { width: 1.2rem; height: 1.2rem; }
  .profile-button { border-radius: 999px; background: var(--primary-soft); border-color: transparent; font-size: 0.72rem; font-weight: 800; }

  .history-shell { width: min(calc(100% - (var(--page-gutter) * 2)), var(--content-max)); min-height: calc(100dvh - var(--header-height)); margin: 0 auto; padding-bottom: 4rem; }
  .list-view, .detail-view { width: min(100%, var(--reading-max)); margin: 0 auto; }
  .screen-enter { animation: screen-enter 260ms cubic-bezier(.2,.8,.2,1); }
  @keyframes screen-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .page-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; padding: clamp(1.5rem, 4vw, 3.2rem) 0 2rem; }
  .page-kicker, .order-kicker { color: var(--soft-content); font-size: var(--type-caption); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .page-heading h1, .detail-heading h1 { margin-top: 0.2rem; font-size: var(--type-h1); line-height: 1.04; letter-spacing: -0.055em; }
  .page-heading > div > p:last-child { margin-top: 0.85rem; color: var(--soft-content); max-width: 35rem; }
  .order-count { width: 5.5rem; height: 5.5rem; border-radius: 999px; display: grid; place-items: center; align-content: center; flex: 0 0 auto; background: var(--color-primary); color: #171717; transform: rotate(4deg); }
  .order-count strong { font-size: 1.45rem; line-height: 1; }
  .order-count span { margin-top: 0.2rem; font-size: var(--type-caption); }

  .active-order-banner { width: 100%; min-height: 5.4rem; padding: 1rem 1.15rem; display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.85rem; border: var(--border) solid color-mix(in oklab, var(--color-primary) 48%, var(--soft-border)); border-radius: var(--radius-box); background: var(--primary-faint); text-align: left; cursor: pointer; transition: transform 180ms ease, border-color 180ms ease; }
  .active-order-banner:hover { transform: translateY(-2px); border-color: var(--color-primary); }
  .active-pulse { position: relative; width: 0.75rem; height: 0.75rem; border-radius: 999px; background: var(--color-success); }
  .active-pulse::after { content: ''; position: absolute; inset: -0.35rem; border: 1px solid var(--color-success); border-radius: inherit; animation: pulse 1.8s ease-out infinite; }
  @keyframes pulse { 0% { opacity: .75; transform: scale(.6); } 80%, 100% { opacity: 0; transform: scale(1.55); } }
  .active-copy { display: grid; min-width: 0; }
  .active-copy strong { font-size: 0.95rem; }
  .active-copy span, .active-time { color: var(--soft-content); font-size: 0.82rem; }
  .active-time { white-space: nowrap; }
  .chevron { width: 1.1rem; height: 1.1rem; flex: 0 0 auto; }

  .search-and-sort { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; margin-top: 1.25rem; }
  .search-field { min-height: 3.5rem; padding: 0 0.95rem; gap: 0.65rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: color-mix(in oklab, var(--color-base-100) 92%, transparent); }
  .search-field:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .search-field > svg { width: 1.25rem; height: 1.25rem; color: var(--faint-content); }
  .search-field input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; }
  .search-field input::placeholder { color: var(--faint-content); }
  .search-field button { width: 2rem; height: 2rem; display: grid; place-items: center; padding: 0; border: 0; background: transparent; cursor: pointer; color: var(--soft-content); }
  .search-field button svg { width: 1rem; height: 1rem; }
  .sort-field { position: relative; min-width: 11.5rem; }
  .sort-field select { width: 100%; min-height: 3.5rem; appearance: none; padding: 0 2.7rem 0 1rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: color-mix(in oklab, var(--color-base-100) 92%, transparent); cursor: pointer; }
  .sort-field > svg { position: absolute; right: 0.85rem; width: 1rem; height: 1rem; pointer-events: none; }

  .filter-bar { justify-content: space-between; gap: 1rem; margin-top: 0.8rem; }
  .type-filters { gap: 0.4rem; padding: 0.3rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: var(--color-base-200); }
  .type-filters button { min-height: 2.65rem; padding: 0.35rem 1rem; border: 0; border-radius: calc(var(--radius-field) - 0.2rem); background: transparent; color: var(--soft-content); cursor: pointer; font-weight: 700; }
  .type-filters button.active { background: var(--color-base-100); color: var(--color-base-content); box-shadow: 0 2px 10px color-mix(in oklab, var(--color-base-content) 8%, transparent); }
  .filter-button { min-height: 3.25rem; padding: 0.45rem 0.9rem; display: inline-flex; align-items: center; gap: 0.5rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: transparent; cursor: pointer; font-weight: 700; }
  .filter-button.active { border-color: var(--color-primary); background: var(--primary-faint); }
  .filter-button > svg { width: 1.1rem; height: 1.1rem; }
  .filter-button > span { min-width: 1.35rem; height: 1.35rem; display: grid; place-items: center; border-radius: 999px; background: var(--color-primary); color: #171717; font-size: 0.72rem; }
  .active-filter-chips { display: flex; gap: 0.45rem; align-items: center; overflow-x: auto; padding: 0.7rem 0 0.15rem; scrollbar-width: none; }
  .active-filter-chips::-webkit-scrollbar { display: none; }
  .active-filter-chips span { padding: 0.35rem 0.65rem; border-radius: 999px; background: var(--primary-faint); white-space: nowrap; font-size: 0.8rem; }
  .active-filter-chips button { border: 0; background: transparent; color: var(--soft-content); white-space: nowrap; cursor: pointer; text-decoration: underline; text-underline-offset: 0.2rem; }

  .year-groups { margin-top: 2rem; display: grid; gap: 2.25rem; }
  .year-heading { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.8rem; }
  .year-heading h2 { font-size: var(--type-heading); letter-spacing: -0.03em; }
  .year-heading span { min-width: 1.6rem; height: 1.6rem; display: grid; place-items: center; border-radius: 999px; background: var(--color-base-200); color: var(--soft-content); font-size: 0.75rem; }
  .order-list { display: grid; gap: 0.9rem; }
  .order-card { position: relative; padding: clamp(1rem, 2.2vw, 1.45rem); border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: color-mix(in oklab, var(--color-base-100) 94%, transparent); cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
  .order-card:hover { transform: translateY(-2px); border-color: color-mix(in oklab, var(--color-primary) 60%, var(--soft-border)); box-shadow: 0 16px 42px color-mix(in oklab, var(--color-base-content) 8%, transparent); }
  .order-card.cancelled { background: color-mix(in oklab, var(--color-base-200) 75%, transparent); }
  .order-card-head { justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .order-card-head h3 { margin-top: 0.42rem; font-size: 1.38rem; letter-spacing: -0.035em; }
  .order-card-head p { margin-top: 0.16rem; color: var(--soft-content); font-size: 0.86rem; }
  .type-badge { width: max-content; gap: 0.38rem; padding: 0.3rem 0.58rem; border-radius: 999px; background: color-mix(in oklab, var(--color-secondary) 15%, var(--color-base-100)); font-size: 0.76rem; font-weight: 800; }
  .type-badge.intake { background: var(--primary-faint); }
  .type-badge svg { width: 0.95rem; height: 0.95rem; }
  .status-pill { width: max-content; gap: 0.38rem; padding: 0.42rem 0.65rem; border-radius: 999px; background: color-mix(in oklab, var(--color-success) 20%, var(--color-base-100)); color: color-mix(in oklab, var(--color-success-content) 82%, var(--color-base-content)); font-size: 0.78rem; font-weight: 800; }
  .status-pill.cancelled { background: color-mix(in oklab, var(--color-error) 14%, var(--color-base-100)); color: color-mix(in oklab, var(--color-error) 72%, var(--color-base-content)); }
  .status-pill svg { width: 0.95rem; height: 0.95rem; stroke-width: 2.2; }
  .status-pill.small { flex: 0 0 auto; }

  .cycle-summary { margin-top: 1rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; padding: 0.75rem; border-radius: 0.75rem; background: var(--primary-faint); }
  .cycle-summary span { color: var(--soft-content); font-size: 0.78rem; text-align: center; }
  .cycle-summary strong { display: block; color: var(--color-base-content); font-size: 1.05rem; }
  .card-items { margin-top: 1rem; display: grid; border-top: var(--border) solid var(--muted-border); }
  .card-item-line { min-height: 3rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.65rem; border-bottom: var(--border) solid var(--muted-border); }
  .mini-placeholder { width: 1.8rem; height: 1.8rem; border-radius: 0.35rem; background: linear-gradient(135deg, var(--color-base-200), var(--color-base-300)); }
  .card-item-line > span:nth-child(2) { min-width: 0; display: flex; align-items: baseline; gap: 0.45rem; }
  .card-item-line strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.86rem; }
  .card-item-line small { color: var(--faint-content); font-size: 0.72rem; }
  .mini-status { padding: 0.25rem 0.5rem; border-radius: 999px; background: color-mix(in oklab, var(--color-success) 14%, transparent); color: var(--soft-content); font-size: 0.7rem; white-space: nowrap; }
  .mini-status.returned { background: var(--color-base-200); }
  .mini-status.cancelled { background: color-mix(in oklab, var(--color-error) 12%, transparent); }
  .show-more-inline { width: max-content; gap: 0.35rem; margin-top: 0.65rem; padding: 0.3rem 0; border: 0; background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 700; }
  .show-more-inline svg, .expand-button svg, .finance-expand svg { width: 1rem; height: 1rem; transition: transform 180ms ease; }
  svg.rotated { transform: rotate(180deg); }

  .card-footer { margin-top: 1rem; display: grid; gap: 0.75rem; }
  .payment-summary { display: flex; flex-wrap: wrap; gap: 0.5rem 1.15rem; }
  .payment-summary span { color: var(--soft-content); font-size: 0.82rem; }
  .payment-summary strong { margin-left: 0.25rem; color: var(--color-base-content); }
  .service-tags { display: flex; gap: 0.38rem; overflow: hidden; }
  .service-tags span { padding: 0.28rem 0.52rem; border-radius: 999px; background: var(--color-base-200); color: var(--soft-content); font-size: 0.7rem; white-space: nowrap; }
  .method-row { gap: 0.45rem; color: var(--soft-content); font-size: 0.82rem; }
  .method-row > svg:first-child { width: 1.1rem; height: 1.1rem; }
  .method-row .chevron { margin-left: auto; color: var(--color-base-content); }

  .skeleton-list { margin-top: 2rem; display: grid; gap: 0.9rem; }
  .skeleton-card { padding: 1.3rem; display: grid; gap: 0.75rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); }
  .skeleton { display: block; border-radius: 0.45rem; background: linear-gradient(90deg, var(--color-base-200), var(--color-base-300), var(--color-base-200)); background-size: 220% 100%; animation: shimmer 1.5s linear infinite; }
  .skeleton-title { width: 42%; height: 1.6rem; }
  .skeleton-line { width: 80%; height: 0.85rem; }
  .skeleton-line.short { width: 55%; }
  .skeleton-block { height: 5rem; margin-top: 0.5rem; }
  @keyframes shimmer { to { background-position: -220% 0; } }
  .state-card { margin-top: 2rem; min-height: 24rem; padding: 2rem; display: grid; place-items: center; align-content: center; text-align: center; border: var(--border) dashed var(--soft-border); border-radius: var(--radius-box); background: color-mix(in oklab, var(--color-base-100) 88%, transparent); }
  .state-card.compact-state { min-height: 19rem; }
  .state-icon { width: 4rem; height: 4rem; display: grid; place-items: center; border-radius: 999px; background: var(--primary-soft); }
  .state-icon.error { background: color-mix(in oklab, var(--color-error) 16%, var(--color-base-100)); }
  .state-icon svg { width: 1.8rem; height: 1.8rem; }
  .state-card h2 { margin-top: 1rem; font-size: var(--type-heading); }
  .state-card p { margin-top: 0.55rem; max-width: 31rem; color: var(--soft-content); }
  .state-card button { margin-top: 1.2rem; }

  .detail-topbar { gap: 0.75rem; padding: 1.2rem 0; color: var(--soft-content); font-size: 0.85rem; }
  .detail-hero, .detail-section { border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: color-mix(in oklab, var(--color-base-100) 94%, transparent); }
  .detail-hero { padding: clamp(1.2rem, 3vw, 2rem); }
  .detail-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .detail-heading h1 { font-size: clamp(2rem, 4vw, 3.3rem); }
  .hero-facts { margin-top: 1.5rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .hero-facts > div { min-width: 0; padding: 0.85rem; border-radius: 0.75rem; background: var(--color-base-200); }
  .hero-facts span, .info-grid dt, .preview-grid dt { display: block; color: var(--faint-content); font-size: var(--type-caption); }
  .hero-facts strong { display: block; margin-top: 0.3rem; font-size: 0.85rem; }
  .warning-banner, .info-banner { margin-top: 1rem; padding: 0.85rem 1rem; display: flex; align-items: flex-start; gap: 0.65rem; border-radius: 0.75rem; background: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100)); }
  .warning-banner svg, .info-banner svg { width: 1.2rem; height: 1.2rem; flex: 0 0 auto; margin-top: 0.1rem; }
  .warning-banner p, .info-banner p { font-size: 0.85rem; }

  .detail-section { margin-top: 0.9rem; padding: clamp(1.1rem, 3vw, 1.65rem); }
  .section-heading-row { justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .section-heading-row h2 { font-size: var(--type-heading); letter-spacing: -0.035em; }
  .section-heading-row p { margin-top: 0.22rem; color: var(--soft-content); font-size: 0.83rem; }
  .cycle-label { padding: 0.38rem 0.62rem; border-radius: 999px; background: var(--primary-faint); font-size: 0.75rem; white-space: nowrap; }

  .timeline { list-style: none; margin: 1.25rem 0 0; padding: 0; }
  .timeline li { position: relative; min-height: 3.6rem; display: grid; grid-template-columns: auto 1fr; gap: 0.8rem; }
  .timeline li:not(.last)::before { content: ''; position: absolute; top: 1.65rem; bottom: 0; left: 0.72rem; width: 1px; background: color-mix(in oklab, var(--color-success) 50%, var(--soft-border)); }
  .timeline-dot { position: relative; z-index: 1; width: 1.5rem; height: 1.5rem; display: grid; place-items: center; border-radius: 999px; background: var(--color-success); color: var(--color-success-content); }
  .timeline-dot svg { width: 0.85rem; height: 0.85rem; stroke-width: 2.4; }
  .timeline li div { display: grid; align-content: start; }
  .timeline li strong { font-size: 0.88rem; }
  .timeline li span:last-child { color: var(--soft-content); font-size: 0.75rem; }

  .detail-items { margin-top: 1.1rem; display: grid; border-top: var(--border) solid var(--muted-border); }
  .detail-item { width: 100%; min-height: 5rem; padding: 0.75rem 0; display: grid; grid-template-columns: auto 1fr auto; gap: 0.85rem; align-items: center; border: 0; border-bottom: var(--border) solid var(--muted-border); background: transparent; text-align: left; cursor: pointer; }
  .detail-item:hover .item-title-row strong { text-decoration: underline; text-underline-offset: 0.2rem; }
  .item-image { width: 3.2rem; height: 3.2rem; display: grid; place-items: center; border-radius: 0.65rem; background: linear-gradient(135deg, var(--color-base-200), var(--color-base-300)); color: var(--faint-content); }
  .item-image svg { width: 1.45rem; height: 1.45rem; }
  .item-main { min-width: 0; display: grid; }
  .item-title-row { display: flex; align-items: baseline; gap: 0.55rem; }
  .item-title-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-title-row small { color: var(--faint-content); }
  .item-description { color: var(--soft-content); font-size: 0.82rem; }
  .item-status { width: max-content; margin-top: 0.25rem; color: color-mix(in oklab, var(--color-success) 70%, var(--color-base-content)); font-size: 0.72rem; }
  .item-status.returned { color: var(--soft-content); }
  .item-status.cancelled { color: var(--color-error); }
  .expand-button { gap: 0.35rem; margin-top: 0.8rem; padding: 0.45rem 0; border: 0; background: transparent; cursor: pointer; font-weight: 700; }

  .service-list { margin-top: 1rem; display: grid; }
  .service-row { min-height: 4.5rem; display: grid; grid-template-columns: auto 1fr auto auto; gap: 0.75rem; align-items: center; border-bottom: var(--border) solid var(--muted-border); }
  .service-row:last-child { border-bottom: 0; }
  .service-icon { width: 2.45rem; height: 2.45rem; display: grid; place-items: center; border-radius: 0.6rem; background: var(--primary-faint); }
  .service-icon svg { width: 1.2rem; height: 1.2rem; }
  .service-copy { min-width: 0; display: grid; }
  .service-copy strong { font-size: 0.88rem; }
  .service-copy span { color: var(--soft-content); font-size: 0.72rem; }
  .service-price { font-size: 0.82rem; font-weight: 700; white-space: nowrap; }
  .small-link { padding: 0.35rem 0; border: 0; background: transparent; cursor: pointer; font-size: 0.75rem; font-weight: 700; text-decoration: underline; text-underline-offset: 0.2rem; }

  .info-grid, .preview-grid { margin: 1.1rem 0 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
  .info-grid > div, .preview-grid > div { padding: 0.8rem; border-radius: 0.7rem; background: var(--color-base-200); }
  .info-grid dd, .preview-grid dd { margin: 0.3rem 0 0; font-size: 0.85rem; font-weight: 700; }

  .finance-groups { margin-top: 1.1rem; display: grid; gap: 0.65rem; }
  .finance-group { padding: 0.85rem; border-radius: 0.75rem; background: var(--color-base-200); }
  .finance-line { min-height: 2rem; display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; font-size: 0.84rem; }
  .finance-line span:last-child { white-space: nowrap; }
  .strong-line { font-weight: 700; }
  .sub-line { padding-left: 0.75rem; color: var(--soft-content); font-size: 0.75rem; }
  .discount-line { color: color-mix(in oklab, var(--color-success) 75%, var(--color-base-content)); }
  .refund-line { color: color-mix(in oklab, var(--color-error) 75%, var(--color-base-content)); }
  .finance-expand { gap: 0.35rem; padding: 0.35rem 0 0; border: 0; background: transparent; cursor: pointer; color: var(--soft-content); font-size: 0.75rem; }
  .finance-total { margin-top: 0.85rem; padding-top: 0.85rem; display: flex; justify-content: space-between; align-items: baseline; border-top: var(--border) solid var(--soft-border); }
  .finance-total span { font-weight: 700; }
  .finance-total strong { font-size: 1.4rem; }
  .receipt-button { margin-top: 1rem; }
  .receipt-button svg { width: 1.1rem; height: 1.1rem; }

  .related-list { margin-top: 1rem; display: grid; gap: 0.55rem; }
  .related-order { width: 100%; min-height: 4.2rem; padding: 0.7rem; display: grid; grid-template-columns: auto 1fr auto; gap: 0.7rem; align-items: center; border: var(--border) solid var(--muted-border); border-radius: 0.7rem; background: var(--color-base-200); text-align: left; cursor: pointer; }
  .related-order:hover { border-color: var(--color-primary); }
  .related-icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 0.6rem; background: var(--color-base-100); }
  .related-icon svg { width: 1.15rem; height: 1.15rem; }
  .related-order > span:nth-child(2) { min-width: 0; display: grid; }
  .related-order small { color: var(--soft-content); }
  .detail-actions { display: grid; gap: 0.5rem; padding: 1rem 0 0; }

  .primary-button, .secondary-button, .text-button { min-height: 3.15rem; padding: 0.7rem 1rem; border-radius: var(--radius-field); cursor: pointer; font-weight: 800; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease; }
  .primary-button { border: 1px solid transparent; background: var(--color-primary); color: #171717; }
  .primary-button:hover { background: color-mix(in oklab, var(--color-primary) 82%, white); }
  .secondary-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: var(--border) solid var(--soft-border); background: var(--color-base-100); }
  .secondary-button:hover { border-color: var(--color-primary); }
  .text-button { border: 0; background: transparent; color: var(--soft-content); }
  .primary-button:active, .secondary-button:active, .text-button:active { transform: scale(0.985); }
  .primary-button.full { width: 100%; }

  .modal-backdrop { position: fixed; z-index: 80; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 1rem; background: color-mix(in oklab, black 48%, transparent); backdrop-filter: blur(8px); }
  .modal-backdrop.centered { align-items: center; }
  .filter-sheet, .preview-modal { width: min(100%, 38rem); max-height: calc(100dvh - 2rem); overflow-y: auto; border: var(--border) solid var(--soft-border); background: var(--color-base-100); box-shadow: 0 28px 80px rgba(0,0,0,.28); }
  .filter-sheet { padding: 0 1.25rem 1.25rem; border-radius: 1.25rem 1.25rem var(--radius-box) var(--radius-box); animation: sheet-in 240ms cubic-bezier(.2,.8,.2,1); }
  @keyframes sheet-in { from { transform: translateY(2rem); opacity: 0; } }
  .preview-modal { padding: 1.25rem; border-radius: var(--radius-box); animation: modal-in 220ms cubic-bezier(.2,.8,.2,1); }
  @keyframes modal-in { from { transform: scale(.97); opacity: 0; } }
  .sheet-handle { width: 3rem; height: 0.25rem; margin: 0.55rem auto 0.75rem; border-radius: 999px; background: var(--color-base-300); }
  .modal-head { justify-content: space-between; gap: 1rem; }
  .modal-head h2 { font-size: var(--type-heading); }
  .modal-head p { color: var(--soft-content); font-size: 0.8rem; }
  .filter-section { margin-top: 1.2rem; }
  .filter-label { display: block; margin-bottom: 0.55rem; font-size: 0.82rem; font-weight: 800; }
  .choice-grid { display: grid; gap: 0.45rem; }
  .choice-grid.three { grid-template-columns: repeat(3, 1fr); }
  .choice-grid button { min-height: 3rem; padding: 0.55rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: var(--color-base-100); cursor: pointer; }
  .choice-grid button.active { border-color: var(--color-primary); background: var(--primary-faint); box-shadow: inset 0 0 0 1px var(--color-primary); font-weight: 800; }
  .toggle-row { position: relative; margin-top: 1.2rem; padding: 0.9rem; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.8rem; border-radius: 0.75rem; background: var(--color-base-200); cursor: pointer; }
  .toggle-row > span:first-child { display: grid; }
  .toggle-row small { color: var(--soft-content); }
  .toggle-row input { position: absolute; opacity: 0; pointer-events: none; }
  .toggle-control { position: relative; width: 2.8rem; height: 1.55rem; border-radius: 999px; background: var(--color-base-300); transition: background 180ms ease; }
  .toggle-control::after { content: ''; position: absolute; top: 0.2rem; left: 0.2rem; width: 1.15rem; height: 1.15rem; border-radius: 999px; background: white; box-shadow: 0 2px 6px rgba(0,0,0,.2); transition: transform 180ms ease; }
  .toggle-row input:checked + .toggle-control { background: var(--color-primary); }
  .toggle-row input:checked + .toggle-control::after { transform: translateX(1.25rem); }
  .sheet-actions { gap: 0.6rem; margin-top: 1.25rem; }
  .sheet-actions > * { flex: 1; }

  .large-placeholder { height: 13rem; margin-top: 1rem; display: grid; place-items: center; border-radius: 0.85rem; background: linear-gradient(135deg, var(--color-base-200), var(--color-base-300)); color: var(--faint-content); }
  .large-placeholder svg { width: 4rem; height: 4rem; }
  .preview-badge { width: max-content; margin-top: 0.9rem; padding: 0.35rem 0.6rem; border-radius: 999px; background: color-mix(in oklab, var(--color-success) 18%, var(--color-base-100)); font-size: 0.75rem; font-weight: 800; }
  .preview-badge.archived { background: var(--color-base-200); color: var(--soft-content); }
  .preview-description { margin-top: 0.75rem; color: var(--soft-content); }
  .preview-grid { margin-bottom: 1rem; }
  .document-placeholder { height: 15rem; margin-top: 1rem; display: grid; place-items: center; border: var(--border) dashed var(--soft-border); border-radius: 0.85rem; background: var(--color-base-200); color: var(--faint-content); }
  .document-placeholder svg { width: 3rem; height: 3rem; }

  .receipt-paper { margin: 1rem auto; padding: 1.2rem; display: grid; gap: 0.65rem; border: var(--border) solid var(--soft-border); border-radius: 0.3rem; background: color-mix(in oklab, var(--color-base-100) 95%, white); color: var(--color-base-content); box-shadow: 0 12px 30px color-mix(in oklab, black 10%, transparent); }
  .receipt-brand { gap: 0.5rem; }
  .receipt-paper > p { color: var(--soft-content); font-size: 0.75rem; }
  .receipt-paper > div:not(.receipt-brand) { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.82rem; }
  .receipt-paper .receipt-total { padding-top: 0.7rem; border-top: 1px dashed var(--soft-border); font-size: 1rem; }
  .receipt-paper small { padding-top: 0.7rem; border-top: 1px dashed var(--soft-border); color: var(--soft-content); }

  .toast { position: fixed; z-index: 120; left: 50%; bottom: 1.25rem; transform: translateX(-50%); width: max-content; max-width: calc(100% - 2rem); min-height: 3.2rem; padding: 0.7rem 1rem; display: flex; align-items: center; gap: 0.6rem; border: var(--border) solid var(--soft-border); border-radius: 999px; background: var(--color-base-content); color: var(--color-base-100); box-shadow: 0 16px 44px rgba(0,0,0,.28); font-size: 0.85rem; animation: toast-in 220ms ease; }
  .toast svg { width: 1.1rem; height: 1.1rem; stroke-width: 2.3; }
  @keyframes toast-in { from { transform: translate(-50%, .6rem); opacity: 0; } }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

  @media (max-width: 720px) {
    .whm-app { --header-height: 4.5rem; --type-h1: clamp(2rem, 11vw, 3rem); }
    .history-shell { width: 100%; padding: 0 1rem 6rem; }
    .app-header { padding: 0 1rem; }
    .page-heading { align-items: flex-start; padding: 1.2rem 0 1.4rem; }
    .order-count { width: 4.2rem; height: 4.2rem; }
    .active-order-banner { grid-template-columns: auto 1fr auto; }
    .active-time { display: none; }
    .search-and-sort { grid-template-columns: 1fr; }
    .sort-field { min-width: 0; }
    .filter-bar { align-items: stretch; }
    .type-filters { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); }
    .type-filters button { min-width: 0; padding-inline: 0.45rem; }
    .filter-button { flex: 0 0 auto; padding-inline: 0.75rem; }
    .filter-button { font-size: 0; gap: 0.35rem; }
    .filter-button svg, .filter-button span { font-size: 0.72rem; }
    .order-card { padding: 1rem; }
    .order-card-head { align-items: flex-start; }
    .status-pill.small { padding: 0.4rem; font-size: 0; }
    .status-pill.small svg { margin: 0; }
    .cycle-summary { gap: 0.25rem; padding: 0.65rem 0.35rem; }
    .card-item-line { grid-template-columns: auto minmax(0,1fr); padding-block: 0.25rem; }
    .mini-status { grid-column: 2; width: max-content; margin-top: -0.25rem; }
    .payment-summary { display: grid; gap: 0.2rem; }
    .service-tags { overflow-x: auto; scrollbar-width: none; }
    .detail-topbar { padding-top: 0.75rem; }
    .detail-heading { display: grid; }
    .detail-heading .status-pill { justify-self: start; }
    .hero-facts { grid-template-columns: 1fr; }
    .section-heading-row { display: grid; }
    .cycle-label { justify-self: start; }
    .service-row { grid-template-columns: auto 1fr auto; padding-block: 0.5rem; }
    .service-row .small-link { grid-column: 2 / 4; justify-self: start; margin-top: -0.65rem; }
    .info-grid, .preview-grid { grid-template-columns: 1fr; }
    .choice-grid.three { grid-template-columns: 1fr; }
    .modal-backdrop { padding: 0; }
    .modal-backdrop.centered { padding: 0.75rem; }
    .filter-sheet { width: 100%; border-radius: 1.25rem 1.25rem 0 0; border-bottom: 0; }
    .preview-modal { max-height: calc(100dvh - 1.5rem); }
  }

  @media (max-width: 420px) {
    .page-heading { gap: 0.7rem; }
    .page-heading > div > p:last-child { font-size: 0.85rem; }
    .order-count { width: 3.7rem; height: 3.7rem; }
    .order-count strong { font-size: 1.15rem; }
    .order-count span { font-size: 0.65rem; }
    .active-copy span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 14rem; }
    .type-badge { font-size: 0.68rem; }
    .order-card-head h3 { font-size: 1.2rem; }
    .item-image { width: 2.8rem; height: 2.8rem; }
    .item-title-row { display: grid; gap: 0; }
    .sheet-actions { display: grid; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }

  .brand-mark { display: inline-flex !important; align-items: center; justify-content: center; transform: none !important; font-size: 1.5rem; line-height: 1; }
  .brand-mark.large { font-size: 2.4rem; }
  .brand-mark.tiny { font-size: 1rem; }
</style>
