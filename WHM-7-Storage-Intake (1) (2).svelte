<script>
  import { Archive, ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Copy, MapPin, Minus, Moon, Plus, Search, Sun, User, Warehouse, X } from '@lucide/svelte';
  import { onMount } from 'svelte';

  /*
   * WHM-7 — Оформление: Сдача на хранение
   *
   * Автономный UI-сценарий:
   * WHM-4 (главный экран) → WHM-7 (6 шагов) → экран успеха.
   *
   * Иллюстрации используют локальные SVG-ассеты демо-контура.
   * Цены в demo mode служат для проверки динамического расчёта.
   */
  let {
    live = false, config = null, catalog = [], draftKey = '', initialTheme = 'bumblebee',
    onCalculateOrder = async () => null, onOversizeRequest = async () => ({ ok: false }),
    customerName = 'Александра',
    savedAddress = 'Москва, ул. Тверская, 18',
    savedPhone = '',
    insuranceRate = 0.0058,
    insuranceMinPremium = 100,
    demoMode = true,
    startAtService = false,
    onCreateOrder = async () => ({ ok: true, orderNumber: 'WHM-824731' }),
    onNavigateOrder = () => {},
    onNavigateHome = () => {},
    onOpenTerms = () => {}
  } = $props();

  const DRAFT_KEY = draftKey || 'whm-7-storage-intake-draft';
  const draftStorage = live ? sessionStorage : localStorage;
  const THEME_KEY = 'whm-theme';

  const demoBoxItems = [
    {
      id: 'box-s',
      size: 'S',
      title: 'Коробка S',
      dimensions: '40 × 30 × 30 см',
      example: 'Обувь, книги, аксессуары',
      weightLimit: 'до 10 кг',
      price: 490,
      media: 'Коробка S'
    },
    {
      id: 'box-m',
      size: 'M',
      title: 'Коробка M',
      dimensions: '60 × 40 × 40 см',
      example: 'Посуда, техника, игрушки',
      weightLimit: 'до 15 кг',
      price: 790,
      media: 'Коробка M'
    },
    {
      id: 'box-l',
      size: 'L',
      title: 'Коробка L',
      dimensions: '80 × 60 × 40 см',
      example: 'Одежда, текстиль, декор',
      weightLimit: 'до 20 кг',
      price: 1190,
      media: 'Коробка L'
    },
    {
      id: 'box-xl',
      size: 'XL',
      title: 'Коробка XL',
      dimensions: '100 × 80 × 50 см',
      example: 'Крупный текстиль и техника',
      weightLimit: 'до 25 кг',
      price: 1690,
      media: 'Коробка XL'
    }
  ];

  const demoSeparateItems = [
    { id: 'bike', title: 'Велосипед', price: 1490 },
    { id: 'ski', title: 'Лыжи / сноуборд', price: 790 },
    { id: 'suitcase', title: 'Чемодан', price: 890 },
    { id: 'picture', title: 'Картина / зеркало', price: 1290 }
  ];

  let allItems = $derived([...boxItems, ...separateItems]);

  const demoOptionItems = [
    {
      id: 'photos',
      title: 'Фотофиксация содержимого',
      description: 'Сфотографируем каждую коробку изнутри перед закрытием',
      price: 390,
      cadence: 'разово',
      kind: 'once',
      label: 'Фото'
    },
    {
      id: 'inventory',
      title: 'Опись вещей',
      description: 'Создадим детальный список предметов',
      price: 490,
      cadence: 'разово',
      kind: 'once',
      label: 'Опись'
    },
    {
      id: 'materials',
      title: 'Упаковочные материалы',
      description: 'Коробки, скотч и защитная плёнка от нас',
      price: 990,
      cadence: 'разово',
      kind: 'once',
      label: 'Материалы',
      turnkeyOnly: true
    }
  ];

  const serviceDetails = {
    turnkey: {
      title: 'Мы всё сделаем сами',
      lead: 'Курьер привезёт материалы, упакует вещи и подготовит их к хранению.',
      points: [
        'Согласуем дату и двухчасовой интервал визита.',
        'Курьер упакует и промаркирует выбранные вещи.',
        'После приёмки вещи появятся в личном кабинете.'
      ],
      note: 'Упаковка и забор рассчитываются как разовая услуга.'
    },
    self: {
      title: 'Я упакую сам',
      lead: 'Вы самостоятельно готовите вещи, а затем выбираете удобный способ передачи.',
      points: [
        'Используйте подходящие коробки и соблюдайте ограничение по весу.',
        'Можно вызвать курьера для готовых коробок.',
        'Или привезти вещи на склад самостоятельно.'
      ],
      note: 'Стоимость хранения зависит от выбранных коробок и отдельных предметов.'
    }
  };

  const demoDates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index + 2);
    const soldOut = index === 1;
    const disabled = index === 2;
    return {
      label: new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
      short: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date),
      disabled,
      soldOut,
      slots: soldOut || disabled ? [] : ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00'].map((label, slotIndex) => ({ label, disabled: index === 0 && (slotIndex === 2 || slotIndex === 5) }))
    };
  });

  const demoAddressCatalog = [
    { value: 'Москва, ул. Тверская, 18', inZone: true },
    { value: 'Москва, ул. Большая Дмитровка, 12', inZone: true },
    { value: 'Москва, Ленинградский проспект, 36', inZone: true },
    { value: 'Химки, Ленинградское шоссе, 5', inZone: false }
  ];

  const demoWarehouse = {
    name: 'Склад — Север',
    address: 'Москва, Складочная улица, 1с18',
    hours: 'Пн–Вс, 09:00–20:00'
  };

  let boxItems = $derived(live ? catalog.filter(t => t.itemType === 'box').map(t => ({ ...demoBoxItems.find(b => t.code.endsWith(b.id)), id: t.id, title: t.title, price: t.price, media: t.title })) : demoBoxItems);
  let separateItems = $derived(live ? catalog.filter(t => t.itemType === 'item').map(t => ({ id: t.id, title: t.title, price: t.price })) : demoSeparateItems);
  let optionItems = $derived(live ? config.options : demoOptionItems);
  let dates = $derived(live ? config.dates : demoDates);
  let addressCatalog = $derived(live ? config.addresses : demoAddressCatalog);
  let warehouse = $derived(live ? config.warehouses[0] : demoWarehouse);
  let serverQuote = $state(null), quoting = $state(false), operationKey = $state(crypto.randomUUID()), createdOrderID = $state(''), oversizeFile = $state(null);
  let theme = $state(initialTheme);
  let view = $state(startAtService ? 'service' : 'home');
  let direction = $state('forward');
  let mounted = $state(false);
  let hasDraft = $state(false);

  let service = $state('');
  let deliveryMode = $state('');
  let quantities = $state({});
  let oversizeItems = $state([]);
  let optionSelections = $state({});
  let insuranceDeclaredValue = $state('');
  let insuranceEnabled = $state(false);
  let selectedDateIndex = $state(0);
  let selectedSlot = $state('');
  let loadingSlots = $state(false);
  let noSlots = $state(false);

  let addressQuery = $state('');
  let selectedAddress = $state('');
  let apartment = $state('');
  let intercom = $state('');
  let entrance = $state('');
  let floor = $state('');
  let contactPhone = $state(
    String(savedPhone || '')
      .replace(/\D/g, '')
      .replace(/^7/, '')
      .slice(0, 10)
  );
  let courierComment = $state('');
  let showSuggestions = $state(false);
  let addressError = $state('');
  let notifyEmail = $state('');
  let zoneNoticeSent = $state(false);

  let acceptedTerms = $state(false);
  let isSubmitting = $state(false);
  let orderNumber = $state('');

  let sizeGuideOpen = $state(false);
  let serviceInfoOpen = $state('');
  let oversizeOpen = $state(false);
  let oversizeDescription = $state('');
  let oversizePhotoName = $state('');
  let oversizePhotoSize = $state(0);
  let exitDialogOpen = $state(false);
  let toast = $state(null);
  let toastTimer;

  let isDark = $derived(theme === 'halloween');
  let selectedDate = $derived(dates[selectedDateIndex]);
  let addressSuggestions = $derived(
    addressQuery.trim().length < 3
      ? []
      : addressCatalog.filter((item) =>
          item.value.toLowerCase().includes(addressQuery.trim().toLowerCase())
        )
  );
  let totalQuantity = $derived(
    allItems.reduce((sum, item) => sum + (quantities[item.id] || 0), 0) +
      oversizeItems.length
  );
  let selectedRows = $derived(
    allItems.filter((item) => (quantities[item.id] || 0) > 0)
  );
  let monthlyStorage = $derived(
    allItems.reduce(
      (sum, item) => sum + item.price * (quantities[item.id] || 0),
      0
    )
  );
  let visibleOptions = $derived(
    optionItems.filter((item) => !item.turnkeyOnly || service === 'turnkey')
  );
  let selectedOptionRows = $derived(
    visibleOptions.filter((item) => optionSelections[item.id])
  );
  let monthlyOptions = $derived(
    selectedOptionRows
      .filter((item) => item.kind === 'monthly')
      .reduce((sum, item) => sum + item.price, 0)
  );
  let oneTimeOptions = $derived(
    selectedOptionRows
      .filter((item) => item.kind === 'once')
      .reduce((sum, item) => sum + item.price, 0)
  );
  let insuranceValueNumber = $derived(
    Math.max(0, Number(String(insuranceDeclaredValue).replace(/\D/g, '')) || 0)
  );
  let insuranceReady = $derived(insuranceValueNumber >= 1000);
  let insurancePremium = $derived(
    insuranceEnabled && insuranceReady
      ? Math.max(insuranceMinPremium, Math.round(insuranceValueNumber * insuranceRate))
      : 0
  );
  let calculatedInsurancePremium = $derived(
    insuranceReady
      ? Math.max(insuranceMinPremium, Math.round(insuranceValueNumber * insuranceRate))
      : 0
  );
  let collectionFee = $derived(
    service === 'turnkey' ? (live ? config.turnkeyFee : 1490) : deliveryMode === 'courier' ? (live ? config.courierFee : 890) : 0
  );
  let monthlyTotal = $derived(serverQuote?.monthly ?? monthlyStorage + monthlyOptions + insurancePremium);
  let oneTimeTotal = $derived(serverQuote?.once ?? oneTimeOptions + collectionFee);
  let payNow = $derived(monthlyTotal + oneTimeTotal);
  let progressStep = $derived(stepForView(view));
  let deliverySummary = $derived(
    deliveryMode === 'self'
      ? 'Самостоятельная доставка на склад'
      : service === 'turnkey'
        ? 'Курьер упакует и заберёт вещи'
        : 'Курьер заберёт готовые коробки'
  );

  onMount(() => {
    mounted = true;
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'bumblebee' || savedTheme === 'halloween') {
      theme = savedTheme;
    }
    hasDraft = Boolean(draftStorage.getItem(DRAFT_KEY));
    if (startAtService && hasDraft) resumeDraft();
  });

  $effect(() => {
    if (!mounted || typeof localStorage === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
  });

  $effect(() => {
    const snapshot = {
      operationKey,
      view,
      service,
      deliveryMode,
      quantities,
      oversizeItems,
      optionSelections,
      insuranceDeclaredValue,
      insuranceEnabled,
      selectedDateIndex,
      selectedSlot,
      addressQuery,
      selectedAddress,
      apartment,
      intercom,
      entrance,
      floor,
      contactPhone,
      courierComment,
      acceptedTerms
    };

    if (
      mounted &&
      typeof localStorage !== 'undefined' &&
      view !== 'home' &&
      view !== 'success'
    ) {
      draftStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      hasDraft = true;
    }
  });

  function stepForView(currentView) {
    if (currentView === 'service') return 1;
    if (currentView === 'items') return 2;
    if (currentView === 'options') return 3;
    if (currentView === 'insurance') return 4;
    if (
      currentView === 'logistics-choice' ||
      currentView === 'slots' ||
      currentView === 'address' ||
      currentView === 'warehouse'
    ) return 5;
    if (currentView === 'review') return 6;
    return 0;
  }

  function formatPrice(value) {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  }

  function haptic() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  function go(target, nextDirection = 'forward') {
    direction = nextDirection;
    view = target;
    if (target === 'review' && live) void calculateQuote();
    else if (target !== 'success') serverQuote = null;
    haptic();
    requestAnimationFrame(() => {
      const shell = document.querySelector('.whm-app');
      if (shell) shell.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  async function calculateQuote() {
    quoting = true; serverQuote = null;
    const result = await onCalculateOrder(buildOrderPayload());
    if (result?.ok === false) showToast(result.message, true); else serverQuote = result?.quote || null;
    quoting = false;
  }
  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function resetFlow() {
    service = '';
    deliveryMode = '';
    quantities = {};
    oversizeItems = [];
    optionSelections = {};
    insuranceDeclaredValue = '';
    insuranceEnabled = false;
    selectedDateIndex = 0;
    selectedSlot = '';
    loadingSlots = false;
    noSlots = false;
    addressQuery = '';
    selectedAddress = '';
    apartment = '';
    intercom = '';
    entrance = '';
    floor = '';
    contactPhone = String(savedPhone || '')
      .replace(/\D/g, '')
      .replace(/^7/, '')
      .slice(0, 10);
    courierComment = '';
    addressError = '';
    notifyEmail = '';
    zoneNoticeSent = false;
    acceptedTerms = false;
    orderNumber = '';
    draftStorage.removeItem(DRAFT_KEY);
    hasDraft = false;
  }

  function startFlow() {
    resetFlow();
    go('service');
  }

  function resumeDraft() {
    const raw = draftStorage.getItem(DRAFT_KEY);
    if (!raw) {
      startFlow();
      return;
    }

    try {
      const draft = JSON.parse(raw);
      operationKey = draft.operationKey || crypto.randomUUID();
      service = draft.service || '';
      deliveryMode = draft.deliveryMode || '';
      quantities = draft.quantities || {};
      oversizeItems = Array.isArray(draft.oversizeItems) ? draft.oversizeItems : [];
      optionSelections = draft.optionSelections || {};
      insuranceDeclaredValue = draft.insuranceDeclaredValue || '';
      insuranceEnabled = Boolean(draft.insuranceEnabled);
      selectedDateIndex = Number.isInteger(draft.selectedDateIndex)
        ? draft.selectedDateIndex
        : 0;
      selectedSlot = draft.selectedSlot || '';
      addressQuery = draft.addressQuery || '';
      selectedAddress = draft.selectedAddress || '';
      apartment = draft.apartment || '';
      intercom = draft.intercom || '';
      entrance = draft.entrance || '';
      floor = draft.floor || '';
      contactPhone = draft.contactPhone || '';
      courierComment = draft.courierComment || '';
      acceptedTerms = Boolean(draft.acceptedTerms);
      if (draft.view === 'review') acceptedTerms = false;
      go(draft.view && draft.view !== 'home' ? draft.view : 'service');
      showToast('Черновик восстановлен');
    } catch {
      startFlow();
    }
  }

  function chooseService(value) {
    service = value;
    deliveryMode = value === 'turnkey' ? 'courier' : '';
    if (value !== 'turnkey') optionSelections.materials = false;
    go('items');
  }

  function changeQuantity(id, delta) {
    const current = quantities[id] || 0;
    quantities[id] = Math.max(0, Math.min(20, current + delta));
    haptic();
  }

  function toggleOption(id) {
    optionSelections[id] = !optionSelections[id];
    haptic();
  }

  function continueFromOptions() {
    go('insurance');
  }

  function continueAfterInsurance() {
    if (service === 'turnkey') {
      deliveryMode = 'courier';
      openSlots();
    } else {
      go('logistics-choice');
    }
  }

  function handleInsuranceInput(event) {
    insuranceDeclaredValue = event.currentTarget.value.replace(/\D/g, '').slice(0, 9);
    insuranceEnabled = false;
  }

  function addInsurance() {
    if (!insuranceReady) return;
    insuranceEnabled = true;
    continueAfterInsurance();
  }

  function skipInsurance() {
    insuranceEnabled = false;
    insuranceDeclaredValue = '';
    continueAfterInsurance();
  }

  function chooseDelivery(value) {
    deliveryMode = value;
    if (value === 'courier') {
      openSlots();
    } else {
      go('warehouse');
    }
  }

  function openSlots() {
    go('slots');
    loadingSlots = true;
    setTimeout(() => {
      loadingSlots = false;
    }, 650);
  }

  function selectDate(index) {
    if (dates[index].disabled) return;
    selectedDateIndex = index;
    selectedSlot = '';
    noSlots = dates[index].soldOut;
    haptic();
  }

  function chooseNearestDate(index) {
    selectedDateIndex = index;
    noSlots = false;
    selectedSlot = '';
  }

  function selectSlot(slot) {
    if (slot.disabled) return;
    selectedSlot = slot.label;
    haptic();
  }

  function continueFromSlots() {
    if (!selectedSlot) return;
    go('address');
  }

  function handleAddressInput(event) {
    addressQuery = event.currentTarget.value;
    selectedAddress = '';
    addressError = '';
    zoneNoticeSent = false;
    showSuggestions = true;
  }

  function handlePhoneInput(event) {
    contactPhone = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
  }

  function selectAddress(item) {
    addressQuery = item.value;
    showSuggestions = false;
    if (!item.inZone) {
      selectedAddress = '';
      addressError = 'Мы пока не работаем в этом районе';
      return;
    }
    selectedAddress = item.value;
    addressError = '';
  }

  function useSavedAddress() {
    addressQuery = savedAddress;
    selectedAddress = savedAddress;
    addressError = '';
    showSuggestions = false;
  }

  function sendZoneNotice() {
    if (!notifyEmail.includes('@')) return;
    zoneNoticeSent = true;
    showToast('Сообщим, когда зона доставки расширится');
  }

  function continueFromAddress() {
    if (!selectedAddress) {
      addressError = 'Выберите адрес из подсказки';
      return;
    }
    if (contactPhone.length !== 10) {
      showToast('Укажите телефон для связи');
      return;
    }
    go('review');
  }

  function goBack() {
    if (view === 'items') go('service', 'back');
    else if (view === 'options') go('items', 'back');
    else if (view === 'insurance') go('options', 'back');
    else if (view === 'logistics-choice') go('insurance', 'back');
    else if (view === 'slots') {
      go(service === 'turnkey' ? 'insurance' : 'logistics-choice', 'back');
    } else if (view === 'address') go('slots', 'back');
    else if (view === 'warehouse') go('logistics-choice', 'back');
    else if (view === 'review') {
      go(deliveryMode === 'self' ? 'warehouse' : 'address', 'back');
    }
  }

  function requestExit() {
    exitDialogOpen = true;
  }

  function confirmExit() {
    exitDialogOpen = false;
    if (startAtService) onNavigateHome();
    else { go('home', 'back'); showToast('Черновик сохранён'); }
  }

  function showToast(message, retry = false) {
    clearTimeout(toastTimer);
    toast = { message, retry };
    if (!retry) {
      toastTimer = setTimeout(() => {
        toast = null;
      }, 3600);
    }
  }

  function buildOrderPayload() {
    return {
      operationKey, quoteHash: serverQuote?.hash, consent: acceptedTerms,
      service,
      deliveryMode,
      items: selectedRows.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: quantities[item.id],
        price: item.price
      })),
      oversizeItems: oversizeItems.map((item) => ({ ...item })),
      options: selectedOptionRows.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        kind: item.kind
      })),
      insurance: insuranceEnabled
        ? {
            declaredValue: insuranceValueNumber,
            monthlyPremium: insurancePremium,
            rate: insuranceRate
          }
        : null,
      logistics:
        deliveryMode === 'self'
          ? { warehouse }
          : {
              date: selectedDate.id || selectedDate.short,
              slot: selectedSlot,
              address: selectedAddress,
              apartment,
              intercom,
              entrance,
              floor,
              phone: '+7' + contactPhone,
              comment: courierComment
            },
      payment: {
        method: 'external-acquiring',
        cardDataStored: false
      },
      totals: {
        monthly: monthlyTotal,
        once: oneTimeTotal,
        payNow
      }
    };
  }

  async function confirmOrder() {
    if (!acceptedTerms || isSubmitting || (live && (!serverQuote || quoting))) return;
    isSubmitting = true;
    toast = null;

    try {
      const result = await onCreateOrder(buildOrderPayload());
      if (result?.ok === false) {
        showToast(
          result.message || 'Не удалось отправить заявку. Повторить?',
          true
        );
        return;
      }
      createdOrderID = result?.orderId || '';
      orderNumber =
        result?.orderNumber ||
        (demoMode ? 'WHM-824731' : '');
      draftStorage.removeItem(DRAFT_KEY);
      hasDraft = false;
      if (result?.paymentUrl && !demoMode) {
        window.location.assign(result.paymentUrl);
        return;
      }
      go('success');
    } catch {
      showToast('Не удалось отправить заявку. Повторить?', true);
    } finally {
      isSubmitting = false;
    }
  }

  function copyWarehouseAddress() {
    navigator.clipboard?.writeText(warehouse.address);
    showToast('Адрес скопирован');
  }

  function buildRoute() {
    const query = encodeURIComponent(warehouse.address);
    window.open('https://yandex.ru/maps/?text=' + query, '_blank', 'noopener,noreferrer');
  }

  function saveCalendarReminder() {
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'SUMMARY:Сдать вещи на склад',
      'LOCATION:' + warehouse.address,
      'DESCRIPTION:Номер заявки будет доступен после подтверждения.',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'whm-warehouse-reminder.ics';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Напоминание подготовлено');
  }

  function handleOversizePhoto(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      oversizePhotoName = '';
      oversizePhotoSize = 0;
      return;
    }
    if (!file.type.startsWith('image/')) {
      event.currentTarget.value = '';
      showToast('Добавьте фотографию в формате изображения');
      return;
    }
    oversizeFile = file;
    oversizePhotoName = file.name;
    oversizePhotoSize = file.size;
  }

  function openOversizeForm() {
    oversizeDescription = '';
    oversizePhotoName = '';
    oversizePhotoSize = 0;
    oversizeOpen = true;
  }

  function removeOversizeItem(id) {
    oversizeItems = oversizeItems.filter((item) => item.id !== id);
    haptic();
  }

  async function submitOversize() {
    if (oversizeDescription.trim().length < 10 || !oversizePhotoName) return;
    if (live) { const result = await onOversizeRequest({ description: oversizeDescription, file: oversizeFile }); if (result?.ok === false) { showToast(result.message); return; } oversizeOpen = false; showToast('Запрос индивидуального расчёта сохранён. Ответ появится в поддержке.'); return; }
    oversizeItems = [
      ...oversizeItems,
      {
        id: 'oversize-' + Date.now(),
        description: oversizeDescription.trim(),
        photoName: oversizePhotoName,
        photoSize: oversizePhotoSize
      }
    ];
    oversizeOpen = false;
    oversizeDescription = '';
    oversizePhotoName = '';
    oversizePhotoSize = 0;
    showToast('Негабаритный предмет добавлен');
  }

  function finishToOrder() {
    onNavigateOrder({ orderId: createdOrderID,
      orderNumber,
      order: buildOrderPayload()
    });
  }

  function finishToHome() {
    resetFlow();
    go('home', 'back');
    onNavigateHome();
  }
