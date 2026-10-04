<!-- Playground: replace the entire contents of App.svelte with this file. -->
<script>
  import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Copy, Download, MapPin, Moon, Package, Phone, RefreshCw, ShoppingBag, Sun, TriangleAlert, Truck, Warehouse, X } from '@lucide/svelte';
  import { onMount } from 'svelte';

  /**
   * WHM-6 — Активный заказ (доработанная версия)
   * Svelte 5. Интеграционные props:
   * - order, onRefresh(orderId), onCancel(orderId), onContactCourier(order),
   *   onSupport(context), onBack(), onItemOpen(item), onOpenHistory(orderId),
   *   onDownloadDocument(orderId), onCopyOrderId(orderId)
   *
   * Отличия от предыдущей версии:
   * - первичный loader state полностью удалён: экран сразу показывает переданный snapshot;
   * - фоновое автообновление статуса не блокирует и не заменяет интерфейс;
   * - история этапов с реальными временными метками, а не только у текущего;
   * - корректное отображение прогресса и причины отмены на всей ленте, а не сворачивание в один пункт;
   * - копирование номера заказа, скачивание акта после завершения;
   * - разделены иконки "забор" и "доставка" курьером;
   * - ARIA: progressbar, aria-live для статуса, aria-hidden на декоративных иконках;
   * - пустое состояние для списка вещей, устранён визуальный баг в модалке отмены.
   */
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const statusMeta = {
    created: { title: 'Заявка создана', caption: 'Подтверждаем детали заказа' },
    courier: { title: 'Курьер выезжает', caption: 'Встреча уже запланирована' },
    warehouse_visit: { title: 'Ожидаем ваш визит', caption: 'Привезите вещи на склад' },
    warehouse_received: { title: 'Вещи приняты', caption: 'Проверяем и маркируем' },
    storing: { title: 'Размещаем на хранение', caption: 'Скоро вещи появятся в приложении' },
    assembling: { title: 'Собираем ваш заказ', caption: 'Готовим вещи к выдаче' },
    delivering: { title: 'Курьер в пути', caption: 'Вещи едут по указанному адресу' },
    delivery_ready: { title: 'Подготовлено к доставке', caption: 'Ожидаем передачу курьеру' },
    pickup_ready: { title: 'Готово к выдаче', caption: 'Вещи ждут вас на складе' },
    completed: { title: 'Заказ завершён', caption: 'Все действия по заказу выполнены' },
    cancelled: { title: 'Заказ отменён', caption: 'Заявка больше не активна' }
  };

  const now0 = Date.now();
  const defaultOrder = {
    id: 'WHM-2026-0829',
    type: 'storage',
    fulfillment: 'courier',
    status: 'courier',
    visitAt: new Date(now0 + 4 * 60 * 60 * 1000).toISOString(),
    visitWindow: '16:00–18:00',
    address: 'Москва, ул. Большая Дмитровка, 12',
    addressHint: 'Подъезд 2, домофон 48',
    warehouse: 'Склад · Химки',
    warehouseAddress: 'Коммунальный проезд, 30',
    workingHours: 'Пн–Вс, 09:00–21:00',
    courier: { name: 'Алексей', vehicle: 'Белый фургон', plate: 'А 248 МР 799' },
    scheduleNotice: '',
    pickupInstructions: 'Для получения назовите номер заказа и предъявите документ.',
    currentMonthlyStorage: 2900,
    futureMonthlyStorage: 1700,
    cancelReason: '',
    documentAvailable: true,
    cancelledFrom: null,
    history: [
      { status: 'created', at: new Date(now0 - 42 * 60 * 1000).toISOString() }
    ],
    items: [
      { id: 'box-104', name: 'Коробка №104', note: 'Одежда и обувь', icon: 'box', status: 'Будет принято' },
      { id: 'box-105', name: 'Коробка №105', note: 'Книги и документы', icon: 'box', status: 'Будет принято' },
      { id: 'bag-31', name: 'Чехол №31', note: 'Зимняя куртка', icon: 'bag', status: 'Будет принято' }
    ]
  };

  let {
    initialTheme = 'bumblebee',
    live = false,
    order = defaultOrder,
    autoRefreshMs = 45_000,
    onRefresh = async () => { await delay(650); return {}; },
    onCancel = async () => { await delay(650); return { ok: true }; },
    onContactCourier = () => {},
    onSupport = () => {},
    onBack = () => {},
    onHome = onBack,
    onItemOpen = () => {},
    onOpenHistory = () => {},
    onDownloadDocument = () => {},
    onCopyOrderId = (id) => { try { navigator.clipboard?.writeText(id); } catch (error) {} }
  } = $props();

  let theme = $state(initialTheme);
  let currentOrder = $state(mergeOrder(live ? { courier: {}, history: [], items: [] } : defaultOrder, order));
  let stale = $state(false);
  let refreshError = $state('');
  let expandedItems = $state(false);
  let cancelDialogOpen = $state(false);
  let cancelling = $state(false);
  let cancelError = $state('');
  let copyFeedback = $state('');
  let now = $state(Date.now());
  let clockTimer = null;
  let pollTimer = null;
  let copyTimer = null;
  let refreshInFlight = false;

  function mergeOrder(base, incoming) {
    return {
      ...base,
      ...incoming,
      courier: { ...base.courier, ...(incoming?.courier || {}) },
      history: Array.isArray(incoming?.history) ? incoming.history : base.history,
      items: Array.isArray(incoming?.items) ? incoming.items : base.items
    };
  }

  onMount(() => {
    void loadOrder();
    clockTimer = setInterval(() => { now = Date.now(); }, 30_000);
    if (autoRefreshMs > 0) {
      pollTimer = setInterval(() => { if (!isFinalStatus()) void loadOrder(); }, autoRefreshMs);
    }
    return () => { clearInterval(clockTimer); clearInterval(pollTimer); if (copyTimer) clearTimeout(copyTimer); };
  });

  function isFinalStatus() { return currentOrder.status === 'completed' || currentOrder.status === 'cancelled'; }

  async function loadOrder() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    refreshError = '';
    try {
      const update = await onRefresh(currentOrder.id);
      const previousStatus = currentOrder.status;
      currentOrder = mergeOrder(currentOrder, update);
      if (!live && update?.status && update.status !== previousStatus && !currentOrder.history.some((entry) => entry.status === update.status)) {
        currentOrder = { ...currentOrder, history: [...currentOrder.history, { status: update.status, at: new Date().toISOString() }] };
      }
      stale = false;
    } catch (error) {
      stale = true;
      refreshError = 'Не удалось обновить статус. Показаны последние доступные данные.';
    } finally {
      refreshInFlight = false;
    }
  }

  function toggleTheme() { theme = theme === 'halloween' ? 'bumblebee' : 'halloween'; window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme })); }

  function stepsFor(data) {
    if (data.type === 'return') {
      return data.fulfillment === 'courier'
        ? ['created', 'assembling', ...(live ? ['delivery_ready'] : []), 'delivering', 'completed']
        : ['created', 'assembling', 'pickup_ready', 'completed'];
    }
    return data.fulfillment === 'courier'
      ? ['created', 'courier', 'warehouse_received', 'storing', 'completed']
      : ['created', 'warehouse_visit', 'warehouse_received', 'storing', 'completed'];
  }

  function historyAt(status) {
    const entry = currentOrder.history.find((item) => item.status === status);
    return entry ? entry.at : null;
  }

  function stepState(status, index, activeIndex, boundary) {
    if (currentOrder.status === 'cancelled') return index < boundary ? 'done' : index === boundary ? 'cancelled-at' : 'skipped';
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'current';
    return 'upcoming';
  }

  function dateLabel(date, format = 'full') {
    if (!date) return 'Уточняется';
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return 'Уточняется';
    return new Intl.DateTimeFormat('ru-RU', format === 'full'
      ? { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(value);
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'Уточняется';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);
  }

  function relativeTime(date) {
    if (!date) return 'нет данных';
    const minutes = Math.max(0, Math.round((now - new Date(date).getTime()) / 60000));
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    return `${Math.floor(minutes / 60)} ч назад`;
  }

  function hoursUntilVisit() { return currentOrder.visitAt ? (new Date(currentOrder.visitAt).getTime() - now) / 3600000 : 0; }

  function canCancel() {
    return currentOrder.cancelAllowed !== false && currentOrder.type === 'storage' && currentOrder.fulfillment === 'courier'
      && ['created', 'courier'].includes(currentOrder.status) && hoursUntilVisit() >= 2;
  }

  function cancelReason() {
    if (currentOrder.type !== 'storage' || currentOrder.fulfillment !== 'courier') return '';
    if (['warehouse_received', 'storing', 'completed', 'cancelled'].includes(currentOrder.status)) return '';
    return hoursUntilVisit() < 2 ? 'Отмена доступна не позднее чем за 2 часа до визита.' : '';
  }

  function orderTypeName() { return currentOrder.type === 'storage' ? 'Сдача на хранение' : 'Возврат вещей'; }

  function heroDescription() {
    if (currentOrder.status === 'cancelled') return currentOrder.cancelReason || 'Заявка отменена. Вы можете оформить новый заказ в любое время.';
    if (currentOrder.status === 'completed') return 'Все изменения сохранены в истории заказов.';
    if (currentOrder.type === 'storage' && currentOrder.fulfillment === 'courier') return `Курьер приедет ${dateLabel(currentOrder.visitAt)}.`;
    if (currentOrder.type === 'storage') return `Ждём вас на складе: ${currentOrder.workingHours}.`;
    if (currentOrder.fulfillment === 'courier') return `Доставим вещи ${dateLabel(currentOrder.visitAt)}.`;
    return `Вещи можно получить на складе: ${currentOrder.workingHours}.`;
  }

  function openCancel() { cancelError = ''; cancelDialogOpen = true; }
  function closeCancel() { if (!cancelling) cancelDialogOpen = false; }

  async function confirmCancel() {
    cancelling = true;
    try {
      const result = await onCancel(currentOrder.id);
      if (result?.ok === false) { cancelError = result.message || 'Не удалось отменить визит. Попробуйте ещё раз.'; return; }
      currentOrder = {
        ...currentOrder,
        cancelledFrom: currentOrder.status,
        status: 'cancelled',
        history: [...currentOrder.history, { status: 'cancelled', at: new Date().toISOString() }]
      };
      cancelDialogOpen = false;
      onHome();
    } catch (error) { cancelError = 'Нет соединения. Попробуйте ещё раз.'; }
    finally { cancelling = false; }
  }

  function contactCourier() { onContactCourier(currentOrder); }
  function support() { onSupport({ orderId: currentOrder.id, type: currentOrder.type, status: currentOrder.status }); }
  function downloadDocument() { onDownloadDocument(currentOrder.id); }

  function copyOrderId() {
    onCopyOrderId(currentOrder.id);
    copyFeedback = 'Скопировано';
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copyFeedback = ''; }, 1800);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && cancelDialogOpen) closeCancel();
  }

  function showsVisitTime(step) {
    return ['courier', 'warehouse_visit', 'delivering', 'pickup_ready'].includes(step);
  }

  let dark = $derived(theme === 'halloween');
  let steps = $derived(stepsFor(currentOrder));
  let activeIndex = $derived(steps.indexOf(currentOrder.status));
  let cancelBoundaryIndex = $derived(Math.max(0, currentOrder.cancelledFrom ? steps.indexOf(currentOrder.cancelledFrom) : 0));
  let meta = $derived(statusMeta[currentOrder.status] || statusMeta.created);
  let progressPercent = $derived(currentOrder.status === 'cancelled'
    ? Math.round(((cancelBoundaryIndex + 1) / steps.length) * 100)
    : Math.round((Math.max(1, activeIndex + 1) / steps.length) * 100));
  let visibleItems = $derived(expandedItems ? currentOrder.items : currentOrder.items.slice(0, 2));
  let cancellationAllowed = $derived(canCancel());
  let cancellationReason = $derived(cancelReason());
  let isStorageOrder = $derived(currentOrder.type === 'storage');
  let showVisitDetails = $derived(isStorageOrder
    ? ['created', 'courier', 'warehouse_visit'].includes(currentOrder.status)
    : ['created', 'assembling', 'delivering', 'pickup_ready'].includes(currentOrder.status));
