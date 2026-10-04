<script>
  import { ArrowRight, Check, ChevronLeft, Lock, Moon, Search, Sun, TriangleAlert, Truck, Warehouse, X } from '@lucide/svelte';
  import { tick } from 'svelte';

  /*
   * WHM-9 — Оформление возврата вещей
   *
   * Автономный Svelte 5 demo component.
   *
   * API hooks:
   * - onCalculateReturn(payload)
   * - onOpenPayment(payload)
   * - onCreateReturn(payload)
   * - onOpenItem(item)
   * - onComplete(payload)
   * - onExit({ draft })
   */

  const demoStorageUnits = [
    {
      id: 'BX-104',
      type: 'box',
      title: 'Коробка L',
      description: 'Зимняя одежда, пледы',
      storedSince: '12 мая 2026',
      monthlyPrice: 590,
      status: 'stored',
      size: '80 × 60 × 40 см'
    },
    {
      id: 'BX-118',
      type: 'box',
      title: 'Коробка M',
      description: 'Книги и документы',
      storedSince: '28 июня 2026',
      monthlyPrice: 390,
      status: 'stored',
      size: '60 × 40 × 40 см'
    },
    {
      id: 'IT-031',
      type: 'item',
      title: 'Велосипед',
      description: 'Городской велосипед',
      storedSince: '3 апреля 2026',
      monthlyPrice: 850,
      status: 'stored',
      size: 'Отдельный предмет'
    },
    {
      id: 'IT-044',
      type: 'item',
      title: 'Лыжи',
      description: 'Комплект с палками',
      storedSince: '19 марта 2026',
      monthlyPrice: 490,
      status: 'stored',
      size: 'Отдельный предмет'
    },
    {
      id: 'BX-122',
      type: 'box',
      title: 'Коробка M',
      description: 'Посуда и декор',
      storedSince: '7 июля 2026',
      monthlyPrice: 390,
      status: 'stored',
      size: '60 × 40 × 40 см',
      lockReason: 'Сейчас на инвентаризации'
    },
    {
      id: 'BX-097',
      type: 'box',
      title: 'Коробка L',
      description: 'Спортивная экипировка',
      storedSince: '21 февраля 2026',
      monthlyPrice: 590,
      status: 'return-requested',
      size: '80 × 60 × 40 см',
      lockReason: 'Уже добавлена в заявку #R-2041'
    }
  ];

  const demoAvailableDates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index + 2);
    return {
      id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekday: new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
    };
  });

  const demoTimeSlots = ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00'];

  const steps = [
    { id: 'select', label: 'Вещи' },
    { id: 'method', label: 'Получение' },
    { id: 'schedule', label: 'Адрес и время' },
    { id: 'review', label: 'Проверка' }
  ];

  const demoPickupWarehouse = {
    title: 'Склад — Север',
    address: 'Москва, Сигнальный проезд, 16',
    hours: 'Ежедневно, 09:00–20:00'
  };

  const demoSavedAddress = 'Москва, ул. Большая Дмитровка, 21';

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function defaultOpenPayment() {
    await delay(900);
    return { ok: true };
  }

  async function defaultCreateReturn() {
    await delay(650);
    return { ok: true, orderId: 'WHM-R-2048' };
  }

  let {
    live = false, config = null, savedAddress = demoSavedAddress, savedPhone = '', currentMonthlyPrice = null, draftKey = '',
    storageUnits = demoStorageUnits,
    initialSelectedIds = [],
    initialTheme = 'bumblebee',
    demoMode = false,
    onCalculateReturn = async () => null,
    onOpenPayment = defaultOpenPayment,
    onCreateReturn = defaultCreateReturn,
    onOpenItem = null,
    onComplete = () => {},
    onNavigateToOrder = () => {},
    onNavigateHome = null,
    onExit = () => {}
  } = $props();

  let availableDates = $derived(live ? config.dates : demoAvailableDates), timeSlots = $derived(live ? config.slots : demoTimeSlots), pickupWarehouse = $derived(live ? config.warehouses[0] : demoPickupWarehouse);
  let operationKey = $state(crypto.randomUUID()), createdOrderID = $state('');
  let screen = $state('select');
  let theme = $state('bumblebee');
  let activeFilter = $state('all');
  let searchQuery = $state('');
  let selectedIds = $state([]);
  let initialized = $state(false);
  let method = $state('');
  let infoModal = $state('');
  let itemPreview = $state(null);
  let exitConfirm = $state(false);
  let selectedDate = $state('');
  let selectedSlot = $state('');
  let addressMode = $state('saved');
  let address = $state(savedAddress);
  let apartment = $state(live ? '' : '18');
  let intercom = $state('');
  let entrance = $state(live ? '' : '2');
  let floor = $state(live ? '' : '5');
  let rawPhone = $state(live ? savedPhone.replace(/\D/g,'').replace(/^7/,'').slice(0,10) : '9991234567');
  let courierComment = $state('');
  let acceptedReturnTerms = $state(false);
  let formError = $state('');
  let isBusy = $state(false);
  let paymentState = $state('idle');
  let orderId = $state('');
  let calculatedPrice = $state(null);
  let selectAttempted = $state(false);
  let methodAttempted = $state(false);
  let scheduleAttempted = $state(false);
  let reviewAttempted = $state(false);
  let showAllReturnedItems = $state(false);

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    selectedIds = [...initialSelectedIds];
    initialized = true;
  });

  let isDark = $derived(theme === 'halloween');
  let selectableUnits = $derived(storageUnits.filter((unit) => unit.status === 'stored' && !unit.lockReason));
  let selectedUnits = $derived(storageUnits.filter((unit) => selectedIds.includes(unit.id)));
  let filteredUnits = $derived(
    storageUnits.filter((unit) => {
      const matchesFilter = activeFilter === 'all' || unit.type === activeFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        unit.title.toLowerCase().includes(query) ||
        (unit.internalID || unit.id).toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    })
  );
  let currentMonthly = $derived(currentMonthlyPrice ?? storageUnits
      .filter((unit) => unit.status === 'stored')
      .reduce((total, unit) => total + unit.monthlyPrice, 0)
  );
  let selectedMonthly = $derived(
    selectedUnits.reduce((total, unit) => total + unit.monthlyPrice, 0)
  );
  let futureMonthly = $derived(Math.max(0, currentMonthly - selectedMonthly));
  let allSelected = $derived(
    selectableUnits.length > 0 && selectableUnits.every((unit) => selectedIds.includes(unit.id))
  );
  let tripCount = $derived(Math.max(1, Math.ceil(selectedUnits.length / (live ? config.itemsPerTrip : 3))));
  let baseDeliveryPrice = $derived(method === 'courier' ? (live ? config.returnFee : 1490) + Math.max(0, tripCount - 1) * (live ? config.extraTripFee : 890) : 0);
  let deliveryPrice = $derived(calculatedPrice?.deliveryPrice ?? baseDeliveryPrice);
  let selectedDateLabel = $derived(availableDates.find((date) => date.id === selectedDate));
  let phoneValid = $derived(rawPhone.length === 10);
  let formattedPhone = $derived(formatPhone(rawPhone));
  let scheduleValid = $derived(
    Boolean(selectedDate && selectedSlot) &&
      (method === 'pickup' || (address.trim().length >= 8 && phoneValid && (!live || config.addresses.some(a=>a.inZone && a.value===address))))
  );
  let currentStep = $derived(Math.max(0, steps.findIndex((step) => step.id === screen)));
  let draftExists = $derived(
    selectedIds.length > 0 || Boolean(method) || Boolean(selectedDate) || Boolean(selectedSlot)
  );
  let missingSelection = $derived(selectAttempted && selectedIds.length === 0);
  let missingMethod = $derived(methodAttempted && !method);
  let missingAddress = $derived(scheduleAttempted && method === 'courier' && address.trim().length < 8);
  let missingPhone = $derived(scheduleAttempted && method === 'courier' && !phoneValid);
  let missingDate = $derived(scheduleAttempted && !selectedDate);
  let missingSlot = $derived(scheduleAttempted && !selectedSlot);
  let missingConsent = $derived(reviewAttempted && !acceptedReturnTerms);
  let visibleReturnedUnits = $derived(showAllReturnedItems ? selectedUnits : selectedUnits.slice(0, 5));

  $effect(() => {
    if (!live || !initialized || !draftKey || screen === 'success') return;
    sessionStorage.setItem(draftKey, JSON.stringify({ operationKey, selectedIds, method, selectedDate, selectedSlot, address, apartment, intercom, entrance, floor, rawPhone, courierComment }));
  });
  $effect.pre(() => {
    if (!live || !draftKey || !initialized) return;
    const raw = sessionStorage.getItem(draftKey);
    if (raw && !draftRestored) {
      draftRestored = true;
      try { const d = JSON.parse(raw); operationKey = d.operationKey || operationKey; selectedIds = initialSelectedIds.length ? [...initialSelectedIds] : (d.selectedIds || []); method = d.method || ''; selectedDate = d.selectedDate || ''; selectedSlot = d.selectedSlot || ''; address = d.address || ''; apartment = d.apartment || ''; intercom = d.intercom || ''; entrance = d.entrance || ''; floor = d.floor || ''; rawPhone = d.rawPhone || rawPhone; courierComment = d.courierComment || ''; } catch {}
    }
  });
  let draftRestored = $state(false);
  $effect(() => { if (live && !isBusy && screen !== 'success') { const available = new Set(selectableUnits.map(u => u.id)); const next = selectedIds.filter(id => available.has(id)); if (next.length !== selectedIds.length) { selectedIds = next; formError = 'Статус вещей изменился. Недоступные позиции сняты с выбора.'; } } });
  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const parts = [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 8),
      digits.slice(8, 10)
    ].filter(Boolean);
    return parts.join(' ');
  }

  function handlePhoneInput(event) {
    rawPhone = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
    formError = '';
  }

  function toggleUnit(id) {
    const item = storageUnits.find((unit) => unit.id === id);
    if (!item || item.lockReason || item.status !== 'stored') return;

    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    formError = '';
  }

  function toggleAll() {
    if (allSelected) {
      selectedIds = [];
    } else {
      selectedIds = selectableUnits.map((unit) => unit.id);
    }
    formError = '';
  }

  function openItemDetails(unit) {
    if (typeof onOpenItem === 'function') {
      onOpenItem(unit);
      return;
    }
    itemPreview = unit;
  }

  function goToMethod() {
    selectAttempted = true;
    if (selectedIds.length === 0) {
      formError = 'Выберите хотя бы одну коробку или предмет';
      return;
    }
    formError = '';
    screen = 'method';
  }

  function chooseMethod(value) {
    method = value;
    selectedDate = '';
    selectedSlot = '';
    calculatedPrice = null;
    formError = '';
  }

  function goToSchedule() {
    methodAttempted = true;
    if (!method) {
      formError = 'Выберите способ получения';
      return;
    }
    formError = '';
    screen = 'schedule';
  }

  async function calculateAndReview() {
    scheduleAttempted = true;
    if (!scheduleValid || isBusy) {
      formError = method === 'courier'
        ? 'Проверьте адрес, телефон, дату и время'
        : 'Выберите дату и время получения';
      return;
    }

    isBusy = true;
    formError = '';

    try {
      const result = await onCalculateReturn(buildPayload());
      if (result?.ok === false) {
        formError = result.message || 'Не удалось рассчитать стоимость';
        return;
      }
      if (result) calculatedPrice = result;
      screen = 'review';
      await tick();
      window?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (error) {
      formError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      isBusy = false;
    }
  }

  function buildPayload() {
    return {
      operationKey, quoteHash: calculatedPrice?.quote?.hash, consent: acceptedReturnTerms,
      selectedIds: [...selectedIds],
      units: selectedUnits,
      method,
      delivery: {
        date: selectedDate,
        slot: selectedSlot,
        price: deliveryPrice,
        tripCount,
        address: method === 'courier'
          ? {
              address,
              apartment,
              intercom,
              entrance,
              floor,
              phone: '+7' + rawPhone,
              comment: courierComment
            }
          : {
              warehouse: pickupWarehouse
            }
      },
      billing: {
        currentMonthly,
        futureMonthly
      }
    };
  }

  async function submitReturn() {
    reviewAttempted = true;
    if (!acceptedReturnTerms || isBusy) {
      formError = 'Подтвердите согласие с условиями возврата';
      return;
    }

    isBusy = true;
    formError = '';

    try {
      if (deliveryPrice > 0 && !live) {
        paymentState = 'processing';
        const payment = await onOpenPayment({
          amount: deliveryPrice,
          description: 'Доставка вещей со склада',
          returnPayload: buildPayload()
        });

        if (payment?.ok === false) {
          paymentState = 'idle';
          formError = payment.message || 'Оплата отменена. Данные заявки сохранены.';
          return;
        }
      }

      const result = await onCreateReturn(buildPayload());
      if (result?.ok === false) {
        paymentState = 'idle';
        formError = result.message || 'Не удалось создать заявку. Повторите попытку.';
        return;
      }

      createdOrderID = result?.orderId || '';
      orderId = result?.orderNumber || result?.orderId || (live ? '' : 'WHM-R-2048');
      if (live && draftKey) sessionStorage.removeItem(draftKey);
      paymentState = 'success';
      await delay(350);
      screen = 'success';
      onComplete({ ...buildPayload(), orderId });
    } catch (error) {
      paymentState = 'idle';
      formError = 'Нет соединения. Данные сохранены, попробуйте ещё раз.';
    } finally {
      isBusy = false;
      if (screen !== 'success') paymentState = 'idle';
    }
  }

  function goBack() {
    formError = '';
    if (screen === 'method') screen = 'select';
    else if (screen === 'schedule') screen = 'method';
    else if (screen === 'review') screen = 'schedule';
    else if (screen === 'select') requestExit();
  }

  function requestExit() {
    if (draftExists) {
      exitConfirm = true;
    } else {
      if (live && draftKey) sessionStorage.removeItem(draftKey);
      onExit({ draft: null });
    }
  }

  function confirmExit(saveDraft) {
    if (!saveDraft && live && draftKey) sessionStorage.removeItem(draftKey);
    const draft = saveDraft ? buildPayload() : null;
    exitConfirm = false;
    onExit({ draft });
  }

  function resetFlow() {
    screen = 'select';
    activeFilter = 'all';
    searchQuery = '';
    selectedIds = [];
    method = '';
    selectedDate = '';
    selectedSlot = '';
    acceptedReturnTerms = false;
    formError = '';
    paymentState = 'idle';
    orderId = '';
    calculatedPrice = null;
    selectAttempted = false;
    methodAttempted = false;
    scheduleAttempted = false;
    reviewAttempted = false;
    showAllReturnedItems = false;
  }
</script>

<svelte:head>
  <title>Возврат вещей · Клиентский интерфейс</title>
  <meta
    name="description"
    content="Оформление частичного или полного возврата вещей из хранения"
  />
</svelte:head>

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  <header class="app-header">
    <button class="brand" type="button" aria-label="Закрыть оформление" onclick={requestExit}>
      <span class="system-label">Клиентский интерфейс</span>
    </button>

    <div class="header-actions">
      {#if screen !== 'success'}
        <button class="close-button" type="button" onclick={requestExit}>Закрыть</button>
      {/if}
      <button
        class="theme-toggle"
        type="button"
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
    </div>
  </header>

  <main class="flow-shell">
    {#if screen !== 'success'}
      <nav class="progress-panel" aria-label="Этапы оформления">
        {#each steps as step, index}
          <div
            class="progress-step"
            class:active={index === currentStep}
            class:complete={index < currentStep}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span>{#if index < currentStep}<Check size={14} aria-hidden="true" />{:else}{index + 1}{/if}</span>
            <strong>{step.label}</strong>
          </div>
        {/each}
      </nav>
    {/if}

    {#key screen}
      {#if screen === 'success'}
        <section class="success-layout screen-enter">
          <div class="success-card">
            <div class="success-icon" aria-hidden="true">
              <Check aria-hidden="true" />
            </div>
            <div class="success-copy">
              <h1>Заявка на возврат создана</h1>
              <p>Мы подтвердим заявку и начнём сборку вещей на складе.</p>
            </div>

            <div class="order-number">
              <span>Номер заявки</span>
              <strong>#{orderId}</strong>
            </div>

            <div class="success-details">
              <article class="returned-items-card">
                <span>Возвращаем</span>
                <div class="returned-items-list">
                  {#each visibleReturnedUnits as unit}
                    <div class="returned-item-row">
                      <strong>{unit.title}</strong>
                      <small>{unit.id}</small>
                    </div>
                  {/each}
                </div>
                {#if selectedUnits.length > 5}
                  <button
                    class="link-toggle"
                    type="button"
                    onclick={() => (showAllReturnedItems = !showAllReturnedItems)}
                  >
                    {showAllReturnedItems ? 'Свернуть список' : `Показать ещё ${selectedUnits.length - 5}`}
                  </button>
                {/if}
              </article>
              <article>
                <span>Получение</span>
                <strong>{method === 'courier' ? 'Курьером' : 'Со склада'}</strong>
              </article>
              <article>
                <span>Дата и время</span>
                <strong>{selectedDateLabel?.day}, {selectedSlot}</strong>
              </article>
              <article>
                <span>Новая стоимость</span>
                <strong>{formatMoney(futureMonthly)}/мес.</strong>
              </article>
            </div>

            <div class="status-route" aria-label="Статусы возврата">
              <span class="done">Заявка создана</span>
              <span>Сборка на складе</span>
              <span>{method === 'courier' ? 'Доставка' : 'Выдача'}</span>
              <span>Завершение</span>
            </div>

            <div class="info-banner">
              <TriangleAlert aria-hidden="true" />
              <p>Стоимость хранения изменится после фактической передачи вещей.</p>
            </div>

            <div class="success-actions">
              <button
                class="primary-button"
                type="button"
                onclick={() => onNavigateToOrder({ ...buildPayload(), orderId: live ? createdOrderID : orderId })}
              >
                <span>Перейти к заказу</span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button
                class="secondary-button"
                type="button"
                onclick={() => (typeof onNavigateHome === 'function' ? onNavigateHome() : resetFlow())}
              >На главный экран</button>
            </div>
          </div>
        </section>
      {:else}
        <div class="flow-layout screen-enter">
          <section class="content-panel">
            <div class="panel-top">
              <button class="back-button" type="button" aria-label="Назад" onclick={goBack}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <span class="form-progress">{currentStep + 1} / {steps.length}</span>
            </div>

            {#if screen === 'select'}
              <div class="page-heading">
                <h1>Что хотите вернуть?</h1>
                <p>Выберите коробки или отдельные предметы. Каждая единица возвращается целиком.</p>
              </div>

              <label class="search-field">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Поиск по названию или номеру"
                  bind:value={searchQuery}
                  aria-label="Поиск по названию или номеру"
                />
              </label>

              <div class="filter-row">
                <div class="segmented-control" aria-label="Фильтр вещей">
                  <button class:active={activeFilter === 'all'} type="button" onclick={() => (activeFilter = 'all')}>Все</button>
                  <button class:active={activeFilter === 'box'} type="button" onclick={() => (activeFilter = 'box')}>Коробки</button>
                  <button class:active={activeFilter === 'item'} type="button" onclick={() => (activeFilter = 'item')}>Предметы</button>
                </div>
                <button class="select-all-button" type="button" onclick={toggleAll}>
                  {allSelected ? 'Снять выбор' : 'Выбрать всё'}
                </button>
              </div>

              <div class="storage-grid" class:has-error={missingSelection}>
                {#each filteredUnits as unit}
                  <article
                    class="storage-card"
                    class:selected={selectedIds.includes(unit.id)}
                    class:locked={Boolean(unit.lockReason) || unit.status !== 'stored'}
                  >
                    <label class="storage-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(unit.id)}
                        disabled={Boolean(unit.lockReason) || unit.status !== 'stored'}
                        onchange={() => toggleUnit(unit.id)}
                      />
                      <span class="custom-check" aria-hidden="true">
                        <Check aria-hidden="true" />
                      </span>
                      <span class="media-placeholder item-placeholder" role="img" aria-label="Плейсхолдер фотографии">
                        <span class="placeholder-glyph" aria-hidden="true"></span>
                        <span class="placeholder-label">Фото</span>
                      </span>
                      <span class="unit-copy">
                        <span class="unit-title-row">
                          <strong>{unit.title}</strong>
                          <span class="unit-price">{formatMoney(unit.monthlyPrice)}/мес.</span>
                        </span>
                        <span class="unit-description">{unit.description}</span>
                        <span class="unit-caption">{unit.internalID || unit.id} · хранится с {unit.storedSince}</span>
                        {#if unit.lockReason}
                          <span class="locked-note">
                            <Lock aria-hidden="true" />
                            {unit.lockReason}
                          </span>
                        {/if}
                      </span>
                    </label>
                    <button class="detail-button" type="button" onclick={() => openItemDetails(unit)}>Подробнее</button>
                  </article>
                {/each}
                {#if filteredUnits.length === 0}
                  <div class="empty-search">Ничего не найдено. Проверьте название или номер.</div>
                {/if}
              </div>

              {#if selectedIds.length === selectableUnits.length && selectableUnits.length > 1}
                <div class="warning-banner">
                  <TriangleAlert aria-hidden="true" />
                  <p>После завершения возврата у вас не останется доступных вещей на хранении.</p>
                </div>
              {/if}

              {#if formError}
                <div class="inline-error" role="alert">{formError}</div>
              {/if}

              <div class="panel-actions">
                <button class="primary-button" type="button" disabled={selectedIds.length === 0} onclick={goToMethod}>
                  <span>Продолжить</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>

              <div class="mobile-summary">
                <div>
                  <span>Выбрано: {selectedIds.length}</span>
                  <strong>{formatMoney(futureMonthly)}/мес. после возврата</strong>
                </div>
                <button class="primary-button compact-button" type="button" disabled={selectedIds.length === 0} onclick={goToMethod}>
                  <span>Продолжить</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>

            {:else if screen === 'method'}
              <div class="page-heading">
                <h1>Как хотите получить вещи?</h1>
                <p>Доставим по вашему адресу или подготовим заказ к выдаче со склада.</p>
              </div>

              <div class="method-list" class:has-error={missingMethod}>
                <article class="method-card" class:selected={method === 'courier'}>
                  <button class="method-select" type="button" onclick={() => chooseMethod('courier')}>
                    <span class="method-icon">
                      <Truck aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Доставка курьером</strong>
                      <span>Привезём вещи по выбранному адресу и в удобный слот.</span>
                    </span>
                    <span class="method-radio"></span>
                  </button>
                  <div class="method-footer">
                    <span>{selectedUnits.length > 3 ? 'Понадобится несколько поездок' : 'От ' + formatMoney(1490)}</span>
                    <button type="button" onclick={() => (infoModal = 'courier')}>Подробнее</button>
                  </div>
                </article>

                <article class="method-card" class:selected={method === 'pickup'}>
                  <button class="method-select" type="button" onclick={() => chooseMethod('pickup')}>
                    <span class="method-icon">
                      <Warehouse aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Заберу со склада</strong>
                      <span>Подготовим вещи к выдаче в выбранное время.</span>
                    </span>
                    <span class="method-radio"></span>
                  </button>
                  <div class="method-footer">
                    <span>Бесплатно</span>
                    <button type="button" onclick={() => (infoModal = 'pickup')}>Подробнее</button>
                  </div>
                </article>
              </div>

              {#if formError}
                <div class="inline-error" role="alert">{formError}</div>
              {/if}

              <div class="panel-actions">
                <button class="primary-button" type="button" onclick={goToSchedule}>
                  <span>Продолжить</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>

            {:else if screen === 'schedule'}
              <div class="page-heading">
                <h1>{method === 'courier' ? 'Куда и когда доставить?' : 'Когда подготовить вещи?'}</h1>
                <p>{method === 'courier' ? 'Проверьте адрес и выберите удобное время.' : 'Выберите дату и время получения со склада.'}</p>
              </div>

              {#if method === 'courier'}
                <div class="schedule-grid">
                  <div class="address-column">
                    {#if savedAddress}<div class="address-switch">
                      <button class:active={addressMode === 'saved'} type="button" onclick={() => { addressMode = 'saved'; address = savedAddress; }}>Сохранённый адрес</button>
                      <button class:active={addressMode === 'new'} type="button" onclick={() => { addressMode = 'new'; address = ''; }}>Новый адрес</button>
                    </div>{/if}

                    <label class="text-field full-field" class:invalid={missingAddress}>
                      <span>Адрес доставки</span>
                      <input
                        type="text"
                        list={live ? "return-addresses" : undefined}
                        autocomplete="street-address"
                        placeholder="Начните вводить адрес"
                        bind:value={address}
                        oninput={() => (formError = '')}
                      />
                      {#if live}<datalist id="return-addresses">{#each config.addresses as a}<option value={a.value}>{a.inZone ? "Тестовая зона доставки" : "Вне зоны"}</option>{/each}</datalist>{/if}
                      {#if missingAddress}<small class="field-error">Укажите адрес доставки</small>{/if}
                    </label>

                    <div class="address-fields">
                      <label class="text-field">
                        <span>Квартира</span>
                        <input type="text" inputmode="numeric" placeholder="18" bind:value={apartment} />
                      </label>
                      <label class="text-field">
                        <span>Домофон</span>
                        <input type="text" placeholder="Код" bind:value={intercom} />
                      </label>
                      <label class="text-field">
                        <span>Подъезд</span>
                        <input type="text" inputmode="numeric" placeholder="2" bind:value={entrance} />
                      </label>
                      <label class="text-field">
                        <span>Этаж</span>
                        <input type="text" inputmode="numeric" placeholder="5" bind:value={floor} />
                      </label>
                    </div>

                    <label class="text-field full-field" class:invalid={missingPhone}>
                      <span>Телефон для связи</span>
                      <span class="phone-field">
                        <span class="country-code">+7</span>
                        <input
                          type="tel"
                          inputmode="numeric"
                          autocomplete="tel-national"
                          placeholder="999 123 45 67"
                          value={formattedPhone}
                          oninput={handlePhoneInput}
                        />
                      </span>
                      {#if missingPhone}<small class="field-error">Укажите номер телефона</small>{/if}
                    </label>

                    <label class="text-field full-field">
                      <span>Комментарий курьеру <small>необязательно</small></span>
                      <textarea rows="3" placeholder="Особые пометки для доставки" bind:value={courierComment}></textarea>
                    </label>
                  </div>

                  <div class="date-column">
                    <div class="schedule-section">
                      <h2>Дата</h2>
                      <div class="date-row" class:has-error={missingDate}>
                        {#each availableDates as date}
                          <button class:active={selectedDate === date.id} type="button" onclick={() => { selectedDate = date.id; formError = ''; }}>
                            <span>{date.weekday}</span>
                            <strong>{date.day}</strong>
                          </button>
                        {/each}
                      </div>
                    </div>
                    <div class="schedule-section">
                      <h2>Время</h2>
                      <div class="slot-grid" class:has-error={missingSlot}>
                        {#each timeSlots as slot, index}
                          <button
                            class:active={selectedSlot === slot}
                            disabled={!live && index === 2}
                            type="button"
                            onclick={() => { selectedSlot = slot; formError = ''; }}
                          >
                            {slot}
                            {#if !live && index === 2}<small>занято</small>{/if}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="pickup-layout">
                  <div class="warehouse-card">
                    <span class="method-icon large">
                      <Warehouse aria-hidden="true" />
                    </span>
                    <div>
                      <h2>{pickupWarehouse.title}</h2>
                      <p>{pickupWarehouse.address}</p>
                      <span>{pickupWarehouse.hours}</span>
                    </div>
                    <button class="secondary-button route-button" type="button">Построить маршрут</button>
                  </div>

                  <div class="pickup-schedule">
                    <div class="schedule-section">
                      <h2>Дата</h2>
                      <div class="date-row" class:has-error={missingDate}>
                        {#each availableDates as date}
                          <button class:active={selectedDate === date.id} type="button" onclick={() => { selectedDate = date.id; formError = ''; }}>
                            <span>{date.weekday}</span>
                            <strong>{date.day}</strong>
                          </button>
                        {/each}
                      </div>
                    </div>
                    <div class="schedule-section">
                      <h2>Время</h2>
                      <div class="slot-grid" class:has-error={missingSlot}>
                        {#each timeSlots.slice(0, 4) as slot}
                          <button class:active={selectedSlot === slot} type="button" onclick={() => { selectedSlot = slot; formError = ''; }}>{slot}</button>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <div class="info-banner">
                    <TriangleAlert aria-hidden="true" />
                    <p>Для получения понадобится документ и номер заявки.</p>
                  </div>
                </div>
              {/if}

              {#if formError}
                <div class="inline-error" role="alert">{formError}</div>
              {/if}

              <div class="panel-actions">
                <button class="primary-button" type="button" disabled={isBusy} onclick={calculateAndReview}>
                  {#if isBusy}
                    <span class="button-spinner"></span>
                    <span>Рассчитываем</span>
                  {:else}
                    <span>Продолжить</span>
                    <ArrowRight aria-hidden="true" />
                  {/if}
                </button>
              </div>

            {:else if screen === 'review'}
              <div class="page-heading">
                <h1>Проверьте заявку</h1>
                <p>Убедитесь, что состав возврата и данные получения указаны верно.</p>
              </div>

              <div class="review-list">
                <article class="review-card">
                  <div class="review-head">
                    <h2>Возвращаем</h2>
                    <button type="button" onclick={() => (screen = 'select')}>Изменить</button>
                  </div>
                  <div class="review-items">
                    {#each selectedUnits as unit}
                      <div>
                        <span>{unit.title}</span>
                        <strong>{unit.id}</strong>
                      </div>
                    {/each}
                  </div>
                </article>

                <article class="review-card">
                  <div class="review-head">
                    <h2>Получение</h2>
                    <button type="button" onclick={() => (screen = 'method')}>Изменить</button>
                  </div>
                  <div class="review-main">
                    <strong>{method === 'courier' ? 'Доставка курьером' : 'Самостоятельное получение'}</strong>
                    <span>{method === 'courier' ? address : pickupWarehouse.address}</span>
                    <span>{selectedDateLabel?.weekday}, {selectedDateLabel?.day} · {selectedSlot}</span>
                    {#if method === 'courier'}
                      <span>Телефон: +7 {formattedPhone}</span>
                    {/if}
                  </div>
                </article>

                <article class="review-card price-review">
                  <div class="review-head">
                    <h2>Стоимость</h2>
                  </div>
                  <div class="price-lines">
                    <div><span>{method === 'courier' ? 'Доставка' : 'Выдача со склада'}</span><strong>{formatMoney(deliveryPrice)}</strong></div>
                    {#if method === 'courier' && tripCount > 1}
                      <div><span>Количество поездок</span><strong>{tripCount}</strong></div>
                    {/if}
                    <div><span>Хранение сейчас</span><strong>{formatMoney(currentMonthly)}/мес.</strong></div>
                    <div class="future-line"><span>После завершения возврата</span><strong>{formatMoney(futureMonthly)}/мес.</strong></div>
                  </div>
                  <div class="info-banner compact-info">
                    <TriangleAlert aria-hidden="true" />
                    <p>Стоимость хранения изменится после фактической передачи вещей.</p>
                  </div>
                </article>
              </div>

              <label class="consent-item" class:invalid={missingConsent}>
                <input type="checkbox" bind:checked={acceptedReturnTerms} oninput={() => (formError = '')} />
                <span>
                  Я соглашаюсь с
                  <a href="#/return" onclick={(event) => { event.preventDefault(); event.stopPropagation(); infoModal = 'terms'; }}>условиями возврата и доставки вещей</a>
                </span>
              </label>

              {#if formError}
                <div class="inline-error" role="alert">{formError}</div>
              {/if}

              <div class="panel-actions">
                <button class="primary-button" type="button" disabled={isBusy} onclick={submitReturn}>
                  {#if isBusy}
                    <span class="button-spinner"></span>
                    <span>Создаём заявку</span>
                  {:else}
                    <span>{demoMode ? 'Оформить возврат (демо)' : deliveryPrice > 0 ? 'Оплатить ' + formatMoney(deliveryPrice) : 'Подтвердить возврат'}</span>
                    <ArrowRight aria-hidden="true" />
                  {/if}
                </button>
              </div>
            {/if}
          </section>
        </div>
      {/if}
    {/key}
  </main>

  {#if infoModal}
    <div class="modal-backdrop" role="presentation" onclick={() => (infoModal = '')}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="method-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={() => (infoModal = '')}><X aria-hidden="true" /></button>
        {#if infoModal !== 'terms'}<span class="method-icon large">
          {#if infoModal === 'courier'}
            <Truck aria-hidden="true" />
          {:else}
            <Warehouse aria-hidden="true" />
          {/if}
        </span>{/if}
        <h2 id="method-modal-title">{infoModal === 'terms' ? 'Условия возврата и доставки' : infoModal === 'courier' ? 'Доставка курьером' : 'Получение со склада'}</h2>
        {#if infoModal === 'terms'}
          <p>Текст условий ещё не утверждён. В демо-контуре согласие не фиксируется, заявка не передаётся на сервер и реальные платежи не проводятся.</p>
        {:else if infoModal === 'courier'}
          <p>После подтверждения заявки склад соберёт выбранные вещи. Вы сможете следить за статусом и получите напоминание перед приездом курьера.</p>
          <ul>
            <li>Стоимость зависит от количества поездок</li>
            <li>Двухчасовые интервалы доставки</li>
            <li>Оплата только за обратную доставку</li>
          </ul>
        {:else}
          <p>Мы подготовим вещи к выбранному времени. Для получения понадобится документ и номер заявки.</p>
          <ul>
            <li>Получение бесплатно</li>
            <li>Заказ выдаётся только после статуса «Готов к выдаче»</li>
            <li>Адрес и маршрут будут доступны в активном заказе</li>
          </ul>
        {/if}
        <button class="primary-button" type="button" onclick={() => (infoModal = '')}>Понятно</button>
      </div>
    </div>
  {/if}

  {#if itemPreview}
    <div class="modal-backdrop" role="presentation" onclick={() => (itemPreview = null)}>
      <div
        class="modal-card item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={() => (itemPreview = null)}><X aria-hidden="true" /></button>
        <div class="media-placeholder modal-placeholder" role="img" aria-label="Плейсхолдер фотографии">
          <span class="placeholder-glyph" aria-hidden="true"></span>
          <span class="placeholder-label">Фото</span>
        </div>
        <h2 id="item-modal-title">{itemPreview.title}</h2>
        <p>{itemPreview.description}</p>
        <dl>
          <div><dt>Идентификатор</dt><dd>{itemPreview.internalID || itemPreview.id}</dd></div>
          <div><dt>Размер</dt><dd>{itemPreview.size}</dd></div>
          <div><dt>На хранении</dt><dd>с {itemPreview.storedSince}</dd></div>
          <div><dt>Стоимость</dt><dd>{formatMoney(itemPreview.monthlyPrice)}/мес.</dd></div>
        </dl>
        {#if itemPreview.lockReason}
          <div class="warning-banner"><p>{itemPreview.lockReason}</p></div>
        {/if}
        <button class="primary-button" type="button" onclick={() => (itemPreview = null)}>Закрыть</button>
      </div>
    </div>
  {/if}

  {#if exitConfirm}
    <div class="modal-backdrop" role="presentation" onclick={() => (exitConfirm = false)}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={() => (exitConfirm = false)}><X aria-hidden="true" /></button>
        <h2 id="exit-modal-title">Прервать оформление?</h2>
        <p>Вы можете сохранить выбранные вещи и продолжить позже.</p>
        <div class="modal-actions">
          <button class="primary-button" type="button" onclick={() => confirmExit(true)}>Сохранить черновик</button>
          <button class="secondary-button" type="button" onclick={() => confirmExit(false)}>Выйти без сохранения</button>
        </div>
      </div>
    </div>
  {/if}

  {#if paymentState === 'processing'}
    <div class="payment-overlay" role="status" aria-live="polite">
      <div class="payment-card">
        <span class="button-spinner large-spinner"></span>
        <h2>{demoMode ? 'Оформляем демо-заявку' : 'Переходим к оплате'}</h2>
        <p>{demoMode ? 'Реальное списание не выполняется.' : 'Оплата доставки проходит во внешнем эквайринге.'}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(html) {
    min-width: 320px;
    background: var(--color-base-100, white);
  }

  :global(body) {
    margin: 0;
    font-family: 'Open Sans', sans-serif;
  }

  :global(button),
  :global(input),
  :global(select),
  :global(textarea) {
    font: inherit;
    font-family: 'Open Sans', sans-serif;
  }

  :global(button) {
    -webkit-tap-highlight-color: transparent;
  }

  .whm-app {
    --page-gutter: clamp(1rem, 3vw, 2.5rem);
    --header-height: 5.25rem;
    --content-max: 90rem;
    --type-h1: clamp(2.25rem, 4.2vw, 4.25rem);
    --type-heading: clamp(1.35rem, 2.2vw, 2rem);
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
    font-family: 'Open Sans', sans-serif;
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
    --border: 1px;
  }

  .ambient {
    position: fixed;
    z-index: -1;
    border-radius: 999px;
    pointer-events: none;
    opacity: 0.62;
  }

  .ambient-one {
    top: -17rem;
    right: -13rem;
    width: 38rem;
    height: 38rem;
    background: radial-gradient(circle, var(--primary-soft), transparent 68%);
  }

  .ambient-two {
    bottom: -21rem;
    left: -17rem;
    width: 44rem;
    height: 44rem;
    background: radial-gradient(circle, color-mix(in oklab, var(--color-secondary) 11%, transparent), transparent 67%);
  }

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

  .brand,
  .header-actions,
  .panel-top,
  .filter-row,
  .review-head {
    display: flex;
    align-items: center;
  }

  .brand {
    gap: 0.7rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .header-actions {
    gap: 0.65rem;
  }

  .close-button {
    min-height: 2.75rem;
    padding: 0.35rem 0.75rem;
    border: 0;
    background: transparent;
    color: var(--soft-content);
    cursor: pointer;
  }

  .theme-toggle,
  .back-button {
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    padding: 0;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
    color: var(--color-base-content);
    cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }

  .theme-toggle:hover,
  .back-button:hover {
    border-color: var(--color-primary);
    background: var(--color-base-200);
  }

  .theme-toggle:active,
  .back-button:active {
    transform: scale(0.96);
  }

  .theme-toggle :global(svg),
  .back-button :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .flow-shell {
    width: min(calc(100% - (var(--page-gutter) * 2)), var(--content-max));
    min-height: calc(100dvh - var(--header-height) - 1.5rem);
    margin: 0 auto 1.5rem;
  }

  .progress-panel {
    min-height: 4.2rem;
    padding: 0.8rem clamp(1rem, 2.5vw, 2rem);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-items: center;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box) var(--radius-box) 0 0;
    background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
  }

  .progress-step {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--faint-content);
  }

  .progress-step:not(:last-child)::after {
    content: '';
    position: absolute;
    left: calc(100% - 0.2rem);
    width: calc(100% - 2.9rem);
    height: 1px;
    background: var(--soft-border);
  }

  .progress-step > span {
    width: 1.7rem;
    height: 1.7rem;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border: var(--border) solid var(--soft-border);
    border-radius: 50%;
    background: var(--color-base-100);
    font-size: var(--type-caption);
    font-weight: 800;
  }

  .progress-step strong {
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .progress-step.active,
  .progress-step.complete {
    color: var(--color-base-content);
  }

  .progress-step.active > span,
  .progress-step.complete > span {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .flow-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    border: var(--border) solid var(--soft-border);
    border-top: 0;
    border-radius: 0 0 var(--radius-box) var(--radius-box);
    overflow: hidden;
    background: var(--color-base-100);
    box-shadow: 0 24px 70px color-mix(in oklab, var(--color-base-content) 7%, transparent);
  }

  .content-panel {
    min-width: 0;
    min-height: 43rem;
    padding: clamp(1.25rem, 3.5vw, 3.5rem);
  }

  .panel-top {
    justify-content: space-between;
  }

  .form-progress {
    color: var(--faint-content);
    font-weight: 750;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .page-heading {
    max-width: 48rem;
    margin-top: clamp(1.5rem, 4vh, 3rem);
  }

  .page-heading h1,
  .success-copy h1 {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 810;
    letter-spacing: -0.045em;
    line-height: 1.02;
    text-wrap: balance;
  }

  .page-heading p,
  .success-copy p {
    max-width: 42rem;
    margin: 1rem 0 0;
    color: var(--soft-content);
  }

  .search-field {
    margin-top: 1.5rem;
    min-height: 3.25rem;
    padding: 0 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }

  .search-field:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--primary-faint);
  }

  .search-field :global(svg) {
    width: 1.1rem;
    flex: 0 0 auto;
    fill: none;
    stroke: var(--faint-content);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .search-field input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-base-content);
  }

  .search-field input::placeholder {
    color: var(--faint-content);
  }

  .filter-row {
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1.25rem;
  }

  .segmented-control {
    padding: 0.25rem;
    display: flex;
    gap: 0.2rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-200);
  }

  .segmented-control button,
  .address-switch button {
    min-height: 2.5rem;
    padding: 0.55rem 0.85rem;
    border: 0;
    border-radius: calc(var(--radius-field) - 0.2rem);
    background: transparent;
    color: var(--soft-content);
    cursor: pointer;
  }

  .segmented-control button.active,
  .address-switch button.active {
    background: var(--color-base-100);
    color: var(--color-base-content);
    box-shadow: 0 2px 8px color-mix(in oklab, var(--color-base-content) 7%, transparent);
    font-weight: 700;
  }

  .select-all-button,
  .detail-button,
  .method-footer button,
  .review-head button {
    min-height: 2.75rem;
    padding: 0.35rem 0;
    border: 0;
    background: transparent;
    color: var(--color-base-content);
    font-weight: 750;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }

  .storage-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-top: 1.25rem;
    padding: 0.4rem;
    border: 2px solid transparent;
    border-radius: var(--radius-box);
    transition: border-color 180ms ease;
  }

  .storage-grid.has-error {
    border-color: var(--color-error);
    background: color-mix(in oklab, var(--color-error) 6%, transparent);
  }

  .empty-search {
    grid-column: 1 / -1;
    padding: 1.5rem;
    text-align: center;
    color: var(--soft-content);
    border: var(--border) dashed var(--soft-border);
    border-radius: var(--radius-box);
  }

  .storage-card {
    position: relative;
    min-width: 0;
    padding: 0.85rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }

  .storage-card:hover:not(.locked) {
    transform: translateY(-1px);
    border-color: color-mix(in oklab, var(--color-primary) 55%, var(--soft-border));
  }

  .storage-card.selected {
    border-color: var(--color-primary);
    background: var(--primary-faint);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .storage-card.locked {
    background: var(--color-base-200);
    opacity: 0.68;
  }

  .storage-select {
    position: relative;
    display: grid;
    grid-template-columns: 5.7rem minmax(0, 1fr);
    gap: 0.9rem;
    cursor: pointer;
  }

  .storage-card.locked .storage-select {
    cursor: not-allowed;
  }

  .storage-select > input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .custom-check {
    position: absolute;
    z-index: 3;
    top: 0.45rem;
    left: 0.45rem;
    width: 1.55rem;
    height: 1.55rem;
    display: grid;
    place-items: center;
    border: 2px solid color-mix(in oklab, var(--color-base-content) 35%, transparent);
    border-radius: 0.38rem;
    background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
    color: var(--color-primary-content);
  }

  .custom-check :global(svg) {
    width: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    opacity: 0;
  }

  .storage-card.selected .custom-check {
    border-color: var(--color-primary);
    background: var(--color-primary);
  }

  .storage-card.selected .custom-check :global(svg) {
    opacity: 1;
  }

  .media-placeholder {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: var(--border) solid color-mix(in oklab, var(--color-base-content) 14%, transparent);
    border-radius: var(--radius-box);
    background: color-mix(in oklab, var(--color-base-content) 14%, var(--color-base-100));
    color: color-mix(in oklab, var(--color-base-content) 48%, transparent);
  }

  .media-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 49.8%, color-mix(in oklab, var(--color-base-content) 7%, transparent) 50%, transparent 50.2%);
    pointer-events: none;
  }

  .placeholder-glyph {
    position: relative;
    z-index: 1;
    width: 2.2rem;
    height: 1.65rem;
    border: 1.5px solid currentColor;
    border-radius: 0.35rem;
    opacity: 0.72;
  }

  .placeholder-glyph::before {
    content: '';
    position: absolute;
    left: 0.35rem;
    top: 0.3rem;
    width: 0.32rem;
    height: 0.32rem;
    border: 1.5px solid currentColor;
    border-radius: 50%;
  }

  .placeholder-glyph::after {
    content: '';
    position: absolute;
    left: 0.38rem;
    right: 0.38rem;
    bottom: 0.34rem;
    height: 0.6rem;
    border: 1.5px solid currentColor;
    border-width: 1.5px 1.5px 0 0;
    transform: skewX(-35deg) rotate(-25deg);
  }

  .placeholder-label {
    position: absolute;
    z-index: 1;
    right: 0.55rem;
    bottom: 0.4rem;
    color: currentColor;
    font-weight: 650;
  }

  .item-placeholder {
    width: 5.7rem;
    height: 6.4rem;
  }

  .unit-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .unit-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .unit-title-row > strong {
    font-weight: 780;
  }

  .unit-price {
    flex: 0 0 auto;
    color: var(--soft-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .unit-description {
    margin-top: 0.25rem;
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .unit-caption {
    margin-top: auto;
    color: var(--faint-content);
    font-size: var(--type-caption);
  }

  .locked-note {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.35rem;
    color: var(--color-warning);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .locked-note :global(svg) {
    width: 0.9rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
  }

  .detail-button {
    margin: 0.35rem 0 -0.35rem 6.6rem;
    font-size: var(--type-caption);
  }

  .warning-banner,
  .info-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    margin-top: 1rem;
    padding: 0.9rem 1rem;
    border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-warning) 14%, var(--color-base-100));
    color: var(--color-base-content);
  }

  .info-banner {
    background: var(--primary-faint);
  }

  .warning-banner :global(svg),
  .info-banner :global(svg) {
    width: 1.15rem;
    flex: 0 0 auto;
    margin-top: 0.12rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .warning-banner p,
  .info-banner p {
    margin: 0;
    color: inherit;
    font-size: var(--type-caption);
  }

  .inline-error {
    margin-top: 0.8rem;
    color: var(--color-error);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .field-error {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-error);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .primary-button,
  .secondary-button {
    min-height: 3.5rem;
    width: 100%;
    border-radius: var(--radius-field);
    font-weight: 750;
    cursor: pointer;
    transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  }

  .primary-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1.1rem;
    border: var(--border) solid color-mix(in oklab, var(--color-primary-content) 12%, transparent);
    background: var(--color-primary);
    color: #171717;
    box-shadow: 0 10px 24px color-mix(in oklab, var(--color-primary) 22%, transparent);
  }

  .primary-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 14px 28px color-mix(in oklab, var(--color-primary) 30%, transparent);
  }

  .primary-button:disabled,
  .secondary-button:disabled {
    opacity: 0.36;
    cursor: not-allowed;
    box-shadow: none;
  }

  .primary-button :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .secondary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    padding: 0.85rem 1rem;
    border: var(--border) solid var(--soft-border);
    background: var(--color-base-100);
    color: var(--color-base-content);
  }

  .secondary-button:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-base-200);
  }

  .panel-actions {
    width: min(100%, 27rem);
    margin: 1.75rem 0 0 auto;
  }

  .mobile-summary {
    display: none;
  }

  .method-list {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    padding: 0.4rem;
    border: 2px solid transparent;
    border-radius: var(--radius-box);
    transition: border-color 180ms ease;
  }

  .method-list.has-error {
    border-color: var(--color-error);
    background: color-mix(in oklab, var(--color-error) 6%, transparent);
  }

  .method-card {
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    overflow: hidden;
    background: var(--color-base-100);
    transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }

  .method-card.selected {
    border-color: var(--color-primary);
    background: var(--primary-faint);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .method-select {
    width: 100%;
    padding: 1.3rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .method-select > span:nth-child(2) {
    display: grid;
    gap: 0.25rem;
  }

  .method-select strong {
    font-size: var(--type-heading);
    line-height: 1.2;
  }

  .method-select span span {
    color: var(--soft-content);
  }

  .method-icon {
    width: 3rem;
    height: 3rem;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: var(--radius-field);
    background: var(--primary-soft);
  }

  .method-icon.large {
    width: 3.6rem;
    height: 3.6rem;
  }

  .method-icon :global(svg) {
    width: 1.55rem;
    fill: none;
    stroke: var(--color-base-content);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .method-radio {
    width: 1.4rem;
    height: 1.4rem;
    border: 2px solid color-mix(in oklab, var(--color-base-content) 28%, transparent);
    border-radius: 50%;
    box-shadow: inset 0 0 0 0.3rem var(--color-base-100);
  }

  .method-card.selected .method-radio {
    border-color: var(--color-primary);
    background: var(--color-primary);
  }

  .method-footer {
    min-height: 3.3rem;
    padding: 0 1.3rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-top: var(--border) solid var(--soft-border);
    color: var(--soft-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .method-footer button {
    font-size: var(--type-caption);
  }

  .schedule-grid {
    display: grid;
    grid-template-columns: minmax(19rem, 0.9fr) minmax(19rem, 1.1fr);
    gap: 1.2rem;
    margin-top: 2rem;
  }

  .address-column,
  .date-column {
    min-width: 0;
    padding: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
  }

  .address-switch {
    padding: 0.25rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.2rem;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
  }

  .text-field {
    display: grid;
    gap: 0.45rem;
    color: var(--soft-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .text-field small {
    color: var(--faint-content);
    font-size: var(--type-caption);
    font-weight: 550;
  }

  .full-field {
    margin-top: 0.85rem;
  }

  .text-field > input,
  .text-field textarea {
    min-height: 3.45rem;
    width: 100%;
    padding: 0.75rem 0.9rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    outline: 0;
    background: var(--color-base-100);
    color: var(--color-base-content);
    resize: vertical;
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }

  .text-field.invalid > input,
  .text-field.invalid textarea,
  .text-field.invalid .phone-field {
    border-color: var(--color-error);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-error) 16%, transparent);
  }

  .text-field > input:focus,
  .text-field textarea:focus,
  .phone-field:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--primary-faint);
  }

  .text-field input::placeholder,
  .text-field textarea::placeholder {
    color: var(--faint-content);
  }

  .phone-field {
    min-height: 3.45rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .country-code {
    padding: 0 0.8rem 0 0.95rem;
    border-right: var(--border) solid var(--soft-border);
    color: var(--color-base-content);
    font-weight: 700;
  }

  .phone-field input {
    width: 100%;
    min-width: 0;
    height: 3.3rem;
    padding: 0 0.9rem;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-base-content);
    font-weight: 650;
    letter-spacing: 0.03em;
  }

  .address-fields {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.55rem;
    margin-top: 0.8rem;
  }

  .schedule-section {
    margin-top: 1.2rem;
  }

  .schedule-section h2,
  .review-head h2,
  .warehouse-card h2,
  .modal-card h2,
  .payment-card h2 {
    margin: 0;
    font-size: var(--type-heading);
    font-weight: 780;
    letter-spacing: -0.025em;
  }

  .date-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: 0.7rem;
    padding: 0.35rem;
    border: 2px solid transparent;
    border-radius: var(--radius-box);
    transition: border-color 180ms ease;
  }

  .date-row.has-error,
  .slot-grid.has-error {
    border-color: var(--color-error);
    background: color-mix(in oklab, var(--color-error) 6%, transparent);
  }

  .date-row button {
    min-height: 4rem;
    padding: 0.55rem 0.3rem;
    display: grid;
    place-items: center;
    gap: 0.1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    color: var(--color-base-content);
    cursor: pointer;
  }

  .date-row button span {
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .date-row button strong {
    font-size: var(--type-caption);
  }

  .date-row button.active,
  .slot-grid button.active {
    border-color: var(--color-primary);
    background: var(--primary-soft);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .slot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.7rem;
    padding: 0.35rem;
    border: 2px solid transparent;
    border-radius: var(--radius-box);
    transition: border-color 180ms ease;
  }

  .slot-grid button {
    min-height: 3.1rem;
    padding: 0.6rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    color: var(--color-base-content);
    cursor: pointer;
  }

  .slot-grid button:disabled {
    color: var(--faint-content);
    background: var(--color-base-200);
    cursor: not-allowed;
  }

  .slot-grid button small {
    display: block;
    font-size: var(--type-caption);
  }

  .pickup-layout {
    display: grid;
    grid-template-columns: minmax(18rem, 0.85fr) minmax(20rem, 1.15fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .warehouse-card {
    padding: 1.25rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
  }

  .warehouse-card p {
    margin: 0.35rem 0 0;
    color: var(--soft-content);
  }

  .warehouse-card > div > span {
    color: var(--faint-content);
    font-size: var(--type-caption);
  }

  .route-button {
    grid-column: 1 / -1;
  }

  .pickup-schedule {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .pickup-schedule .schedule-section {
    margin: 0;
    padding: 1rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
  }

  .pickup-layout > .info-banner {
    grid-column: 1 / -1;
    margin-top: 0;
  }

  .review-list {
    display: grid;
    gap: 0.85rem;
    margin-top: 2rem;
  }

  .review-card {
    padding: 1.2rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
  }

  .review-head {
    justify-content: space-between;
    gap: 1rem;
  }

  .review-head button {
    font-size: var(--type-caption);
  }

  .review-items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.85rem;
  }

  .review-items > div,
  .review-main {
    padding: 0.75rem;
    display: grid;
    gap: 0.15rem;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
  }

  .review-items span,
  .review-main span {
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .review-items strong {
    font-size: var(--type-caption);
  }

  .review-main {
    margin-top: 0.85rem;
  }

  .price-lines {
    display: grid;
    margin-top: 0.8rem;
  }

  .price-lines > div {
    min-height: 2.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: var(--border) solid var(--muted-border);
  }

  .price-lines span {
    color: var(--soft-content);
  }

  .price-lines .future-line {
    margin-top: 0.45rem;
    padding: 0.65rem 0.75rem;
    border: 0;
    border-radius: var(--radius-field);
    background: var(--primary-faint);
  }

  .compact-info {
    margin-top: 0.75rem;
  }

  .consent-item {
    margin-top: 1rem;
    padding: 0.6rem;
    display: grid;
    grid-template-columns: 1.25rem minmax(0, 1fr);
    align-items: start;
    gap: 0.65rem;
    color: var(--soft-content);
    font-size: var(--type-caption);
    line-height: 1.42;
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: var(--radius-field);
    transition: border-color 180ms ease;
  }

  .consent-item.invalid {
    border-color: var(--color-error);
    background: color-mix(in oklab, var(--color-error) 6%, transparent);
  }

  .consent-item input {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0.05rem 0 0;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .consent-item a {
    color: var(--color-base-content);
    text-underline-offset: 0.15em;
  }

  .success-layout {
    min-height: calc(100dvh - var(--header-height) - 1.5rem);
    display: grid;
    place-items: center;
  }

  .success-card {
    width: min(100%, 52rem);
    padding: clamp(1.5rem, 4vw, 3.5rem);
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    box-shadow: 0 24px 70px color-mix(in oklab, var(--color-base-content) 7%, transparent);
  }

  .success-icon {
    width: 4.5rem;
    height: 4.5rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--color-success);
    color: var(--color-success-content);
  }

  .success-icon :global(svg) {
    width: 2.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .success-copy {
    margin-top: 1.5rem;
  }

  .order-number {
    margin-top: 1.5rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: var(--radius-field);
    background: var(--primary-faint);
  }

  .order-number span {
    color: var(--soft-content);
  }

  .success-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .success-details article {
    padding: 0.9rem;
    display: grid;
    gap: 0.25rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
  }

  .success-details span {
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .returned-items-card {
    grid-column: 1 / -1;
  }

  .returned-items-list {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .returned-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
    font-size: var(--type-caption);
  }

  .returned-item-row small {
    color: var(--soft-content);
  }

  .link-toggle {
    margin-top: 0.6rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-base-content);
    font-size: var(--type-caption);
    font-weight: 750;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }

  .status-route {
    margin-top: 1.25rem;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .status-route span {
    min-height: 3.1rem;
    padding: 0.55rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius-field);
    background: var(--color-base-200);
    color: var(--faint-content);
    font-size: var(--type-caption);
    text-align: center;
  }

  .status-route span.done {
    background: var(--primary-soft);
    color: var(--color-base-content);
    font-weight: 700;
  }

  .success-actions {
    display: grid;
    grid-template-columns: 1.25fr 0.75fr;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .modal-backdrop,
  .payment-overlay {
    position: fixed;
    z-index: 100;
    inset: 0;
    padding: 1rem;
    display: grid;
    place-items: center;
    background: color-mix(in oklab, black 55%, transparent);
    backdrop-filter: blur(7px);
  }

  .modal-card,
  .payment-card {
    position: relative;
    width: min(100%, 31rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    padding: 1.5rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    color: var(--color-base-content);
    box-shadow: 0 24px 70px color-mix(in oklab, black 28%, transparent);
  }

  .modal-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 2.75rem;
    height: 2.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .modal-card > h2 {
    margin-top: 1rem;
  }

  .modal-card > p {
    margin: 0.7rem 0 0;
    color: var(--soft-content);
  }

  .modal-card ul {
    margin: 1rem 0 1.3rem;
    padding-left: 1.3rem;
    color: var(--soft-content);
  }

  .modal-card li + li {
    margin-top: 0.4rem;
  }

  .modal-actions {
    display: grid;
    gap: 0.65rem;
    margin-top: 1.25rem;
  }

  .modal-placeholder {
    height: 12rem;
    margin-bottom: 1rem;
  }

  .item-modal dl {
    display: grid;
    gap: 0.55rem;
    margin: 1rem 0;
  }

  .item-modal dl > div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .item-modal dt {
    color: var(--soft-content);
  }

  .item-modal dd {
    margin: 0;
    font-weight: 700;
  }

  .payment-card {
    display: grid;
    justify-items: center;
    text-align: center;
  }

  .payment-card p {
    max-width: 25rem;
    margin: 0.7rem 0 0;
    color: var(--soft-content);
  }

  .button-spinner {
    width: 1.05rem;
    height: 1.05rem;
    flex: 0 0 auto;
    border: 2px solid color-mix(in oklab, currentColor 32%, transparent);
    border-top-color: currentColor;
    border-radius: 999px;
    animation: spin 700ms linear infinite;
  }

  .large-spinner {
    width: 3.5rem;
    height: 3.5rem;
    margin-bottom: 1.2rem;
    border-width: 4px;
    color: var(--color-primary);
  }

  .screen-enter {
    animation: screen-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes screen-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  :global(button:focus-visible),
  :global(input:focus-visible),
  :global(textarea:focus-visible),
  :global(a:focus-visible) {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent);
    outline-offset: 3px;
  }

  @media (max-width: 1080px) {
    .storage-grid,
    .schedule-grid {
      grid-template-columns: 1fr;
    }

    .address-fields {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 900px) {
    .whm-app {
      --header-height: 4.5rem;
    }

    .flow-shell {
      width: 100%;
      min-height: calc(100dvh - var(--header-height));
      margin: 0;
    }

    .progress-panel {
      border-width: 1px 0 0;
      border-radius: 0;
    }

    .flow-layout {
      display: block;
      border-width: 1px 0 0;
      border-radius: 0;
      box-shadow: none;
    }

    .content-panel {
      min-height: calc(100dvh - var(--header-height) - 4.2rem);
      padding: 1.25rem var(--page-gutter) 7.5rem;
    }

    .panel-actions {
      display: none;
    }

    .mobile-summary {
      position: fixed;
      z-index: 30;
      left: 0;
      right: 0;
      bottom: 0;
      min-height: 6.4rem;
      padding: 0.85rem var(--page-gutter) max(0.85rem, env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(9.5rem, 12rem);
      align-items: center;
      gap: 0.75rem;
      border-top: var(--border) solid var(--soft-border);
      background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
      backdrop-filter: blur(14px);
    }

    .mobile-summary > div {
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }

    .mobile-summary span {
      color: var(--soft-content);
      font-size: var(--type-caption);
    }

    .mobile-summary strong {
      overflow: hidden;
      font-size: var(--type-caption);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .compact-button {
      min-height: 3.2rem;
    }

    .success-layout {
      min-height: calc(100dvh - var(--header-height));
    }

    .success-card {
      min-height: calc(100dvh - var(--header-height));
      border-width: 1px 0 0;
      border-radius: 0;
      box-shadow: none;
    }
  }

  @media (min-width: 901px) {
    .mobile-summary {
      display: none;
    }
  }

  @media (max-width: 680px) {
    .whm-app {
      --type-h1: clamp(2rem, 8.5vw, 2.65rem);
      --type-heading: clamp(1.35rem, 6vw, 1.75rem);
      --type-body: 0.9375rem;
      --type-caption: 0.75rem;
    }

    .app-header {
      padding: 0 1rem;
    }

    .close-button {
      display: none;
    }

    .progress-panel {
      min-height: 3.8rem;
      padding: 0.65rem 1rem;
      gap: 0.3rem;
    }

    .progress-step {
      gap: 0;
      justify-content: center;
    }

    .progress-step > strong,
    .progress-step:not(:last-child)::after {
      display: none;
    }

    .progress-step > span {
      width: 1.8rem;
      height: 1.8rem;
    }

    .content-panel {
      padding: 1rem 1rem 7.5rem;
    }

    .page-heading {
      margin-top: 1.15rem;
    }

    .page-heading p {
      margin-top: 0.65rem;
    }

    .filter-row {
      align-items: stretch;
      flex-direction: column;
      margin-top: 1.25rem;
    }

    .segmented-control {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }

    .select-all-button {
      align-self: flex-start;
    }

    .storage-grid {
      grid-template-columns: 1fr;
    }

    .storage-select {
      grid-template-columns: 5rem minmax(0, 1fr);
    }

    .item-placeholder {
      width: 5rem;
      height: 5.9rem;
    }

    .detail-button {
      margin-left: 5.9rem;
    }

    .method-select {
      padding: 1rem;
      grid-template-columns: auto minmax(0, 1fr);
    }

    .method-select > .method-radio {
      position: absolute;
      right: 1rem;
    }

    .method-select strong {
      padding-right: 1.75rem;
    }

    .method-footer {
      padding: 0 1rem;
    }

    .schedule-grid,
    .pickup-layout,
    .pickup-schedule {
      grid-template-columns: 1fr;
    }

    .pickup-schedule,
    .pickup-layout > .info-banner {
      grid-column: auto;
    }

    .address-column,
    .date-column {
      padding: 0.8rem;
    }

    .date-row {
      grid-template-columns: repeat(5, minmax(3.6rem, 1fr));
      overflow-x: auto;
      padding-bottom: 0.3rem;
    }

    .slot-grid {
      grid-template-columns: 1fr;
    }

    .review-items,
    .success-details,
    .success-actions {
      grid-template-columns: 1fr;
    }

    .status-route {
      grid-template-columns: repeat(2, 1fr);
    }

    .success-card {
      padding: 1.25rem 1rem max(1rem, env(safe-area-inset-bottom));
    }

    .success-icon {
      width: 3.8rem;
      height: 3.8rem;
    }

    .modal-backdrop {
      align-items: end;
      padding: 0;
    }

    .modal-card {
      width: 100%;
      max-height: 88dvh;
      border-radius: var(--radius-box) var(--radius-box) 0 0;
      padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
    }
  }

  @media (max-width: 400px) {
    .mobile-summary {
      grid-template-columns: minmax(0, 1fr) 9rem;
      padding-left: 0.8rem;
      padding-right: 0.8rem;
    }

    .address-fields {
      grid-template-columns: 1fr 1fr;
    }
  }

  .page-heading h1,
  .success-copy h1 {
    font-size: var(--type-h1);
  }

  .method-select strong,
  .schedule-section h2,
  .review-head h2,
  .warehouse-card h2,
  .modal-card h2,
  .payment-card h2 {
    font-size: var(--type-heading);
  }

  .whm-app p,
  .whm-app button,
  .whm-app input,
  .whm-app textarea,

  .whm-app .form-progress,
  .whm-app .placeholder-label,
  .whm-app .unit-price,
  .whm-app .unit-description,
  .whm-app .unit-caption,
  .whm-app .locked-note,
  .whm-app .detail-button,
  .whm-app .method-footer,
  .whm-app .text-field,
  .whm-app .text-field small,
  .whm-app .date-row span,
  .whm-app .date-row strong,
  .whm-app .slot-grid small,
  .whm-app .review-head button,
  .whm-app .review-items span,
  .whm-app .review-items strong,
  .whm-app .review-main span,
  .whm-app .consent-item,
  .whm-app .inline-error,
  .whm-app .field-error,
  .whm-app .success-details span,
  .whm-app .status-route span {
    font-size: var(--type-caption);
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



</style>