</script>

<svelte:head>
</svelte:head>

<div class="whm-app" data-theme={theme}>
  {#if toast}
    <div class="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {#if toast.retry}
        <button type="button" onclick={confirmOrder}>Повторить</button>
      {/if}
      <button
        type="button"
        class="toast-close"
        aria-label="Закрыть уведомление"
        onclick={() => (toast = null)}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  {/if}

  {#if view === 'home'}
    <section class="home-screen" aria-labelledby="home-title">
      <header class="home-topbar">
        <a class="brand" href="#home" aria-label="Клиентский интерфейс — главная">
          <span class="system-label">Клиентский интерфейс</span>
        </a>
        <div class="topbar-actions">
          <button
            type="button"
            class="icon-button"
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            onclick={toggleTheme}
          >
            {#if isDark}
              <Sun aria-hidden="true" />
            {:else}
              <Moon aria-hidden="true" />
            {/if}
          </button>
          <button type="button" class="avatar-button" aria-label="Открыть профиль">
            {customerName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <main class="home-content">
        <section class="home-hero">
          <div class="hero-media media-placeholder" aria-label="Плейсхолдер изображения курьерской доставки">
            <span class="placeholder-caption">Место для изображения</span>
            <div class="hero-copy">
              <h1 id="home-title">Ваши вещи всегда под рукой</h1>
              <p>
                Заберём, бережно сохраним и вернём тогда, когда они понадобятся.
              </p>
            </div>
          </div>
        </section>

        {#if hasDraft}
          <section class="draft-card" aria-label="Незавершённая заявка">
            <div>
              <h2>Оформление не завершено</h2>
              <p>Все выбранные вещи и параметры сохранены.</p>
            </div>
            <button type="button" class="secondary-button compact" onclick={resumeDraft}>
              Продолжить
            </button>
          </section>
        {/if}

        <section class="home-actions" aria-label="Действия с вещами">
          <button type="button" class="primary-button home-primary" onclick={startFlow}>
            <span>Сдать вещи</span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" class="secondary-button home-secondary" disabled>
            Вернуть вещи
            <span class="button-note">Нет вещей на хранении</span>
          </button>
        </section>

        <section class="home-summary" aria-label="Сводка">
          <article class="summary-card">
            <strong>0</strong>
            <span>вещей на хранении</span>
          </article>
          <article class="summary-card">
            <strong>Нет</strong>
            <span>активных заказов</span>
          </article>
        </section>
      </main>

      <nav class="bottom-navigation" aria-label="Основная навигация">
        <button type="button" class="nav-item active" aria-current="page">
          <Warehouse aria-hidden="true" />
          <span>Главная</span>
        </button>
        <button type="button" class="nav-item">
          <Archive aria-hidden="true" />
          <span>Мои вещи</span>
        </button>
        <button type="button" class="nav-item">
          <User aria-hidden="true" />
          <span>Профиль</span>
        </button>
      </nav>
    </section>
  {:else if view === 'success'}
    <section class="success-screen" aria-labelledby="success-title">
      <div class="success-card">
        <div class="success-media media-placeholder" aria-label="Заявка оформлена">
          <span class="success-check" aria-hidden="true">
            <Check aria-hidden="true" />
          </span>
        </div>
        <div class="success-copy">
          <h1 id="success-title">Заявка принята</h1>
          <p>Номер заявки: <strong>#{orderNumber}</strong></p>
        </div>

        <div class="success-details">
          {#if deliveryMode === 'self'}
            <h2>Ждём вас на складе</h2>
            <p>{warehouse.address}</p>
            <p>{warehouse.hours}</p>
          {:else}
            <h2>{live ? 'Выбран тестовый визит' : 'Курьер приедет'} {selectedDate.short}</h2>
            <p>{selectedSlot}, {selectedAddress}</p>
            <p>{live ? 'Доставка и напоминания симулируются.' : 'Напомним о визите за 1 час.'}</p>
          {/if}
        </div>

        <div class="success-actions">
          <button type="button" class="primary-button" onclick={finishToOrder}>
            Перейти к заказу
          </button>
          <button type="button" class="secondary-button" onclick={finishToHome}>
            На главный экран
          </button>
        </div>
      </div>
    </section>
  {:else}
    <section class="wizard-shell">
      <header class="wizard-header">
        <div class="header-side">
          {#if view !== 'service'}
            <button
              type="button"
              class="icon-button"
              aria-label="Назад"
              onclick={goBack}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          {:else}
            <span class="header-spacer"></span>
          {/if}
        </div>

        <div class="progress-wrap" aria-label={'Шаг ' + progressStep + ' из 6'}>
          <span>Шаг {progressStep} из 6</span>
          <div class="progress-dots" aria-hidden="true">
            {#each [1, 2, 3, 4, 5, 6] as step}
              <span
                class:active={step === progressStep}
                class:complete={step < progressStep}
              ></span>
            {/each}
          </div>
        </div>

        <div class="header-side end">
          <button
            type="button"
            class="icon-button small-theme"
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            onclick={toggleTheme}
          >
            {#if isDark}
              <Sun aria-hidden="true" />
            {:else}
              <Moon aria-hidden="true" />
            {/if}
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Закрыть оформление"
            onclick={requestExit}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      {#key view}
        <main
          class:slide-forward={direction === 'forward'}
          class:slide-back={direction === 'back'}
          class="wizard-screen"
        >
          {#if view === 'service'}
            <section class="screen-content compact-content" aria-labelledby="service-title">
              <div class="screen-heading">
                <h1 id="service-title">Как вы хотите сдать вещи?</h1>
                <p>Выберите удобный способ.</p>
              </div>

              <div class="service-stack">
                <article class="service-card">
                  <div class="service-media media-placeholder">
                    <span class="media-label">Курьер с коробками</span>
                  </div>
                  <div class="service-card-copy">
                    <div class="title-row">
                      <h2>Мы всё сделаем сами</h2>
                      <span class="status-badge">Популярный выбор</span>
                    </div>
                    <p>Курьер приедет, упакует и промаркирует ваши вещи.</p>
                    <div class="card-actions">
                      <button
                        type="button"
                        class="card-link-button"
                        onclick={() => chooseService('turnkey')}
                      >
                        Выбрать
                      </button>
                      <button
                        type="button"
                        class="details-button"
                        onclick={() => (serviceInfoOpen = 'turnkey')}
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                </article>

                <article class="service-card">
                  <div class="service-media media-placeholder">
                    <span class="media-label">Подготовленные коробки</span>
                  </div>
                  <div class="service-card-copy">
                    <div class="title-row">
                      <h2>Я упакую сам</h2>
                    </div>
                    <p>Подготовьте вещи — мы заберём или вы привезёте их на склад.</p>
                    <div class="card-actions">
                      <button
                        type="button"
                        class="card-link-button"
                        onclick={() => chooseService('self')}
                      >
                        Выбрать
                      </button>
                      <button
                        type="button"
                        class="details-button"
                        onclick={() => (serviceInfoOpen = 'self')}
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          {:else if view === 'items'}
            <section class="screen-content with-sticky" aria-labelledby="items-title">
              <div class="screen-heading split-heading">
                <div>
                  <h1 id="items-title">Что будем хранить?</h1>
                  <p>Выберите тип и количество.</p>
                </div>
                <button type="button" class="text-button" onclick={() => (sizeGuideOpen = true)}>
                  Как выбрать размер?
                </button>
              </div>

              <section class="content-section" aria-labelledby="boxes-heading">
                <h2 id="boxes-heading">Стандартные коробки</h2>
                <div class="box-grid">
                  {#each boxItems as item}
                    <article class="item-card" class:selected={(quantities[item.id] || 0) > 0}>
                      <div class="item-media media-placeholder">
                        <span class="media-label">{item.media}</span>
                      </div>
                      <div class="item-info">
                        <div>
                          <h2>{item.title}</h2>
                          <p>{item.dimensions}</p>
                          <p>{item.example}</p>
                          <p class="weight-limit">Ограничение по весу: {item.weightLimit}</p>
                        </div>
                        <strong>{formatPrice(item.price)} / мес.</strong>
                      </div>
                      <div class="stepper" aria-label={'Количество: ' + item.title}>
                        <button
                          type="button"
                          aria-label={'Уменьшить количество ' + item.title}
                          disabled={(quantities[item.id] || 0) === 0}
                          onclick={() => changeQuantity(item.id, -1)}
                        >
                          <Minus aria-hidden="true" />
                        </button>
                        <output aria-live="polite">{quantities[item.id] || 0}</output>
                        <button
                          type="button"
                          aria-label={'Увеличить количество ' + item.title}
                          onclick={() => changeQuantity(item.id, 1)}
                        >
                          <Plus aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  {/each}
                </div>
              </section>

              <section class="content-section" aria-labelledby="separate-heading">
                <h2 id="separate-heading">Отдельные предметы</h2>
                <div class="separate-list">
                  {#each separateItems as item}
                    <article class="separate-card" class:selected={(quantities[item.id] || 0) > 0}>
                      <div class="compact-media media-placeholder" aria-hidden="true"></div>
                      <div class="separate-copy">
                        <h2>{item.title}</h2>
                        <p>{formatPrice(item.price)} / мес.</p>
                      </div>
                      <div class="stepper compact-stepper" aria-label={'Количество: ' + item.title}>
                        <button
                          type="button"
                          aria-label={'Уменьшить количество ' + item.title}
                          disabled={(quantities[item.id] || 0) === 0}
                          onclick={() => changeQuantity(item.id, -1)}
                        >
                          <Minus aria-hidden="true" />
                        </button>
                        <output>{quantities[item.id] || 0}</output>
                        <button
                          type="button"
                          aria-label={'Увеличить количество ' + item.title}
                          onclick={() => changeQuantity(item.id, 1)}
                        >
                          <Plus aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  {/each}
                  {#each oversizeItems as item, index}
                    <article class="separate-card oversize-entity">
                      <div class="compact-media media-placeholder oversize-photo" aria-hidden="true">
                        <span class="media-label">Фото</span>
                      </div>
                      <div class="separate-copy">
                        <h2>Негабаритный предмет {index + 1}</h2>
                        <p>{item.description}</p>
                        <span class="file-caption">{item.photoName}</span>
                      </div>
                      <button
                        type="button"
                        class="remove-item-button"
                        aria-label={'Удалить негабаритный предмет ' + (index + 1)}
                        onclick={() => removeOversizeItem(item.id)}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </article>
                  {/each}
                  <button
                    type="button"
                    class="separate-card oversize-trigger"
                    onclick={openOversizeForm}
                  >
                    <div class="compact-media media-placeholder" aria-hidden="true"></div>
                    <div class="separate-copy">
                      <h2>Другое — негабарит</h2>
                      <p>Рассчитаем стоимость вручную</p>
                    </div>
                    <ChevronRight class="row-arrow" aria-hidden="true" />
                  </button>
                </div>
                {#if oversizeItems.length > 0}
                  <div class="info-note oversize-note">
                    <CircleHelp aria-hidden="true" />
                    <p>
                      Негабаритные предметы рассчитаем отдельно. Менеджер свяжется с вами
                      после оформления заявки.
                    </p>
                  </div>
                {/if}
              </section>

              <div class="sticky-bar">
                <div class="sticky-summary">
                  <span>Итого: {totalQuantity} коробок / предметов</span>
                  <strong>от {formatPrice(monthlyStorage)} / мес.</strong>
                </div>
                <button
                  type="button"
                  class="primary-button"
                  disabled={totalQuantity < 1}
                  onclick={() => go('options')}
                >
                  Продолжить
                </button>
                {#if totalQuantity < 1}
                  <p class="inline-hint">Добавьте хотя бы одну коробку или предмет.</p>
                {/if}
              </div>
            </section>
          {:else if view === 'options'}
            <section class="screen-content with-sticky" aria-labelledby="options-title">
              <div class="screen-heading split-heading">
                <div>
                  <h1 id="options-title">Дополнительные услуги</h1>
                  <p>Добавьте по необходимости.</p>
                </div>
                <button type="button" class="text-button" onclick={continueFromOptions}>
                  Пропустить
                </button>
              </div>

              <div class="option-list">
                {#each visibleOptions as option}
                  <button
                    type="button"
                    class="option-card"
                    class:selected={Boolean(optionSelections[option.id])}
                    aria-pressed={Boolean(optionSelections[option.id])}
                    onclick={() => toggleOption(option.id)}
                  >
                    <span class="option-label">{option.label}</span>
                    <span class="option-copy">
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                      <span>{formatPrice(option.price)} · {option.cadence}</span>
                    </span>
                    <span class="toggle" aria-hidden="true">
                      <span></span>
                    </span>
                  </button>
                {/each}
              </div>

              <div class="sticky-bar">
                <div class="sticky-summary">
                  <span>Хранение и услуги</span>
                  <strong>{formatPrice(monthlyTotal)} / мес. + {formatPrice(oneTimeOptions)} разово</strong>
                </div>
                <button type="button" class="primary-button" onclick={continueFromOptions}>
                  Продолжить
                </button>
              </div>
            </section>
          {:else if view === 'insurance'}
            <section class="screen-content with-sticky" aria-labelledby="insurance-title">
              <div class="screen-heading split-heading">
                <div>
                  <h1 id="insurance-title">Страхование вещей</h1>
                  <p>Укажите общую стоимость имущества, которое передаёте на хранение.</p>
                </div>
                <button type="button" class="text-button" onclick={skipInsurance}>
                  Пропустить
                </button>
              </div>

              <div class="insurance-layout">
                <section class="insurance-form-card">
                  <label for="insurance-value">
                    <span class="field-label">Заявленная стоимость вещей</span>
                    <span class="money-input">
                      <input
                        id="insurance-value"
                        type="text"
                        inputmode="numeric"
                        placeholder="Например, 50 000"
                        value={insuranceDeclaredValue}
                        oninput={handleInsuranceInput}
                      />
                      <span>₽</span>
                    </span>
                  </label>
                  <p class="field-help">
                    Минимальная сумма декларации — 1 000 ₽. Премия рассчитывается по ставке
                    {(insuranceRate * 100).toFixed(2).replace('.', ',')}% в месяц.
                  </p>
                </section>

                <section class="insurance-result" class:active={insuranceReady}>
                  <span class="option-label">Защита</span>
                  <div>
                    <h2>Страховая премия</h2>
                    {#if insuranceReady}
                      <p>
                        Покрытие на {formatPrice(insuranceValueNumber)} —
                        <strong>{formatPrice(calculatedInsurancePremium)} / мес.</strong>
                      </p>
                    {:else}
                      <p>Введите заявленную стоимость, чтобы увидеть расчёт.</p>
                    {/if}
                  </div>
                </section>

                <div class="info-note">
                  <CircleHelp aria-hidden="true" />
                  <p>Страхование необязательно. Его можно не подключать и продолжить оформление.</p>
                </div>
              </div>

              <div class="sticky-bar">
                <div class="sticky-summary">
                  <span>Страховая премия</span>
                  <strong>
                    {insuranceReady
                      ? formatPrice(calculatedInsurancePremium) + ' / мес.'
                      : 'Введите сумму'}
                  </strong>
                </div>
                <button
                  type="button"
                  class="primary-button"
                  disabled={!insuranceReady}
                  onclick={addInsurance}
                >
                  Подключить и продолжить
                </button>
              </div>
            </section>
          {:else if view === 'logistics-choice'}
            <section class="screen-content compact-content" aria-labelledby="logistics-title">
              <div class="screen-heading">
                <h1 id="logistics-title">Как передать коробки?</h1>
                <p>Выберите способ доставки на склад.</p>
              </div>

              <div class="service-stack">
                <button
                  type="button"
                  class="service-card"
                  onclick={() => chooseDelivery('courier')}
                >
                  <div class="service-media media-placeholder">
                    <span class="media-label">Курьер забирает коробки</span>
                  </div>
                  <div class="service-card-copy">
                    <h2>Курьер заберёт</h2>
                    <p>Выберите удобное время, и мы заберём готовые коробки.</p>
                    <span class="card-link">Выбрать</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="service-card"
                  onclick={() => chooseDelivery('self')}
                >
                  <div class="service-media media-placeholder">
                    <span class="media-label">Самостоятельная доставка</span>
                  </div>
                  <div class="service-card-copy">
                    <h2>Я привезу сам</h2>
                    <p>Покажем ближайший склад, режим работы и маршрут.</p>
                    <span class="card-link">Выбрать</span>
                  </div>
                </button>
              </div>
            </section>
          {:else if view === 'slots'}
            <section class="screen-content with-sticky" aria-labelledby="slots-title">
              <div class="screen-heading">
                <h1 id="slots-title">Когда приедет курьер?</h1>
                <p>Выберите дату и двухчасовой интервал.</p>
              </div>

              {#if loadingSlots}
                <div class="slot-skeleton" aria-label="Загрузка доступного времени">
                  <div class="skeleton-line wide"></div>
                  <div class="skeleton-dates">
                    {#each [1, 2, 3, 4] as item}
                      <div class="skeleton-date"></div>
                    {/each}
                  </div>
                  <div class="skeleton-slots">
                    {#each [1, 2, 3, 4, 5, 6] as item}
                      <div class="skeleton-slot"></div>
                    {/each}
                  </div>
                </div>
              {:else}
                <div class="date-scroller" aria-label="Даты">
                  {#each dates as date, index}
                    <button
                      type="button"
                      class:selected={selectedDateIndex === index}
                      disabled={date.disabled}
                      aria-pressed={selectedDateIndex === index}
                      onclick={() => selectDate(index)}
                    >
                      {date.label}
                    </button>
                  {/each}
                </div>

                {#if noSlots}
                  <div class="empty-notice" role="status">
                    <h2>На эту дату нет свободного времени</h2>
                    <p>Ближайшие свободные даты:</p>
                    <div class="nearest-dates">
                      <button type="button" onclick={() => chooseNearestDate(3)}>9 августа</button>
                      <button type="button" onclick={() => chooseNearestDate(4)}>10 августа</button>
                    </div>
                  </div>
                {:else}
                  <div class="slot-grid" aria-label="Временные интервалы">
                    {#each selectedDate.slots as slot}
                      <button
                        type="button"
                        class:selected={selectedSlot === slot.label}
                        disabled={slot.disabled}
                        aria-pressed={selectedSlot === slot.label}
                        onclick={() => selectSlot(slot)}
                      >
                        {slot.label}
                        {#if slot.disabled}
                          <span>Недоступно</span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              {/if}

              <div class="info-note">
                <CircleHelp aria-hidden="true" />
                <p>Бесплатная отмена за 2 часа до визита курьера.</p>
              </div>

              <div class="sticky-bar">
                <div class="sticky-summary">
                  <span>Время визита</span>
                  <strong>
                    {selectedSlot ? selectedDate.short + ', ' + selectedSlot : 'Выберите интервал'}
                  </strong>
                </div>
                <button
                  type="button"
                  class="primary-button"
                  disabled={!selectedSlot}
                  onclick={continueFromSlots}
                >
                  Продолжить
                </button>
              </div>
            </section>
          {:else if view === 'address'}
            <section class="screen-content with-sticky" aria-labelledby="address-title">
              <div class="screen-heading">
                <h1 id="address-title">Адрес забора вещей</h1>
                <p>Укажите точку, куда приедет курьер.</p>
              </div>

              {#if savedAddress}<button
                type="button"
                class="saved-address"
                class:selected={selectedAddress === savedAddress}
                onclick={useSavedAddress}
              >
                <span class="radio-indicator" aria-hidden="true"></span>
                <span>
                  <strong>Сохранённый адрес</strong>
                  <span>{savedAddress}</span>
                </span>
                <span class="card-link">Выбрать</span>
              </button>{/if}

              <div class="form-stack">
                <label class="field-label" for="address-search">Новый адрес</label>
                <div class="autocomplete">
                  <div class="input-with-icon" class:error={Boolean(addressError)}>
                    <Search aria-hidden="true" />
                    <input
                      id="address-search"
                      type="search"
                      placeholder="Начните вводить улицу и дом"
                      value={addressQuery}
                      oninput={handleAddressInput}
                      onfocus={() => (showSuggestions = true)}
                      autocomplete="off"
                    />
                  </div>
                  {#if showSuggestions && addressSuggestions.length > 0}
                    <div class="suggestions" role="listbox" aria-label="Подсказки адресов">
                      {#each addressSuggestions as item}
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedAddress === item.value}
                          onclick={() => selectAddress(item)}
                        >
                          <MapPin aria-hidden="true" />
                          {item.value}
                        </button>
                      {/each}
                    </div>
                  {/if}
                  {#if addressError}
                    <p class="field-error">{addressError}</p>
                  {/if}
                </div>

                {#if addressError === 'Мы пока не работаем в этом районе'}
                  <div class="zone-notice">
                    {#if zoneNoticeSent}
                      <p>Готово. Сообщим о расширении зоны.</p>
                    {:else}
                      <label class="field-label" for="zone-email">
                        Оставьте email — сообщим о расширении зоны
                      </label>
                      <div class="inline-form">
                        <input
                          id="zone-email"
                          type="email"
                          placeholder="name@example.com"
                          bind:value={notifyEmail}
                        />
                        <button
                          type="button"
                          class="secondary-button compact"
                          disabled={!notifyEmail.includes('@')}
                          onclick={sendZoneNotice}
                        >
                          Сообщить
                        </button>
                      </div>
                    {/if}
                  </div>
                {/if}

                <div class="contact-phone-field">
                  <label for="contact-phone">
                    <span class="field-label">Телефон для связи</span>
                    <span class="phone-input">
                      <span>+7</span>
                      <input
                        id="contact-phone"
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        placeholder="999 000-00-00"
                        value={contactPhone}
                        oninput={handlePhoneInput}
                      />
                    </span>
                  </label>
                  {#if contactPhone.length > 0 && contactPhone.length !== 10}
                    <p class="field-error">Введите 10 цифр после +7</p>
                  {/if}
                </div>

                <div class="address-details-grid">
                  <label>
                    <span class="field-label">Квартира</span>
                    <input type="text" placeholder="Необязательно" bind:value={apartment} />
                  </label>
                  <label>
                    <span class="field-label">Домофон</span>
                    <input type="text" placeholder="Код или номер" bind:value={intercom} />
                  </label>
                  <label>
                    <span class="field-label">Подъезд</span>
                    <input type="text" placeholder="Необязательно" bind:value={entrance} />
                  </label>
                  <label>
                    <span class="field-label">Этаж</span>
                    <input type="text" inputmode="numeric" placeholder="Необязательно" bind:value={floor} />
                  </label>
                </div>

                <label>
                  <span class="field-label">Комментарий курьеру</span>
                  <textarea
                    rows="3"
                    placeholder="Особые пометки для курьера"
                    bind:value={courierComment}
                  ></textarea>
                </label>
              </div>

              {#if !live}<div class="map-placeholder media-placeholder" aria-label="Схема адреса в демо-контуре">
                <span class="media-label">Схема адреса · демо</span>
                {#if selectedAddress}
                  <span class="map-pin" aria-hidden="true">
                    <MapPin aria-hidden="true" />
                  </span>
                {/if}
              </div>{/if}

              <div class="sticky-bar">
                <button
                  type="button"
                  class="primary-button"
                  disabled={!selectedAddress || contactPhone.length !== 10}
                  onclick={continueFromAddress}
                >
                  Продолжить
                </button>
              </div>
            </section>
          {:else if view === 'warehouse'}
            <section class="screen-content with-sticky" aria-labelledby="warehouse-title">
              <div class="screen-heading">
                <h1 id="warehouse-title">Адрес склада</h1>
                <p>Привезите подготовленные вещи в удобное время.</p>
              </div>

              {#if !live}<div class="warehouse-map media-placeholder" aria-label="Схема склада в демо-контуре">
                <span class="media-label">Схема склада · демо</span>
                <span class="map-pin" aria-hidden="true">
                  <MapPin aria-hidden="true" />
                </span>
              </div>

              {/if}<article class="warehouse-card">
                <div>
                  <h2>{warehouse.name}</h2>
                  <p>{warehouse.address}</p>
                  <p>{warehouse.hours}</p>
                </div>
                <button
                  type="button"
                  class="icon-button"
                  aria-label="Скопировать адрес"
                  onclick={copyWarehouseAddress}
                >
                  <Copy aria-hidden="true" />
                </button>
              </article>

              <div class="route-actions">
                <button type="button" class="primary-button" onclick={buildRoute}>
                  Построить маршрут
                </button>
                <button type="button" class="secondary-button" onclick={saveCalendarReminder}>
                  Сохранить в календарь
                </button>
              </div>

              <div class="info-note">
                <CircleHelp aria-hidden="true" />
                <p>QR-код заявки придёт на email после подтверждения.</p>
              </div>

              <div class="sticky-bar">
                <button type="button" class="primary-button" onclick={() => go('review')}>
                  Перейти к проверке
                </button>
              </div>
            </section>
          {:else if view === 'review'}
            <section class="screen-content review-content" aria-labelledby="review-title">
              <div class="screen-heading">
                <h1 id="review-title">Проверьте заказ</h1>
                <p>Можно вернуться к любому разделу без потери данных.</p>
              </div>

              <div class="review-stack">
                <section class="review-section">
                  <div class="review-heading">
                    <h2>Что сдаём</h2>
                    <button type="button" class="text-button" onclick={() => go('items', 'back')}>
                      Изменить
                    </button>
                  </div>
                  <div class="review-lines">
                    {#each selectedRows as item}
                      <div>
                        <span>{item.title} × {quantities[item.id]}</span>
                        <strong>{formatPrice(item.price * quantities[item.id])} / мес.</strong>
                      </div>
                    {/each}
                    {#each oversizeItems as item, index}
                      <div class="oversize-review-line">
                        <span>Негабаритный предмет {index + 1}: {item.description}</span>
                        <strong>Рассчитает менеджер</strong>
                      </div>
                    {/each}
                  </div>
                  {#if oversizeItems.length > 0}
                    <p class="review-note">
                      Стоимость негабаритных предметов не входит в предварительный итог.
                      Менеджер свяжется с вами для расчёта.
                    </p>
                  {/if}
                </section>

                <section class="review-section">
                  <div class="review-heading">
                    <h2>Дополнительные услуги</h2>
                    <button type="button" class="text-button" onclick={() => go('options', 'back')}>
                      Изменить
                    </button>
                  </div>
                  {#if selectedOptionRows.length}
                    <div class="review-lines">
                      {#each selectedOptionRows as option}
                        <div>
                          <span>{option.title}</span>
                          <strong>{formatPrice(option.price)} · {option.cadence}</strong>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p>Нет</p>
                  {/if}
                </section>

                <section class="review-section insurance-review-section">
                  <div class="review-heading">
                    <h2>Страхование</h2>
                    <button type="button" class="text-button" onclick={() => go('insurance', 'back')}>
                      Изменить
                    </button>
                  </div>
                  {#if insuranceEnabled}
                    <div class="review-lines">
                      <div>
                        <span>Заявленная стоимость</span>
                        <strong>{formatPrice(insuranceValueNumber)}</strong>
                      </div>
                      <div>
                        <span>Страховая премия</span>
                        <strong>{formatPrice(insurancePremium)} / мес.</strong>
                      </div>
                    </div>
                  {:else}
                    <p>Не подключено</p>
                  {/if}
                </section>

                <section class="review-section">
                  <div class="review-heading">
                    <h2>Передача вещей</h2>
                    <button
                      type="button"
                      class="text-button"
                      onclick={() =>
                        go(deliveryMode === 'self' ? 'warehouse' : 'slots', 'back')}
                    >
                      Изменить
                    </button>
                  </div>
                  <p>{deliverySummary}</p>
                  {#if deliveryMode === 'self'}
                    <p>{warehouse.address}</p>
                  {:else}
                    <p>{selectedDate.short}, {selectedSlot}</p>
                    <p>{selectedAddress}</p>
                    <div class="address-summary">
                      {#if apartment}<span>Квартира: {apartment}</span>{/if}
                      {#if intercom}<span>Домофон: {intercom}</span>{/if}
                      {#if entrance}<span>Подъезд: {entrance}</span>{/if}
                      {#if floor}<span>Этаж: {floor}</span>{/if}
                    </div>
                    <p>Телефон: +7 {contactPhone}</p>
                  {/if}
                </section>

                <section class="review-section payment-section">
                  <div class="review-heading">
                    <h2>Итог оплаты</h2>
                  </div>
                  <div class="review-lines">
                    <div>
                      <span>Хранение</span>
                      <strong>{formatPrice(monthlyStorage)} / мес.</strong>
                    </div>
                    <div>
                      <span>Услуги разово</span>
                      <strong>{formatPrice(oneTimeTotal)}</strong>
                    </div>
                    {#if insuranceEnabled}
                      <div>
                        <span>Страхование</span>
                        <strong>{formatPrice(insurancePremium)} / мес.</strong>
                      </div>
                    {/if}
                    <div class="grand-total">
                      <span>Итого при оформлении</span>
                      <strong>{formatPrice(payNow)}</strong>
                    </div>
                  </div>
                  <div class="acquiring-note">
                    <h2>Оплата</h2>
                    <p>
                      {live ? 'Откроется симулятор оплаты. Реальных списаний нет.' : 'После нажатия кнопки откроется защищённая платёжная форма эквайринга.'}
                      Сервис не хранит данные банковской карты.
                    </p>
                  </div>
                </section>
              </div>

              <label class="terms-card" class:checked={acceptedTerms}>
                <input type="checkbox" bind:checked={acceptedTerms} />
                <span class="custom-checkbox" aria-hidden="true">
                  <Check aria-hidden="true" />
                </span>
                <span>
                  Согласен с
                  <a href="#/info" onclick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenTerms('storage'); }}>
                    условиями хранения
                  </a>
                  и
                  <a href="#/info" onclick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenTerms('offer'); }}>
                    публичной офертой
                  </a>
                </span>
              </label>

              <button
                type="button"
                class="primary-button review-submit"
                disabled={!acceptedTerms || isSubmitting || (live && (!serverQuote || quoting))}
                onclick={confirmOrder}
              >
                {isSubmitting ? 'Оформляем…' : demoMode ? 'Оформить заявку (демо)' : 'Оплатить'}
              </button>
            </section>
          {/if}
        </main>
      {/key}
    </section>
  {/if}

  {#if serviceInfoOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (serviceInfoOpen = '')}>
      <dialog
        open
        class="modal-card process-modal"
        aria-modal="true"
        aria-labelledby="process-info-title"
        onclick={(event) => event.stopPropagation()}
      >
        <div class="modal-header">
          <div>
            <h2 id="process-info-title">{serviceDetails[serviceInfoOpen].title}</h2>
            <p>{serviceDetails[serviceInfoOpen].lead}</p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Закрыть"
            onclick={() => (serviceInfoOpen = '')}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <ol class="process-list">
          {#each serviceDetails[serviceInfoOpen].points as point, index}
            <li>
              <span>{index + 1}</span>
              <p>{point}</p>
            </li>
          {/each}
        </ol>
        <div class="info-note">
          <CircleHelp aria-hidden="true" />
          <p>{serviceDetails[serviceInfoOpen].note}</p>
        </div>
        <button
          type="button"
          class="primary-button"
          onclick={() => {
            const selectedService = serviceInfoOpen;
            serviceInfoOpen = '';
            chooseService(selectedService);
          }}
        >
          Выбрать этот вариант
        </button>
      </dialog>
    </div>
  {/if}

  {#if sizeGuideOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (sizeGuideOpen = false)}>
      <dialog
        open
        class="modal-card guide-modal"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        onclick={(event) => event.stopPropagation()}
      >
        <div class="modal-header">
          <div>
            <h2 id="size-guide-title">Как выбрать размер?</h2>
            <p>Ориентируйтесь на примеры содержимого.</p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Закрыть"
            onclick={() => (sizeGuideOpen = false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div class="guide-grid">
          {#each boxItems as item}
            <article>
              <div class="guide-media media-placeholder">
                <span class="media-label">{item.media}</span>
              </div>
              <h2>{item.title} · {item.dimensions}</h2>
              <p>{item.example}</p>
              <p>Ограничение по весу: {item.weightLimit}</p>
            </article>
          {/each}
        </div>
        <button type="button" class="primary-button" onclick={() => (sizeGuideOpen = false)}>
          Понятно
        </button>
      </dialog>
    </div>
  {/if}

  {#if oversizeOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (oversizeOpen = false)}>
      <dialog
        open
        class="modal-card"
        aria-modal="true"
        aria-labelledby="oversize-title"
        onclick={(event) => event.stopPropagation()}
      >
        <div class="modal-header">
          <div>
            <h2 id="oversize-title">Негабаритный предмет</h2>
            <p>Опишите предмет и примерные размеры.</p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Закрыть"
            onclick={() => (oversizeOpen = false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <label>
          <span class="field-label">Описание предмета</span>
          <textarea
            rows="5"
            placeholder="Например: кресло, примерно 90 × 80 × 100 см"
            bind:value={oversizeDescription}
          ></textarea>
        </label>
        <label class="photo-upload-field">
          <span class="field-label">Фотография предмета <strong>обязательно</strong></span>
          <span class="photo-upload-placeholder media-placeholder">
            <span class="media-label">
              {oversizePhotoName || 'Добавьте фотографию предмета'}
            </span>
            <span class="upload-action">
              {oversizePhotoName ? 'Заменить фотографию' : 'Выбрать фотографию'}
            </span>
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required
            onchange={handleOversizePhoto}
          />
        </label>
        <p class="modal-note">Менеджер перезвонит и рассчитает стоимость вручную.</p>
        <button
          type="button"
          class="primary-button"
          disabled={oversizeDescription.trim().length < 10 || !oversizePhotoName}
          onclick={submitOversize}
        >
          Добавить предмет
        </button>
      </dialog>
    </div>
  {/if}

  {#if exitDialogOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (exitDialogOpen = false)}>
      <dialog
        open
        class="modal-card confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        onclick={(event) => event.stopPropagation()}
      >
        <h2 id="exit-title">Прервать оформление?</h2>
        <p>Выбранные параметры сохранятся в черновике.</p>
        <div class="modal-actions">
          <button type="button" class="secondary-button" onclick={() => (exitDialogOpen = false)}>
            Остаться
          </button>
          <button type="button" class="primary-button" onclick={confirmExit}>
            Сохранить и выйти
          </button>
        </div>
      </dialog>
    </div>
  {/if}
</div>

<style>
  :global(html) {
    font-family: 'Open Sans', sans-serif;
  }

  :global(body) {
    margin: 0;
  }

  :global(button),
  :global(input),
  :global(textarea),
  :global(select) {
    font-family: 'Open Sans', sans-serif;
  }

  .whm-app,
  .whm-app *,
  .whm-app *::before,
  .whm-app *::after {
    box-sizing: border-box;
  }

  .whm-app {
    --type-h1: clamp(2rem, 7.5vw, 3.35rem);
    --type-heading: clamp(1.2rem, 4.5vw, 1.5rem);
    --type-body: 0.9375rem;
    --type-caption: 0.75rem;
    --soft-border: color-mix(in oklab, var(--color-base-content) 13%, transparent);
    --muted-border: color-mix(in oklab, var(--color-base-content) 8%, transparent);
    --soft-content: color-mix(in oklab, var(--color-base-content) 64%, transparent);
    --faint-content: color-mix(in oklab, var(--color-base-content) 47%, transparent);
    --primary-soft: color-mix(in oklab, var(--color-primary) 18%, var(--color-base-100));
    --placeholder-bg: oklch(84% 0 0);
    --placeholder-content: oklch(43% 0 0);
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--color-base-200);
    color: var(--color-base-content);
    font-family: 'Open Sans', sans-serif;
    font-size: var(--type-body);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
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
    --color-accent: oklch(0% 0 0);
    --color-accent-content: oklch(100% 0 0);
    --color-neutral: oklch(37% 0.01 67.558);
    --color-neutral-content: oklch(92% 0.003 48.717);
    --color-info: oklch(74% 0.16 232.661);
    --color-info-content: oklch(39% 0.09 240.876);
    --color-success: oklch(76% 0.177 163.223);
    --color-success-content: oklch(37% 0.077 168.94);
    --color-warning: oklch(82% 0.189 84.429);
    --color-warning-content: oklch(41% 0.112 45.904);
    --color-error: oklch(70% 0.191 22.216);
    --color-error-content: oklch(39% 0.141 25.723);
    --radius-selector: 1rem;
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --size-selector: 0.25rem;
    --size-field: 0.25rem;
    --border: 1px;
    --depth: 1;
    --noise: 0;
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
    --color-accent: oklch(64.8% 0.223 136.073);
    --color-accent-content: oklch(0% 0 0);
    --color-neutral: oklch(24.371% 0.046 65.681);
    --color-neutral-content: oklch(84.874% 0.009 65.681);
    --color-info: oklch(54.615% 0.215 262.88);
    --color-info-content: oklch(90.923% 0.043 262.88);
    --color-success: oklch(62.705% 0.169 149.213);
    --color-success-content: oklch(12.541% 0.033 149.213);
    --color-warning: oklch(66.584% 0.157 58.318);
    --color-warning-content: oklch(13.316% 0.031 58.318);
    --color-error: oklch(65.72% 0.199 27.33);
    --color-error-content: oklch(13.144% 0.039 27.33);
    --radius-selector: 1rem;
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --size-selector: 0.25rem;
    --size-field: 0.25rem;
    --border: 1px;
    --depth: 1;
    --noise: 0;
    --placeholder-bg: oklch(35% 0 0);
    --placeholder-content: oklch(76% 0 0);
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }

  button {
    color: inherit;
  }

  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 48%, transparent);
    outline-offset: 2px;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  h2 {
    font-size: var(--type-heading);
    font-weight: 700;
    line-height: 1.18;
    letter-spacing: -0.02em;
  }

  p,
  span,
  label,
  input,
  textarea,
  button,
  a {
    font-size: var(--type-body);
  }

  .media-label,
  .progress-wrap > span,
  .button-note,
  .nav-item span,
  .inline-hint,
  .field-error,
  .modal-note,
  .file-caption,
  .field-help {
    font-size: var(--type-caption);
  }

  :global(svg) {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .media-placeholder {
    position: relative;
    overflow: hidden;
    background: var(--placeholder-bg);
    color: var(--placeholder-content);
  }

  .media-label {
    font-weight: 600;
    line-height: 1.3;
  }

  .home-screen {
    min-height: 100dvh;
    padding-bottom: calc(5.25rem + env(safe-area-inset-bottom));
    background: var(--color-base-100);
  }

  .home-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: min(100%, 72rem);
    margin: 0 auto;
    padding: 1rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--color-base-content);
    font-weight: 800;
    text-decoration: none;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-button,
  .avatar-button {
    display: grid;
    flex: 0 0 auto;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: 50%;
    background: var(--color-base-100);
    color: var(--color-base-content);
    cursor: pointer;
  }

  .icon-button :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .avatar-button {
    background: var(--color-base-content);
    color: var(--color-base-100);
    font-weight: 700;
  }

  .home-content {
    display: flex;
    width: min(100%, 72rem);
    margin: 0 auto;
    padding: 0 1rem 2rem;
    flex-direction: column;
    gap: 1rem;
  }

  .home-hero {
    min-height: 22rem;
  }

  .hero-media {
    display: flex;
    min-height: 22rem;
    padding: 1.25rem;
    flex-direction: column;
    justify-content: space-between;
    border-radius: var(--radius-box);
  }

  .hero-copy {
    display: flex;
    max-width: 40rem;
    flex-direction: column;
    gap: 0.75rem;
    color: var(--color-base-content);
  }

  .hero-copy p {
    max-width: 33rem;
    color: color-mix(in oklab, var(--color-base-content) 72%, transparent);
  }

  .draft-card,
  .home-summary,
  .home-actions {
    display: grid;
    gap: 0.75rem;
  }

  .draft-card {
    padding: 1rem;
    grid-template-columns: 1fr;
    border: var(--border) solid color-mix(in oklab, var(--color-primary) 42%, transparent);
    border-radius: var(--radius-box);
    background: var(--primary-soft);
  }

  .draft-card > div {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .draft-card p,
  .summary-card span {
    color: var(--soft-content);
  }

  .primary-button,
  .secondary-button {
    display: inline-flex;
    min-height: 3.25rem;
    padding: 0.8rem 1.1rem;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    border: var(--border) solid transparent;
    border-radius: var(--radius-field);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .primary-button {
    background: var(--color-primary);
    color: var(--color-primary-content);
    box-shadow: 0 0.55rem 1.4rem color-mix(in oklab, var(--color-primary) 22%, transparent);
  }

  .primary-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 0.8rem 1.7rem color-mix(in oklab, var(--color-primary) 28%, transparent);
  }

  .secondary-button {
    border-color: var(--soft-border);
    background: var(--color-base-100);
    color: var(--color-base-content);
  }

  .secondary-button:hover:not(:disabled) {
    background: var(--color-base-200);
  }

  .primary-button:disabled,
  .secondary-button:disabled,
  .stepper button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }

  .compact {
    min-height: 2.75rem;
    padding: 0.65rem 0.9rem;
  }

  .home-primary,
  .home-secondary {
    width: 100%;
    min-height: 3.75rem;
  }

  .home-primary {
    justify-content: space-between;
    padding-inline: 1.25rem;
  }

  .home-primary :global(svg) {
    width: 1.4rem;
    height: 1.4rem;
  }

  .home-secondary {
    flex-direction: column;
    gap: 0.1rem;
  }

  .button-note {
    font-weight: 400;
  }

  .home-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-card {
    display: flex;
    min-height: 6.4rem;
    padding: 1rem;
    flex-direction: column;
    justify-content: space-between;
    border: var(--border) solid var(--muted-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
  }

  .summary-card strong {
    font-size: var(--type-heading);
  }

  .bottom-navigation {
    position: fixed;
    z-index: 20;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    height: calc(4.75rem + env(safe-area-inset-bottom));
    padding: 0.5rem max(1rem, calc((100vw - 42rem) / 2));
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    grid-template-columns: repeat(3, 1fr);
    border-top: var(--border) solid var(--muted-border);
    background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
    backdrop-filter: blur(16px);
  }

  .nav-item {
    display: flex;
    min-height: 3.5rem;
    padding: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    border: 0;
    border-radius: var(--radius-field);
    background: transparent;
    color: var(--faint-content);
    cursor: pointer;
  }

  .nav-item :global(svg) {
    width: 1.35rem;
    height: 1.35rem;
  }

  .nav-item.active {
    color: var(--color-base-content);
  }

  .wizard-shell {
    min-height: 100dvh;
    background: var(--color-base-100);
  }

  .wizard-header {
    position: sticky;
    z-index: 30;
    top: 0;
    display: grid;
    min-height: 4.75rem;
    padding: max(0.75rem, env(safe-area-inset-top)) 1rem 0.75rem;
    grid-template-columns: 5.75rem 1fr 5.75rem;
    align-items: center;
    border-bottom: var(--border) solid var(--muted-border);
    background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
    backdrop-filter: blur(16px);
  }

  .header-side {
    display: flex;
    align-items: center;
  }

  .header-side.end {
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .header-spacer {
    width: 2.75rem;
  }

  .small-theme {
    display: none;
  }

  .progress-wrap {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 0.35rem;
    color: var(--soft-content);
    font-weight: 600;
  }

  .progress-dots {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .progress-dots span {
    width: 1.25rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--color-base-300);
    transition: width 180ms ease, background 180ms ease;
  }

  .progress-dots span.active {
    width: 2rem;
    background: var(--color-primary);
  }

  .progress-dots span.complete {
    background: color-mix(in oklab, var(--color-primary) 70%, var(--color-base-300));
  }

  .wizard-screen {
    min-height: calc(100dvh - 4.75rem);
  }

  .slide-forward {
    animation: slideForward 240ms ease both;
  }

  .slide-back {
    animation: slideBack 240ms ease both;
  }

  @keyframes slideForward {
    from {
      opacity: 0;
      transform: translateX(1.2rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideBack {
    from {
      opacity: 0;
      transform: translateX(-1.2rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .screen-content {
    display: flex;
    width: min(100%, 52rem);
    min-height: calc(100dvh - 4.75rem);
    margin: 0 auto;
    padding: 1.5rem 1rem 1.25rem;
    flex-direction: column;
    gap: 1.5rem;
  }

  .compact-content {
    width: min(100%, 47rem);
  }

  .screen-heading {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .screen-heading p {
    color: var(--soft-content);
  }

  .split-heading {
    gap: 0.75rem;
  }

  .split-heading > div {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .text-button {
    width: fit-content;
    min-height: 2.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-base-content);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
    text-underline-offset: 0.25rem;
    cursor: pointer;
  }

  .service-stack {
    display: grid;
    gap: 0.85rem;
  }

  .service-card {
    display: grid;
    width: 100%;
    min-height: 12rem;
    padding: 0;
    overflow: hidden;
    grid-template-columns: 7rem 1fr;
    text-align: left;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    transition: border 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  }

  .service-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
    box-shadow: 0 1rem 2.4rem color-mix(in oklab, var(--color-base-content) 8%, transparent);
  }

  .service-media {
    display: grid;
    min-height: 100%;
    padding: 0.85rem;
    place-items: center;
    text-align: center;
  }

  .service-card-copy {
    display: flex;
    min-width: 0;
    padding: 1rem;
    flex-direction: column;
    justify-content: center;
    gap: 0.55rem;
  }

  .service-card-copy p {
    color: var(--soft-content);
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-success) 24%, var(--color-base-100));
    color: var(--color-base-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .card-link {
    margin-top: 0.2rem;
    font-weight: 700;
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .card-link-button,
  .details-button {
    min-height: 2.75rem;
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-field);
    font-weight: 700;
    cursor: pointer;
  }

  .card-link-button {
    border: var(--border) solid var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .details-button {
    border: var(--border) solid var(--soft-border);
    background: var(--color-base-100);
    color: var(--color-base-content);
  }

  .weight-limit {
    margin-top: 0.25rem;
    color: var(--color-base-content) !important;
    font-weight: 700;
  }

  .content-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .box-grid {
    display: grid;
    gap: 0.75rem;
  }

  .item-card {
    display: grid;
    padding: 0.75rem;
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    transition: border 160ms ease, background 160ms ease;
  }

  .item-card.selected,
  .separate-card.selected,
  .option-card.selected,
  .saved-address.selected {
    border-color: var(--color-primary);
    background: var(--primary-soft);
  }

  .item-media {
    display: grid;
    min-height: 5.75rem;
    padding: 0.5rem;
    place-items: center;
    text-align: center;
    border-radius: calc(var(--radius-box) - 0.3rem);
  }

  .item-info {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .item-info > div {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .item-info p,
  .separate-copy p,
  .option-copy > span,
  .review-section > p,
  .warehouse-card p,
  .success-details p {
    color: var(--soft-content);
  }

  .item-info strong,
  .separate-copy h2,
  .option-copy strong,
  .review-lines strong {
    font-size: var(--type-body);
  }

  .stepper {
    display: grid;
    grid-column: 1 / -1;
    min-height: 2.75rem;
    grid-template-columns: 2.75rem 1fr 2.75rem;
    align-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .stepper button {
    display: grid;
    width: 100%;
    height: 100%;
    padding: 0;
    place-items: center;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .stepper button :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
  }

  .stepper output {
    text-align: center;
    font-weight: 700;
  }

  .separate-list {
    display: grid;
    gap: 0.6rem;
  }

  .separate-card {
    display: grid;
    width: 100%;
    min-height: 4.5rem;
    padding: 0.65rem;
    grid-template-columns: 3rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    text-align: left;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .compact-media {
    width: 3rem;
    height: 3rem;
    border-radius: calc(var(--radius-field) - 0.15rem);
  }

  .separate-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;
  }

  .compact-stepper {
    width: 7.75rem;
    grid-column: auto;
  }

  .oversize-trigger {
    cursor: pointer;
  }

  .oversize-entity {
    align-items: start;
  }

  .oversize-photo {
    display: grid;
    place-items: center;
  }

  .file-caption {
    overflow: hidden;
    color: var(--soft-content);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-item-button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    cursor: pointer;
  }

  .remove-item-button :global(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }

  .oversize-note {
    margin-top: 0.15rem;
  }

  :global(.row-arrow) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .with-sticky {
    padding-bottom: 0;
  }

  .sticky-bar {
    position: sticky;
    z-index: 12;
    bottom: 0;
    display: flex;
    margin: auto -1rem 0;
    padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom));
    flex-direction: column;
    gap: 0.7rem;
    border-top: var(--border) solid var(--muted-border);
    background: color-mix(in oklab, var(--color-base-100) 96%, transparent);
    backdrop-filter: blur(18px);
  }

  .sticky-summary {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .sticky-summary span {
    color: var(--soft-content);
  }

  .sticky-summary strong {
    text-align: right;
  }

  .inline-hint {
    margin-top: -0.25rem;
    color: var(--soft-content);
    text-align: center;
  }

  .option-list {
    display: grid;
    gap: 0.65rem;
  }

  .option-card {
    display: grid;
    width: 100%;
    min-height: 6.25rem;
    padding: 0.85rem;
    grid-template-columns: 3.4rem minmax(0, 1fr) 2.8rem;
    align-items: center;
    gap: 0.75rem;
    text-align: left;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    cursor: pointer;
    transition: border 160ms ease, background 160ms ease;
  }

  .option-label {
    display: grid;
    width: 3.4rem;
    height: 3.4rem;
    padding: 0.25rem;
    place-items: center;
    border-radius: var(--radius-field);
    background: var(--placeholder-bg);
    color: var(--placeholder-content);
    font-size: var(--type-caption);
    font-weight: 700;
    text-align: center;
  }

  .option-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
  }

  .insurance-layout {
    display: grid;
    gap: 0.75rem;
  }

  .insurance-form-card,
  .insurance-result {
    padding: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
  }

  .insurance-form-card label {
    display: block;
  }

  .money-input,
  .phone-input {
    display: grid;
    min-height: 3.25rem;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .money-input:focus-within,
  .phone-input:focus-within {
    border-color: var(--color-primary);
  }

  .money-input input,
  .phone-input input {
    min-height: 3.1rem;
    border: 0;
    background: transparent;
  }

  .money-input > span {
    padding-right: 0.85rem;
    color: var(--soft-content);
    font-weight: 700;
  }

  .field-help {
    margin-top: 0.5rem;
    color: var(--soft-content);
  }

  .insurance-result {
    display: grid;
    grid-template-columns: 3.4rem minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
  }

  .insurance-result.active {
    border-color: var(--color-primary);
    background: var(--primary-soft);
  }

  .insurance-result > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.3rem;
  }

  .insurance-result p {
    color: var(--soft-content);
  }

  .insurance-result strong {
    color: var(--color-base-content);
  }

  .toggle {
    position: relative;
    display: block;
    width: 2.75rem;
    height: 1.6rem;
    border-radius: 999px;
    background: var(--color-base-300);
    transition: background 160ms ease;
  }

  .toggle span {
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--color-base-100);
    box-shadow: 0 0.15rem 0.35rem color-mix(in oklab, var(--color-base-content) 20%, transparent);
    transition: transform 160ms ease;
  }

  .option-card.selected .toggle {
    background: var(--color-primary);
  }

  .option-card.selected .toggle span {
    transform: translateX(1.15rem);
  }

  .date-scroller {
    display: flex;
    margin-inline: -1rem;
    padding-inline: 1rem;
    gap: 0.55rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .date-scroller::-webkit-scrollbar {
    display: none;
  }

  .date-scroller button {
    flex: 0 0 auto;
    min-height: 3.25rem;
    padding: 0.75rem 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    font-weight: 600;
    cursor: pointer;
  }

  .date-scroller button.selected {
    border-color: var(--color-primary);
    background: var(--primary-soft);
  }

  .date-scroller button:disabled,
  .slot-grid button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .slot-grid,
  .skeleton-slots {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .slot-grid button {
    display: flex;
    min-height: 4rem;
    padding: 0.7rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    font-weight: 700;
    cursor: pointer;
  }

  .slot-grid button span {
    font-size: var(--type-caption);
    font-weight: 400;
  }

  .slot-grid button.selected {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .empty-notice {
    display: flex;
    padding: 1rem;
    flex-direction: column;
    gap: 0.55rem;
    border: var(--border) solid color-mix(in oklab, var(--color-warning) 36%, transparent);
    border-radius: var(--radius-box);
    background: color-mix(in oklab, var(--color-warning) 14%, var(--color-base-100));
  }

  .nearest-dates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .nearest-dates button {
    min-height: 2.75rem;
    padding: 0.55rem 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    font-weight: 700;
    cursor: pointer;
  }

  .info-note {
    display: grid;
    padding: 0.85rem;
    grid-template-columns: 1.35rem 1fr;
    align-items: start;
    gap: 0.65rem;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
    color: var(--soft-content);
  }

  .info-note :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .slot-skeleton {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .skeleton-line,
  .skeleton-date,
  .skeleton-slot {
    background: var(--color-base-300);
    animation: pulse 1.1s ease-in-out infinite alternate;
  }

  .skeleton-line {
    width: 45%;
    height: 1rem;
    border-radius: 999px;
  }

  .skeleton-dates {
    display: flex;
    gap: 0.55rem;
  }

  .skeleton-date {
    width: 6.2rem;
    height: 3.25rem;
    border-radius: var(--radius-field);
  }

  .skeleton-slot {
    height: 4rem;
    border-radius: var(--radius-field);
  }

  @keyframes pulse {
    from {
      opacity: 0.5;
    }
    to {
      opacity: 1;
    }
  }

  .saved-address {
    display: grid;
    width: 100%;
    min-height: 5.25rem;
    padding: 0.85rem;
    grid-template-columns: 1.25rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    text-align: left;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    cursor: pointer;
  }

  .saved-address > span:nth-child(2) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
  }

  .saved-address > span:nth-child(2) > span {
    color: var(--soft-content);
  }

  .radio-indicator {
    position: relative;
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid var(--soft-content);
    border-radius: 50%;
  }

  .saved-address.selected .radio-indicator {
    border-color: var(--color-primary);
  }

  .saved-address.selected .radio-indicator::after {
    position: absolute;
    inset: 0.2rem;
    border-radius: 50%;
    background: var(--color-primary);
    content: '';
  }

  .form-stack,
  .address-details-grid {
    display: grid;
    gap: 0.75rem;
  }

  .contact-phone-field {
    display: flex;
    flex-direction: column;
  }

  .phone-input {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .phone-input > span {
    padding-left: 0.85rem;
    color: var(--soft-content);
    font-weight: 700;
  }

  .field-label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 700;
  }

  input,
  textarea {
    width: 100%;
    min-height: 3.25rem;
    padding: 0.75rem 0.85rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    outline: none;
    background: var(--color-base-100);
    color: var(--color-base-content);
    resize: vertical;
  }

  textarea {
    min-height: 5.5rem;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--faint-content);
  }

  input:focus,
  textarea:focus,
  .input-with-icon:focus-within {
    border-color: var(--color-primary);
  }

  .autocomplete {
    position: relative;
  }

  .input-with-icon {
    display: grid;
    grid-template-columns: 1.3rem 1fr;
    align-items: center;
    gap: 0.55rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .input-with-icon.error {
    border-color: var(--color-error);
  }

  .input-with-icon :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
    margin-left: 0.8rem;
    color: var(--soft-content);
  }

  .input-with-icon input {
    padding-left: 0;
    border: 0;
    background: transparent;
  }

  .suggestions {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.35rem);
    right: 0;
    left: 0;
    overflow: hidden;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    box-shadow: 0 1rem 2.5rem color-mix(in oklab, var(--color-base-content) 12%, transparent);
  }

  .suggestions button {
    display: grid;
    width: 100%;
    min-height: 3.4rem;
    padding: 0.7rem;
    grid-template-columns: 1.25rem 1fr;
    align-items: center;
    gap: 0.55rem;
    text-align: left;
    border: 0;
    border-bottom: var(--border) solid var(--muted-border);
    background: var(--color-base-100);
    cursor: pointer;
  }

  .suggestions button:last-child {
    border-bottom: 0;
  }

  .suggestions button:hover {
    background: var(--color-base-200);
  }

  .suggestions :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }

  .field-error {
    margin-top: 0.35rem;
    color: var(--color-error);
    font-weight: 600;
  }

  .zone-notice {
    padding: 0.85rem;
    border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-warning) 14%, var(--color-base-100));
  }

  .inline-form {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }

  .map-placeholder,
  .warehouse-map {
    display: grid;
    min-height: 13rem;
    padding: 1rem;
    place-items: center;
    border-radius: var(--radius-box);
    text-align: center;
  }

  .map-pin {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--color-primary-content);
    box-shadow: 0 0.75rem 1.5rem color-mix(in oklab, var(--color-base-content) 18%, transparent);
  }

  .map-pin :global(svg) {
    width: 1.7rem;
    height: 1.7rem;
  }

  .warehouse-card {
    display: grid;
    padding: 1rem;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
  }

  .warehouse-card > div {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .route-actions {
    display: grid;
    gap: 0.65rem;
  }

  .review-content {
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
  }

  .review-stack {
    display: grid;
    gap: 0.75rem;
  }

  .review-section {
    display: flex;
    padding: 1rem;
    flex-direction: column;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
  }

  .review-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .review-heading .text-button {
    min-height: auto;
  }

  .review-lines {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .review-lines > div {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .review-lines strong {
    text-align: right;
    white-space: nowrap;
  }

  .review-note {
    padding: 0.75rem;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
    color: var(--soft-content);
  }

  .oversize-review-line span {
    min-width: 0;
  }

  .insurance-review-section {
    border-color: color-mix(in oklab, var(--color-primary) 42%, var(--soft-border));
  }

  .address-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.8rem;
    color: var(--soft-content);
  }

  .grand-total {
    margin-top: 0.25rem;
    padding-top: 0.75rem;
    border-top: var(--border) solid var(--soft-border);
  }

  .grand-total span,
  .grand-total strong {
    font-size: var(--type-heading);
    font-weight: 700;
  }

  .payment-section {
    background: var(--color-base-200);
  }

  .acquiring-note {
    display: flex;
    margin-top: 0.25rem;
    padding-top: 0.85rem;
    flex-direction: column;
    gap: 0.35rem;
    border-top: var(--border) solid var(--soft-border);
  }

  .acquiring-note p {
    color: var(--soft-content);
  }

  .terms-card {
    display: grid;
    padding: 1rem;
    grid-template-columns: 1.35rem 1fr;
    align-items: start;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    cursor: pointer;
  }

  .terms-card.checked {
    border-color: var(--color-primary);
    background: var(--primary-soft);
  }

  .terms-card input {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    opacity: 0;
  }

  .custom-checkbox {
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border: 2px solid var(--soft-content);
    border-radius: 0.3rem;
  }

  .custom-checkbox :global(svg) {
    width: 1rem;
    height: 1rem;
    opacity: 0;
  }

  .terms-card.checked .custom-checkbox {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .terms-card.checked .custom-checkbox :global(svg) {
    opacity: 1;
  }

  .terms-card a {
    color: var(--color-base-content);
    font-weight: 700;
  }

  .review-submit {
    width: 100%;
  }

  .success-screen {
    display: grid;
    min-height: 100dvh;
    padding: 1rem;
    place-items: center;
    background: var(--color-base-100);
  }

  .success-card {
    display: flex;
    width: min(100%, 35rem);
    flex-direction: column;
    gap: 1.25rem;
  }

  .success-media {
    display: grid;
    min-height: 17rem;
    padding: 1rem;
    place-items: center;
    border-radius: var(--radius-box);
    text-align: center;
  }

  .success-media .media-label {
    position: absolute;
    top: 1rem;
    left: 1rem;
  }

  .success-check {
    display: grid;
    width: 5.5rem;
    height: 5.5rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-success);
    color: var(--color-success-content);
  }

  .success-check :global(svg) {
    width: 2.8rem;
    height: 2.8rem;
    stroke-width: 2.5;
  }

  .success-copy,
  .success-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .success-copy p {
    color: var(--soft-content);
  }

  .success-details {
    padding: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-200);
  }

  .success-actions,
  .modal-actions {
    display: grid;
    gap: 0.65rem;
  }

  .toast {
    position: fixed;
    z-index: 100;
    top: max(1rem, env(safe-area-inset-top));
    right: 1rem;
    left: 1rem;
    display: grid;
    min-height: 3.5rem;
    padding: 0.75rem;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-content);
    color: var(--color-base-100);
    box-shadow: 0 1rem 3rem color-mix(in oklab, var(--color-base-content) 20%, transparent);
  }

  .toast > button:not(.toast-close) {
    min-height: 2.5rem;
    padding: 0.4rem 0.65rem;
    border: var(--border) solid currentColor;
    border-radius: var(--radius-field);
    background: transparent;
    color: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .toast-close {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    place-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .toast-close :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }

  .modal-backdrop {
    position: fixed;
    z-index: 90;
    inset: 0;
    display: grid;
    padding: 1rem;
    place-items: end center;
    background: color-mix(in oklab, black 56%, transparent);
    backdrop-filter: blur(5px);
  }

  .modal-card {
    position: relative;
    display: flex;
    width: min(100%, 42rem);
    max-height: calc(100dvh - 2rem);
    padding: 1rem;
    overflow-y: auto;
    flex-direction: column;
    gap: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    color: var(--color-base-content);
    box-shadow: 0 2rem 5rem color-mix(in oklab, black 35%, transparent);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .modal-header > div {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .modal-header p,
  .modal-note,
  .confirm-modal p {
    color: var(--soft-content);
  }

  .process-list {
    display: grid;
    margin: 0;
    padding: 0;
    gap: 0.65rem;
    list-style: none;
  }

  .process-list li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    align-items: start;
    gap: 0.65rem;
  }

  .process-list li > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
  }

  .process-list p {
    padding-top: 0.25rem;
  }

  .photo-upload-field {
    display: flex;
    flex-direction: column;
  }

  .photo-upload-field .field-label strong {
    color: var(--color-error);
  }

  .photo-upload-placeholder {
    display: grid;
    min-height: 8rem;
    padding: 1rem;
    place-items: center;
    gap: 0.5rem;
    border: var(--border) dashed var(--placeholder-content);
    border-radius: var(--radius-field);
    text-align: center;
    cursor: pointer;
  }

  .photo-upload-field input {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    opacity: 0;
  }

  .upload-action {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }

  .guide-grid {
    display: grid;
    gap: 0.75rem;
  }

  .guide-grid article {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .guide-grid article p {
    color: var(--soft-content);
  }

  .guide-media {
    display: grid;
    min-height: 7rem;
    padding: 0.75rem;
    place-items: center;
    border-radius: var(--radius-field);
    text-align: center;
  }

  .confirm-modal {
    width: min(100%, 30rem);
  }

  @media (min-width: 38rem) {
    .home-topbar,
    .home-content {
      padding-inline: 1.5rem;
    }

    .draft-card {
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .home-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .small-theme {
      display: grid;
    }

    .wizard-header {
      grid-template-columns: 7rem 1fr 7rem;
    }

    .screen-content {
      padding: 2rem 1.5rem 1.5rem;
      gap: 1.75rem;
    }

    .split-heading {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }

    .service-card {
      grid-template-columns: 11rem 1fr;
    }

    .box-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .item-card {
      grid-template-columns: 6rem minmax(0, 1fr);
    }

    .address-details-grid,
    .inline-form,
    .route-actions,
    .success-actions,
    .modal-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .slot-grid,
    .skeleton-slots {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .guide-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .modal-backdrop {
      place-items: center;
    }
  }

  @media (min-width: 60rem) {
    .home-hero,
    .hero-media {
      min-height: 28rem;
    }

    .home-content {
      gap: 1.25rem;
    }

    .service-stack {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .service-card {
      min-height: 23rem;
      grid-template-columns: 1fr;
      grid-template-rows: 11rem 1fr;
    }

    .service-media {
      min-height: 11rem;
    }

    .sticky-bar {
      margin-inline: 0;
      padding-inline: 0;
      border-top: 0;
    }

    .toast {
      right: 1.5rem;
      left: auto;
      width: min(31rem, calc(100vw - 3rem));
    }
  }

  @media (max-width: 24rem) {
    .wizard-header {
      grid-template-columns: 3rem 1fr 3rem;
      padding-inline: 0.65rem;
    }

    .header-side.end .small-theme {
      display: none;
    }

    .screen-content {
      padding: 1.1rem 0.75rem 0;
      gap: 1.1rem;
    }

    .sticky-bar {
      margin-inline: -0.75rem;
      padding-inline: 0.75rem;
    }

    .service-card {
      grid-template-columns: 5.75rem 1fr;
      min-height: 10.5rem;
    }

    .service-card-copy {
      padding: 0.75rem;
    }

    .separate-card {
      grid-template-columns: 2.6rem minmax(0, 1fr) auto;
      gap: 0.5rem;
    }

    .compact-media {
      width: 2.6rem;
      height: 2.6rem;
    }

    .compact-stepper {
      width: 7rem;
    }

    .option-card {
      grid-template-columns: 2.8rem minmax(0, 1fr) 2.6rem;
      padding: 0.7rem;
      gap: 0.55rem;
    }

    .option-label {
      width: 2.8rem;
      height: 2.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  .hero-media.media-placeholder,
  .service-media.media-placeholder,
  .item-media.media-placeholder,
  .guide-media.media-placeholder,
  .compact-media.media-placeholder,
  .success-media.media-placeholder {
    background: var(--color-base-200);
    border: 1px dashed var(--color-base-300);
  }
  .placeholder-caption,
  .service-media .media-label,
  .item-media .media-label,
  .guide-media .media-label {
    display: block;
    color: var(--soft-content);
    font-size: var(--type-caption);
    font-weight: 600;
  }
  .compact-media.media-placeholder:empty::after { content: 'Фото'; color: var(--soft-content); font-size: 0.68rem; }
  .map-placeholder.media-placeholder, .warehouse-map.media-placeholder { background: var(--color-base-200); border: 1px dashed var(--color-base-300); }

</style>