</script>

<svelte:head>
  <title>Активный заказ · Клиентский интерфейс</title>
  <meta name="description" content="Экран отслеживания активного заказа" />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="whm-app" data-theme={theme}>
  <div class="glow glow-top" aria-hidden="true"></div>
  <div class="glow glow-bottom" aria-hidden="true"></div>

  <header class="topbar">
    <button class="round-button" type="button" aria-label="Назад" onclick={onBack}>
      <ChevronLeft aria-hidden="true" />
    </button>
    <button class="brand" type="button" aria-label="На главный экран" onclick={onHome}>
      <span class="system-label">Клиентский интерфейс</span>
    </button>
    <button class="round-button" type="button" aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'} onclick={toggleTheme}>
      {#if dark}
        <Sun aria-hidden="true" />
      {:else}
        <Moon aria-hidden="true" />
      {/if}
    </button>
  </header>

  <main class="page-shell">
      <section class="hero-panel" aria-live="polite">
        <div class="hero-head">
          <button class="order-chip" type="button" onclick={copyOrderId} aria-label="Скопировать номер заказа">
            {orderTypeName()} · № {currentOrder.id}
            <Copy aria-hidden="true" />
          </button>
          <button class="refresh" type="button" onclick={loadOrder} aria-label="Обновить статус">
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
        {#if copyFeedback}<span class="copy-toast" role="status">{copyFeedback}</span>{/if}

        <div class="hero-content">
          <span class="hero-icon" aria-hidden="true">
            {#if currentOrder.status === 'completed'}
              <Check aria-hidden="true" />
            {:else if currentOrder.status === 'cancelled'}
              <X aria-hidden="true" />
            {:else if currentOrder.fulfillment === 'courier'}
              <Truck aria-hidden="true" />
            {:else}
              <Warehouse aria-hidden="true" />
            {/if}
          </span>
          <div>
            <h1>{meta.title}</h1>
            <p class="hero-description">{heroDescription()}</p>
          </div>
        </div>

        {#if currentOrder.status !== 'cancelled'}
          <div class="progress-block">
            <div class="progress-label"><span>Готовность заказа</span><strong>{progressPercent}%</strong></div>
            <div class="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
              <span style={`width: ${progressPercent}%`}></span>
            </div>
          </div>
        {/if}
      </section>

      {#if stale}
        <div class="alert" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>{refreshError}</span>
          <button type="button" onclick={loadOrder}>Повторить</button>
        </div>
      {/if}

      <section class="section status-section" aria-labelledby="timeline-title">
        <div class="section-heading">
          <h2 id="timeline-title">Статус заказа</h2>
          <span class="updated">Обновлено {relativeTime(historyAt(currentOrder.status) || currentOrder.history[0]?.at)}</span>
        </div>
        <ol class="timeline">
          {#each steps as step, index}
            {@const state = stepState(step, index, activeIndex, cancelBoundaryIndex)}
            <li class={state}>
              <span class="rail" aria-hidden="true">
                <i>
                  {#if state === 'done'}
                    <Check aria-hidden="true" />
                  {:else if state === 'cancelled-at'}
                    <X aria-hidden="true" />
                  {:else}
                    <b></b>
                  {/if}
                </i>
              </span>
              <div class="step-copy">
                <strong>{statusMeta[step].title}</strong>
                {#if state === 'current'}
                  <span>{statusMeta[step].caption}</span>
                  {#if showsVisitTime(step) && currentOrder.visitAt}<small>{dateLabel(currentOrder.visitAt, 'short')}{currentOrder.visitWindow ? ` · ${currentOrder.visitWindow}` : ''}</small>{/if}
                {:else if state === 'done'}
                  <span>{historyAt(step) ? `Завершено ${relativeTime(historyAt(step))}` : 'Этап завершён'}</span>
                {:else if state === 'cancelled-at'}
                  <span>На этом этапе заказ был отменён</span>
                {:else}
                  <span>Следующий этап</span>
                {/if}
              </div>
              {#if state === 'current'}<span class="current-tag">Сейчас</span>{/if}
            </li>
          {/each}
        </ol>
      </section>

      {#if showVisitDetails}
        <section class="section visit-section" aria-labelledby="visit-title">
          <div class="section-heading"><h2 id="visit-title">Детали визита</h2></div>

          {#if currentOrder.fulfillment === 'courier'}
            <div class="visit-card">
              <div class="visit-date">
                <span>{isStorageOrder ? 'Забор вещей' : 'Доставка вещей'}</span>
                <strong>{dateLabel(currentOrder.visitAt)}</strong>
                {#if currentOrder.visitWindow}<small>Курьер приедет в интервале {currentOrder.visitWindow}</small>{/if}
                {#if currentOrder.scheduleNotice}<p class="schedule-note">{currentOrder.scheduleNotice}</p>{/if}
              </div>
              <div class="visit-divider"></div>
              <div class="courier-line">
                <span class="avatar" aria-hidden="true">{currentOrder.courier.name.charAt(0)}</span>
                <div><strong>{currentOrder.courier.name}, ваш курьер</strong><span>{currentOrder.courier.vehicle} · {currentOrder.courier.plate}</span></div>
                <button class="call-button" type="button" onclick={contactCourier} aria-label="Связаться с курьером">
                  <Phone aria-hidden="true" />
                </button>
              </div>
              <div class="address-line">
                <span class="pin" aria-hidden="true"><MapPin aria-hidden="true" /></span>
                <div><strong>{currentOrder.address}</strong><span>{currentOrder.addressHint}</span></div>
              </div>
            </div>
          {:else}
            <div class="visit-card warehouse-card">
              <span class="warehouse-icon" aria-hidden="true"><Warehouse aria-hidden="true" /></span>
              <div>
                <span class="label">{isStorageOrder ? 'Передайте вещи на склад' : 'Заберите вещи со склада'}</span>
                <strong>{currentOrder.warehouse}</strong>
                <span>{currentOrder.warehouseAddress}</span>
                {#if currentOrder.visitAt}<span class="pickup-slot">Выбранное время: {dateLabel(currentOrder.visitAt, 'short')}{currentOrder.visitWindow ? ` · ${currentOrder.visitWindow}` : ''}</span>{/if}
                <small>{currentOrder.workingHours}</small>
                {#if !isStorageOrder && currentOrder.pickupInstructions}<p class="pickup-note">{currentOrder.pickupInstructions}</p>{/if}
              </div>
            </div>
          {/if}
        </section>
      {/if}

      {#if !isStorageOrder}
        <section class="section storage-section" aria-labelledby="storage-title">
          <div class="section-heading"><h2 id="storage-title">Хранение после возврата</h2></div>
          <div class="storage-impact">
            <div><span>Сейчас</span><strong>{money(currentOrder.currentMonthlyStorage)} / мес.</strong></div>
            <span class="storage-arrow" aria-hidden="true"><ArrowRight /></span>
            <div><span>После передачи вещей</span><strong>{money(currentOrder.futureMonthlyStorage)} / мес.</strong></div>
          </div>
          <p class="storage-caption">Новая стоимость начнёт действовать после фактической передачи вещей.</p>
        </section>
      {/if}

      <section class="section items-section" aria-labelledby="items-title">
        <div class="section-heading">
          <h2 id="items-title">Вещи в заказе <span>{currentOrder.items.length}</span></h2>
        </div>

        {#if currentOrder.items.length === 0}
          <div class="empty-items"><Package aria-hidden="true" /><p>Состав заказа пока не сформирован.</p></div>
        {:else}
          <div class="item-list">
            {#each visibleItems as item}
              <button class="item" type="button" onclick={() => onItemOpen(item)}>
                <span class="item-icon" aria-hidden="true">
                  {#if item.icon === 'bag'}
                    <ShoppingBag aria-hidden="true" />
                  {:else}
                    <Package aria-hidden="true" />
                  {/if}
                </span>
                <span class="item-copy"><strong>{item.name}</strong><small>{item.note}</small></span>
                <span class="item-state">{item.status}</span>
                <ChevronRight class="chevron" aria-hidden="true" />
              </button>
            {/each}
          </div>
          {#if currentOrder.items.length > 2}
            <button class="show-all" type="button" onclick={() => expandedItems = !expandedItems}>
              {expandedItems ? 'Свернуть список' : `Показать ещё ${currentOrder.items.length - 2}`}
            </button>
          {/if}
        {/if}
      </section>

      {#if currentOrder.status === 'completed' && currentOrder.documentAvailable !== false}
        <button class="document-button" type="button" onclick={downloadDocument}>
          <Download aria-hidden="true" />
          Скачать акт приёма-передачи
        </button>
      {/if}

      <section class="need-help">
        <span aria-hidden="true"><CircleHelp aria-hidden="true" /></span>
        <div><strong>Нужна помощь с заказом?</strong><p>Поддержка уже видит детали вашей заявки.</p></div>
        <button type="button" onclick={support}>Написать</button>
      </section>

      <section class="actions">
        {#if cancellationAllowed}
          <button class="cancel-button" type="button" onclick={openCancel}>Отменить визит</button>
        {:else if cancellationReason}
          <p class="cancel-note">{cancellationReason} <button type="button" onclick={support}>Написать в поддержку</button></p>
        {/if}
        {#if currentOrder.status === 'completed' || currentOrder.status === 'cancelled'}
          <button class="main-button" type="button" onclick={onHome}>На главный экран</button>
          <button class="secondary-button" type="button" onclick={() => onOpenHistory(currentOrder.id)}>Открыть историю заказов</button>
        {/if}
      </section>
  </main>

  {#if cancelDialogOpen}
    <div class="modal-backdrop" role="presentation" onclick={closeCancel}></div>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" aria-label="Закрыть" onclick={closeCancel}>
        <X aria-hidden="true" />
      </button>
      <span class="modal-icon" aria-hidden="true"><TriangleAlert aria-hidden="true" /></span>
      <h2 id="modal-title">Отменить визит?</h2>
      <p>Заявка на сдачу будет отменена целиком. Позже вы сможете оформить новый заказ.</p>
      {#if cancelError}<p class="error" role="alert">{cancelError}</p>{/if}
      <div class="modal-actions">
        <button class="danger-fill" type="button" disabled={cancelling} onclick={confirmCancel}>{cancelling ? 'Отменяем…' : 'Да, отменить'}</button>
        <button class="stay" type="button" disabled={cancelling} onclick={closeCancel}>Оставить заказ</button>
      </div>
    </section>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html) { min-width: 320px; }
  :global(body) { margin: 0; font-family: 'Open Sans', sans-serif; }
  :global(button) { font-family: inherit; }

  .whm-app {
    --gutter: clamp(1rem, 4vw, 2.2rem);
    --max: 39rem;
    --border: color-mix(in oklab, var(--ink) 12%, transparent);
    --muted: color-mix(in oklab, var(--ink) 62%, transparent);
    --faint: color-mix(in oklab, var(--ink) 43%, transparent);
    --soft: color-mix(in oklab, var(--primary) 12%, var(--bg));
    min-height: 100dvh; position: relative; isolation: isolate; overflow-x: hidden;
    background: var(--bg); color: var(--ink); transition: background .2s, color .2s;
  }
  .whm-app[data-theme='bumblebee'] { color-scheme: light; --bg: oklch(99% 0 0); --panel: oklch(100% 0 0); --ink: oklch(20% 0 0); --primary: oklch(85% .199 91.936); --secondary: oklch(75% .183 55.934); --error: oklch(64% .2 25); --success: oklch(64% .16 150); }
  .whm-app[data-theme='halloween'] { color-scheme: dark; --bg: oklch(21% .006 56.043); --panel: oklch(25% .007 56); --ink: oklch(89% 0 0); --primary: oklch(76% .188 70.08); --secondary: oklch(45.98% .248 305.03); --error: oklch(70% .19 28); --success: oklch(74% .14 150); }

  .glow { position: fixed; z-index: -1; border-radius: 50%; pointer-events: none; filter: blur(2px); }
  .glow-top { width: 35rem; height: 35rem; top: -25rem; right: -15rem; background: radial-gradient(circle, color-mix(in oklab, var(--primary) 16%, transparent), transparent 67%); }
  .glow-bottom { width: 30rem; height: 30rem; bottom: -22rem; left: -18rem; background: radial-gradient(circle, color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%); }

  .topbar, .page-shell { width: min(calc(100% - var(--gutter) * 2), var(--max)); margin: 0 auto; }
  .topbar { height: 4.65rem; display: grid; grid-template-columns: 2.55rem 1fr 2.55rem; align-items: center; }
  .brand { justify-self: center; display: flex; align-items: center; gap: .55rem; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }





  .round-button { width: 2.55rem; height: 2.55rem; display: grid; place-items: center; border: 1px solid var(--border); border-radius: .75rem; background: color-mix(in oklab, var(--panel) 86%, transparent); color: var(--ink); cursor: pointer; }
  .round-button :global(svg), .refresh :global(svg), .hero-icon :global(svg), .rail :global(svg), .visit-card :global(svg), .item-icon :global(svg), .chevron, .alert :global(svg), .need-help :global(svg), .modal-icon :global(svg), .modal-close :global(svg), .document-button :global(svg), .empty-items :global(svg) { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .round-button :global(svg) { width: 1.12rem; }

  .page-shell { padding: 1.05rem 0 2.5rem; }
  .hero-panel { position: relative; padding: 1.15rem; border: 1px solid var(--border); border-radius: 1.15rem; background: linear-gradient(135deg, color-mix(in oklab, var(--panel) 94%, var(--primary)), var(--panel) 55%); box-shadow: 0 12px 34px color-mix(in oklab, #000 7%, transparent); }
  .hero-head { display: flex; justify-content: space-between; align-items: center; gap: .6rem; }
  .order-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .58rem; border: 0; border-radius: 99px; background: var(--soft); color: var(--ink); font-size: .7rem; font-weight: 800; cursor: pointer; }
  .order-chip :global(svg) { width: .8rem; }
  .copy-toast { position: absolute; top: -.4rem; right: 1.1rem; padding: .2rem .55rem; border-radius: 99px; background: var(--ink); color: var(--bg); font-size: .65rem; font-weight: 800; }
  .refresh { width: 2rem; height: 2rem; display: grid; place-items: center; padding: 0; border: 0; border-radius: .55rem; background: transparent; color: var(--muted); cursor: pointer; }
  .refresh:hover { background: var(--soft); color: var(--ink); }
  .refresh :global(svg) { width: 1rem; }
  .hero-content { display: grid; grid-template-columns: 3rem 1fr; gap: .85rem; align-items: start; margin-top: 1.15rem; }
  .hero-icon { width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: .9rem; background: var(--primary); color: #161616; box-shadow: 0 7px 18px color-mix(in oklab, var(--primary) 28%, transparent); }
  .hero-icon :global(svg) { width: 1.45rem; }
  .hero-panel h1 { margin: 0; font-size: clamp(1.55rem, 5.8vw, 2rem); line-height: 1.12; letter-spacing: -.025em; font-weight: 830; }
  .hero-description { margin: .4rem 0 0; color: var(--muted); font-size: .84rem; line-height: 1.42; }
  .progress-block { margin-top: 1.25rem; padding-top: .85rem; border-top: 1px solid var(--border); }
  .progress-label { display: flex; justify-content: space-between; margin-bottom: .45rem; color: var(--muted); font-size: .72rem; }
  .progress-label strong { color: var(--ink); }
  .progress-track { height: .42rem; border-radius: 99px; background: var(--border); overflow: hidden; }
  .progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--primary); transition: width .3s ease; }

  .alert { display: flex; align-items: flex-start; gap: .5rem; margin-top: .85rem; padding: .75rem; border: 1px solid color-mix(in oklab, var(--error) 36%, transparent); border-radius: .75rem; color: var(--error); font-size: .75rem; line-height: 1.35; }
  .alert :global(svg) { width: 1rem; min-width: 1rem; }
  .alert button { margin-left: auto; padding: 0; border: 0; background: none; color: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }

  .section { margin-top: 1.65rem; }
  .section-heading { display: flex; justify-content: space-between; align-items: end; gap: .75rem; margin-bottom: .85rem; }
  .section h2 { margin: 0; font-size: 1.08rem; letter-spacing: -.015em; }
  .section h2 span { display: inline-grid; place-items: center; min-width: 1.35rem; margin-left: .25rem; padding: .04rem .35rem; border-radius: 99px; background: var(--soft); font-size: .7rem; vertical-align: middle; }
  .updated { color: var(--faint); font-size: .68rem; white-space: nowrap; }

  .status-section { padding: 1rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--panel); }
  .timeline { margin: 0; padding: 0; list-style: none; }
  .timeline li { position: relative; display: grid; grid-template-columns: 1.35rem 1fr auto; gap: .7rem; min-height: 3.65rem; color: var(--faint); }
  .timeline li:last-child { min-height: 2.1rem; }
  .rail { position: relative; display: flex; justify-content: center; }
  .rail::after { content: ''; position: absolute; top: 1.35rem; bottom: -.15rem; width: 1px; background: var(--border); }
  .timeline li:last-child .rail::after { display: none; }
  .rail i { width: 1.08rem; height: 1.08rem; z-index: 1; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--panel); font-style: normal; }
  .rail b { width: .32rem; height: .32rem; border-radius: 50%; background: var(--faint); }
  .done .rail::after, .cancelled-at .rail::after { background: color-mix(in oklab, var(--primary) 70%, var(--border)); }
  .done .rail i { border-color: var(--primary); background: var(--primary); color: #171717; }
  .cancelled-at .rail i { border-color: var(--error); background: var(--error); color: #fff; }
  .skipped { opacity: .55; }
  .rail :global(svg) { width: .68rem; stroke-width: 2.4; }
  .current .rail i { box-shadow: 0 0 0 4px var(--soft); }
  .step-copy { display: grid; align-content: start; gap: .1rem; padding-top: .02rem; }
  .step-copy strong { color: currentColor; font-size: .83rem; }
  .step-copy span { font-size: .72rem; line-height: 1.32; }
  .step-copy small { color: var(--muted); font-size: .7rem; font-weight: 700; }
  .current, .cancelled-at { color: var(--ink) !important; }
  .current-tag { align-self: start; padding: .22rem .42rem; border-radius: 99px; background: var(--soft); font-size: .63rem; font-weight: 820; }

  .visit-card { padding: 1rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--panel); }
  .visit-date { display: grid; gap: .2rem; }
  .visit-date span, .label { color: var(--faint); font-size: .71rem; font-weight: 700; }
  .visit-date strong { font-size: .93rem; }
  .visit-date small { color: var(--muted); font-size: .72rem; }
  .schedule-note, .pickup-note { margin: .55rem 0 0; padding: .55rem .65rem; border-radius: .65rem; background: var(--soft); color: var(--ink); font-size: .72rem; line-height: 1.4; }
  .visit-divider { height: 1px; margin: .9rem 0; background: var(--border); }
  .courier-line, .address-line { display: grid; grid-template-columns: 2.25rem 1fr auto; gap: .7rem; align-items: center; }
  .courier-line div, .address-line div, .warehouse-card > div { display: grid; gap: .1rem; }
  .courier-line strong, .address-line strong, .warehouse-card strong { font-size: .82rem; }
  .courier-line span, .address-line span, .warehouse-card span { color: var(--muted); font-size: .72rem; }
  .avatar { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border-radius: 50%; background: var(--primary); color: #161616; font-size: .8rem; font-weight: 840; }
  .call-button { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border: 0; border-radius: .65rem; background: var(--soft); color: var(--ink); cursor: pointer; }
  .call-button :global(svg) { width: 1rem; }
  .address-line { grid-template-columns: 2.25rem 1fr; margin-top: .9rem; padding-top: .9rem; border-top: 1px solid var(--border); }
  .pin, .warehouse-icon { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border-radius: .65rem; background: var(--soft); }
  .pin :global(svg), .warehouse-icon :global(svg) { width: 1.05rem; }
  .warehouse-card { display: grid; grid-template-columns: 2.5rem 1fr; gap: .8rem; align-items: start; }
  .warehouse-icon { width: 2.5rem; height: 2.5rem; }
  .warehouse-card small { margin-top: .4rem; color: var(--ink); font-size: .7rem; font-weight: 750; }
  .warehouse-card .pickup-slot { margin-top: .35rem; color: var(--ink); font-weight: 700; }

  .storage-impact { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: .8rem; align-items: center; padding: 1rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--panel); }
  .storage-impact > div { display: grid; gap: .18rem; }
  .storage-impact > div:last-child { text-align: right; }
  .storage-impact span { color: var(--muted); font-size: .7rem; }
  .storage-impact strong { font-size: .85rem; }
  .storage-arrow { color: var(--ink) !important; font-size: 1rem !important; }
  .storage-caption { margin: .55rem 0 0; color: var(--muted); font-size: .7rem; line-height: 1.4; }

  .empty-items { display: grid; place-items: center; gap: .5rem; padding: 2.2rem 1rem; border: 1px dashed var(--border); border-radius: 1rem; color: var(--faint); text-align: center; }
  .empty-items :global(svg) { width: 2rem; }
  .empty-items p { margin: 0; font-size: .78rem; }

  .item-list { border: 1px solid var(--border); border-radius: 1rem; background: var(--panel); overflow: hidden; }
  .item { width: 100%; display: grid; grid-template-columns: 2.35rem minmax(0, 1fr) auto 1rem; gap: .68rem; align-items: center; padding: .72rem .85rem; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
  .item:last-child { border-bottom: 0; }
  .item:hover { background: var(--soft); }
  .item-icon { width: 2.35rem; height: 2.35rem; display: grid; place-items: center; border-radius: .65rem; background: var(--soft); }
  .item-icon :global(svg) { width: 1.05rem; }
  .item-copy { display: grid; gap: .08rem; min-width: 0; }
  .item-copy strong { font-size: .81rem; }
  .item-copy small { color: var(--muted); font-size: .7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item-state { padding: .18rem .38rem; border-radius: 99px; background: var(--soft); color: var(--muted); font-size: .62rem; font-weight: 750; white-space: nowrap; }
  .chevron { width: .9rem; color: var(--faint); }
  .show-all { display: block; width: 100%; margin-top: .65rem; padding: .25rem; border: 0; background: transparent; color: var(--ink); font-weight: 780; font-size: .78rem; text-decoration: underline; text-underline-offset: .18em; cursor: pointer; }

  .document-button { display: flex; align-items: center; justify-content: center; gap: .55rem; width: 100%; min-height: 3rem; margin-top: 1.1rem; border: 1px solid var(--border); border-radius: .75rem; background: var(--panel); color: var(--ink); font-weight: 780; font-size: .82rem; cursor: pointer; }
  .document-button :global(svg) { width: 1.05rem; }

  .need-help { display: grid; grid-template-columns: 2.35rem 1fr auto; gap: .7rem; align-items: center; margin-top: 1.65rem; padding: .85rem; border: 1px solid var(--border); border-radius: 1rem; background: linear-gradient(110deg, var(--soft), var(--panel)); }
  .need-help > span { width: 2.35rem; height: 2.35rem; display: grid; place-items: center; border-radius: .68rem; background: var(--primary); color: #171717; }
  .need-help :global(svg) { width: 1.1rem; }
  .need-help div { display: grid; gap: .1rem; }
  .need-help strong { font-size: .78rem; }
  .need-help p { margin: 0; color: var(--muted); font-size: .68rem; line-height: 1.3; }
  .need-help button { padding: 0; border: 0; background: none; color: var(--ink); font-size: .72rem; font-weight: 800; text-decoration: underline; cursor: pointer; }

  .actions { margin: 1.15rem 0 .2rem; display: grid; gap: .75rem; }
  .cancel-button { width: 100%; min-height: 3rem; border: 1px solid var(--error); border-radius: .75rem; background: transparent; color: var(--error); font-weight: 800; cursor: pointer; }
  .cancel-note { margin: 0; text-align: center; color: var(--error); font-size: .72rem; line-height: 1.4; }
  .cancel-note button { padding: 0; border: 0; background: none; color: inherit; text-decoration: underline; font-weight: 800; cursor: pointer; }
  .main-button, .secondary-button { width: 100%; min-height: 3rem; border-radius: .75rem; font-weight: 800; cursor: pointer; }
  .main-button { border: 0; background: var(--primary); color: #171717; }
  .secondary-button { border: 1px solid var(--border); background: var(--panel); color: var(--ink); }

  .modal-backdrop { position: fixed; z-index: 20; inset: 0; background: color-mix(in oklab, #000 50%, transparent); backdrop-filter: blur(3px); }
  .modal { position: fixed; z-index: 21; left: 50%; bottom: max(1rem, env(safe-area-inset-bottom)); width: min(calc(100% - 2rem), 30rem); transform: translateX(-50%); padding: 1.4rem; border: 1px solid var(--border); border-radius: 1.15rem; background: var(--panel); box-shadow: 0 20px 60px color-mix(in oklab, #000 30%, transparent); text-align: center; }
  .modal-close { position: absolute; top: .7rem; right: .7rem; width: 2rem; height: 2rem; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--soft); color: var(--muted); cursor: pointer; }
  .modal-close :global(svg) { width: .85rem; }
  .modal-icon { width: 2.8rem; height: 2.8rem; margin: 0 auto .7rem; display: grid; place-items: center; border-radius: 50%; background: color-mix(in oklab, var(--error) 15%, var(--panel)); color: var(--error); }
  .modal-icon :global(svg) { width: 1.35rem; }
  .modal h2 { margin: 0; font-size: 1.15rem; }
  .modal p { margin: .55rem 0 0; color: var(--muted); font-size: .82rem; line-height: 1.45; }
  .modal .error { color: var(--error); font-weight: 700; }
  .modal-actions { display: grid; gap: .7rem; margin-top: 1.15rem; }
  .danger-fill, .stay { min-height: 3rem; border-radius: .7rem; font-weight: 800; cursor: pointer; }
  .danger-fill { border: 0; background: var(--error); color: white; }
  .stay { border: 0; background: transparent; color: var(--ink); }

  :global(button:focus-visible) { outline: 3px solid color-mix(in oklab, var(--primary) 48%, transparent); outline-offset: 3px; }
  @media (max-width: 390px) { .item { grid-template-columns: 2.2rem minmax(0, 1fr) .9rem; } .item-state { display: none; } .storage-impact { grid-template-columns: 1fr; } .storage-impact > div:last-child { text-align: left; } .storage-arrow { transform: rotate(90deg); justify-self: start; } }
  @media (prefers-reduced-motion: reduce) { * { animation-duration: .01ms !important; transition-duration: .01ms !important; } }



</style>
