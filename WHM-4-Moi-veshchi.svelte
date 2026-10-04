<script>
  import { ArrowRight, ChevronRight, CircleHelp, Moon, RefreshCw, Search, Sun, TriangleAlert, User, Warehouse } from '@lucide/svelte';
  import { tick } from 'svelte';

  /*
   * WHM-4 — Главный экран: Мои вещи
   *
   * Автономный Svelte 5 demo component.
   * Дашборд клиента: сводка хранения, активные заказы,
   * список вещей на хранении, точки входа в сдачу/возврат.
   *
   * API hooks:
   * - onLoadDashboard()               -> { units, activeOrders, nextChargeDate }
   * - onOpenItem(unit)                -> WHM-5
   * - onGoToHandover()                -> WHM-7
   * - onGoToReturn()                  -> WHM-9 (полный список)
   * - onQuickReturn(unit)             -> WHM-9 (единица предвыбрана)
   * - onOpenActiveOrder(order)        -> экран активного заказа
   * - onOpenActiveOrdersList()        -> WHM-11 (фильтр «активные»)
   * - onOpenHistory()                 -> WHM-11
   * - onOpenProfile()                 -> Профиль и биллинг
   * - onOpenSupport()                 -> Поддержка клиента
   */

  const demoStorageUnits = [
    {
      id: 'BX-104',
      type: 'box',
      title: 'Коробка L',
      description: 'Зимняя одежда, пледы',
      storedSince: '2026-05-12',
      storedSinceLabel: '12 мая 2026',
      monthlyPrice: 590,
      status: 'stored'
    },
    {
      id: 'BX-118',
      type: 'box',
      title: 'Коробка M',
      description: 'Книги и документы',
      storedSince: '2026-06-28',
      storedSinceLabel: '28 июня 2026',
      monthlyPrice: 390,
      status: 'stored'
    },
    {
      id: 'IT-031',
      type: 'item',
      title: 'Велосипед',
      description: 'Городской велосипед',
      storedSince: '2026-04-03',
      storedSinceLabel: '3 апреля 2026',
      monthlyPrice: 850,
      status: 'stored'
    },
    {
      id: 'IT-044',
      type: 'item',
      title: 'Лыжи',
      description: 'Комплект с палками',
      storedSince: '2026-03-19',
      storedSinceLabel: '19 марта 2026',
      monthlyPrice: 490,
      status: 'stored'
    },
    {
      id: 'BX-122',
      type: 'box',
      title: 'Коробка M',
      description: 'Посуда и декор',
      storedSince: '2026-07-07',
      storedSinceLabel: '7 июля 2026',
      monthlyPrice: 390,
      status: 'stored'
    }
  ];

  const demoActiveOrders = [
    {
      id: 'WHM-R-2048',
      type: 'return',
      stage: 'Сборка на складе',
      nextEventLabel: 'Доставка завтра, 14:00–18:00'
    }
  ];

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function defaultLoadDashboard() {
    await delay(700);
    return {
      units: demoStorageUnits,
      activeOrders: demoActiveOrders,
      nextChargeDate: '1 сентября 2026'
    };
  }

  let {
    initialTheme = 'bumblebee',
    userName = '',
    onLoadDashboard = defaultLoadDashboard,
    onOpenItem = null,
    onGoToHandover = () => {},
    onGoToReturn = () => {},
    onQuickReturn = null,
    onOpenActiveOrder = () => {},
    onOpenActiveOrdersList = () => {},
    onOpenHistory = () => {},
    onOpenProfile = () => {},
    onOpenSupport = () => {}
  } = $props();

  let theme = $state('bumblebee');
  let initialized = $state(false);
  let loading = $state(true);
  let loadError = $state(false);
  let refreshing = $state(false);

  let units = $state([]);
  let activeOrders = $state([]);
  let nextChargeDate = $state('');

  let activeFilter = $state('all');
  let searchQuery = $state('');
  let quickActionUnit = $state(null);

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    initialized = true;
  });

  $effect(() => {
    fetchDashboard();
  });

  async function fetchDashboard() {
    loading = true;
    loadError = false;
    try {
      const result = await onLoadDashboard();
      units = result?.units ?? [];
      activeOrders = result?.activeOrders ?? [];
      nextChargeDate = result?.nextChargeDate ?? '';
    } catch (error) {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    refreshing = true;
    try {
      const result = await onLoadDashboard();
      units = result?.units ?? [];
      activeOrders = result?.activeOrders ?? [];
      nextChargeDate = result?.nextChargeDate ?? '';
      loadError = false;
    } catch (error) {
      loadError = true;
    } finally {
      refreshing = false;
    }
  }

  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  }

  function openItemDetails(unit) {
    if (typeof onOpenItem === 'function') onOpenItem(unit);
  }

  function goToReturn() {
    if (!hasUnits) return;
    onGoToReturn();
  }

  function quickReturn(unit) {
    quickActionUnit = null;
    if (typeof onQuickReturn === 'function') {
      onQuickReturn(unit);
    } else {
      onGoToReturn();
    }
  }

  function openActiveOrdersOverflow() {
    onOpenActiveOrdersList();
  }

  let isDark = $derived(theme === 'halloween');
  let hasUnits = $derived(units.length > 0);
  let currentMonthly = $derived(
    units.filter((unit) => unit.status === 'stored').reduce((sum, unit) => sum + unit.monthlyPrice, 0)
  );
  let showSearchControls = $derived(units.length > 8);
  let visibleActiveOrders = $derived(activeOrders.slice(0, 3));
  let overflowActiveOrdersCount = $derived(Math.max(0, activeOrders.length - 3));
  let filteredUnits = $derived(
    units.filter((unit) => {
      const matchesFilter = activeFilter === 'all' || unit.type === activeFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        unit.title.toLowerCase().includes(query) ||
        unit.id.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    })
  );
  let greeting = $derived(userName ? `Здравствуйте, ${userName}` : 'Мои вещи');
</script>

<svelte:head>
  <title>Мои вещи · Клиентский интерфейс</title>
  <meta name="description" content="Дашборд клиента: вещи на хранении, статусы и стоимость" />
</svelte:head>

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  <header class="app-header">
    <div class="brand" aria-label="Клиентский интерфейс">
      <span class="system-label">Клиентский интерфейс</span>
    </div>

    <div class="header-actions">
      <button class="icon-button" type="button" aria-label="Поддержка" onclick={onOpenSupport}>
        <CircleHelp aria-hidden="true" />
      </button>
      <button
        class="icon-button"
        type="button"
        aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        onclick={toggleTheme}
      >
        {#if isDark}
          <Sun aria-hidden="true" />
        {:else}
          <Moon aria-hidden="true" />
        {/if}
      </button>
      <button class="icon-button" type="button" aria-label="Профиль и биллинг" onclick={onOpenProfile}>
        <User aria-hidden="true" />
      </button>
    </div>
  </header>

  <main class="dashboard-shell">
    <div class="page-heading">
      <h1>{greeting}</h1>
      <p>Вещи на хранении, статусы и стоимость — в одном месте.</p>
    </div>

    {#if loadError}
      <div class="error-banner" role="alert">
        <TriangleAlert aria-hidden="true" />
        <span>Не удалось загрузить данные.</span>
        <button class="link-button" type="button" onclick={fetchDashboard}>Повторить</button>
      </div>
    {/if}

    {#if loading}
      <div class="summary-card skeleton" aria-hidden="true"></div>
      <div class="unit-grid">
        {#each Array(4) as _}
          <div class="unit-card skeleton-card" aria-hidden="true"></div>
        {/each}
      </div>
    {:else if !hasUnits && !loadError}
      <section class="empty-state">
        <div class="empty-illustration" aria-hidden="true">
          <Warehouse aria-hidden="true" />
        </div>
        <h2>У вас пока нет вещей на хранении</h2>
        <p>Сдайте вещи на хранение — мы заберём их и разместим на складе.</p>
        <button class="primary-button" type="button" onclick={onGoToHandover}>
          <span>Сдать вещи</span>
          <ArrowRight aria-hidden="true" />
        </button>
      </section>
    {:else}
      <section class="summary-card">
        <div class="summary-main">
          <span class="summary-label">Хранение сейчас</span>
          <strong class="summary-value">{formatMoney(currentMonthly)}/мес.</strong>
          <span class="summary-caption">{units.length} {units.length === 1 ? 'вещь' : 'вещи'} на хранении</span>
        </div>
        <div class="summary-side">
          {#if nextChargeDate}
            <span class="summary-caption">Следующее списание: {nextChargeDate}</span>
          {/if}
          <button class="link-button" type="button" onclick={onOpenHistory}>История заказов</button>
        </div>
        <button
          class="refresh-button"
          type="button"
          aria-label="Обновить"
          disabled={refreshing}
          onclick={refresh}
        >
          <RefreshCw class={refreshing ? 'spinning' : ''} aria-hidden="true" />
        </button>
      </section>

      {#if visibleActiveOrders.length > 0}
        <div class="active-orders">
          {#each visibleActiveOrders as order}
            <button class="active-order-banner" type="button" onclick={() => onOpenActiveOrder(order)}>
              <span class="active-order-type">{order.type === 'return' ? 'Возврат' : 'Сдача'}</span>
              <span class="active-order-stage">{order.stage}</span>
              <span class="active-order-next">{order.nextEventLabel}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          {/each}
          {#if overflowActiveOrdersCount > 0}
            <button class="active-order-overflow" type="button" onclick={openActiveOrdersOverflow}>
              У вас ещё {overflowActiveOrdersCount} активных заказов
            </button>
          {/if}
        </div>
      {/if}

      <div class="action-row">
        <button class="primary-button" type="button" onclick={onGoToHandover}>
          <span>Сдать вещи</span>
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          class="secondary-button"
          type="button"
          disabled={!hasUnits}
          title={!hasUnits ? 'Нет вещей на хранении для возврата' : undefined}
          onclick={goToReturn}
        >
          <span>Вернуть вещи</span>
        </button>
      </div>

      {#if showSearchControls}
        <div class="filter-row">
          <label class="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Поиск по названию или номеру"
              bind:value={searchQuery}
              aria-label="Поиск по названию или номеру"
            />
          </label>
          <div class="segmented-control" aria-label="Фильтр вещей">
            <button class:active={activeFilter === 'all'} type="button" onclick={() => (activeFilter = 'all')}>Все</button>
            <button class:active={activeFilter === 'box'} type="button" onclick={() => (activeFilter = 'box')}>Коробки</button>
            <button class:active={activeFilter === 'item'} type="button" onclick={() => (activeFilter = 'item')}>Предметы</button>
          </div>
        </div>
      {/if}

      <div class="unit-grid">
        {#each filteredUnits as unit}
          <article class="unit-card">
            <button class="unit-main" type="button" onclick={() => openItemDetails(unit)}>
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
                <span class="unit-caption">{unit.internalID || unit.id}{unit.storedSinceLabel ? ` · хранится с ${unit.storedSinceLabel}` : ''}</span>
                <span class="unit-status">{unit.statusLabel || 'На хранении'}</span>
              </span>
            </button>
            <div class="unit-actions">
              <button class="link-button" type="button" onclick={() => openItemDetails(unit)}>Подробнее</button>
              <button class="link-button" type="button" disabled={Boolean(unit.lockReason)} onclick={() => quickReturn(unit)}>Вернуть эту вещь</button>
            </div>
          </article>
        {/each}
        {#if filteredUnits.length === 0}
          <div class="empty-search">
            <p>Ничего не найдено. Проверьте название или номер.</p>
            <button class="link-button" type="button" onclick={() => { searchQuery = ''; activeFilter = 'all'; }}>Сбросить поиск</button>
          </div>
        {/if}
      </div>
    {/if}
  </main>
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
  :global(input) {
    font: inherit;
    font-family: 'Open Sans', sans-serif;
  }

  :global(button) {
    -webkit-tap-highlight-color: transparent;
  }

  .whm-app {
    --page-gutter: clamp(1rem, 3vw, 2.5rem);
    --header-height: 5.25rem;
    --content-max: 72rem;
    --type-h1: clamp(2rem, 3.6vw, 3rem);
    --type-heading: clamp(1.2rem, 2vw, 1.6rem);
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
    --color-base-content: oklch(20% 0 0);
    --color-primary: oklch(85% 0.199 91.936);
    --color-primary-content: oklch(42% 0.095 57.708);
    --color-secondary: oklch(75% 0.183 55.934);
    --color-warning: oklch(82% 0.189 84.429);
    --color-error: oklch(70% 0.191 22.216);
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .whm-app[data-theme='halloween'] {
    color-scheme: dark;
    --color-base-100: oklch(21% 0.006 56.043);
    --color-base-200: oklch(14% 0.004 49.25);
    --color-base-content: oklch(84.955% 0 0);
    --color-primary: oklch(76% 0.188 70.08);
    --color-primary-content: oklch(19.693% 0.004 196.779);
    --color-secondary: oklch(45.98% 0.248 305.03);
    --color-warning: oklch(66.584% 0.157 58.318);
    --color-error: oklch(65.72% 0.199 27.33);
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .ambient {
    position: fixed;
    z-index: -1;
    border-radius: 999px;
    pointer-events: none;
    opacity: 0.55;
  }

  .ambient-one {
    top: -15rem;
    right: -12rem;
    width: 32rem;
    height: 32rem;
    background: radial-gradient(circle, var(--primary-soft), transparent 68%);
  }

  .ambient-two {
    bottom: -18rem;
    left: -15rem;
    width: 38rem;
    height: 38rem;
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

  .brand {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .icon-button {
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
    transition: border-color 180ms ease, background 180ms ease;
  }

  .icon-button:hover {
    border-color: var(--color-primary);
    background: var(--color-base-200);
  }

  .icon-button :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .dashboard-shell {
    width: min(calc(100% - (var(--page-gutter) * 2)), var(--content-max));
    margin: 0 auto 3rem;
    padding-bottom: 2rem;
  }

  .page-heading {
    margin-top: clamp(1rem, 3vh, 2rem);
  }

  .page-heading h1 {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 810;
    letter-spacing: -0.03em;
  }

  .page-heading p {
    margin: 0.5rem 0 0;
    color: var(--soft-content);
  }

  .error-banner {
    margin-top: 1.25rem;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
    color: var(--color-base-content);
  }

  .error-banner :global(svg) {
    width: 1.15rem;
    flex: 0 0 auto;
    fill: none;
    stroke: var(--color-error);
    stroke-width: 1.8;
  }

  .error-banner span {
    font-size: var(--type-caption);
  }

  .link-button {
    padding: 0;
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--color-base-content);
    font-weight: 700;
    font-size: var(--type-caption);
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }

  .summary-card {
    margin-top: 1.5rem;
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
  }

  .summary-card.skeleton {
    height: 6.5rem;
    background: linear-gradient(90deg, var(--color-base-200) 25%, color-mix(in oklab, var(--color-base-200) 60%, transparent) 37%, var(--color-base-200) 63%);
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  .summary-main {
    display: grid;
    gap: 0.25rem;
  }

  .summary-label {
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .summary-value {
    font-size: var(--type-heading);
    font-weight: 800;
  }

  .summary-caption {
    color: var(--faint-content);
    font-size: var(--type-caption);
  }

  .summary-side {
    margin-left: auto;
    display: grid;
    gap: 0.4rem;
    justify-items: end;
    text-align: right;
  }

  .refresh-button {
    width: 2.6rem;
    height: 2.6rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: var(--border) solid var(--soft-border);
    border-radius: 50%;
    background: transparent;
    color: var(--color-base-content);
    cursor: pointer;
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-button :global(svg) {
    width: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .refresh-button :global(svg.spinning) {
    animation: spin 900ms linear infinite;
  }

  .active-orders {
    margin-top: 1rem;
    display: grid;
    gap: 0.6rem;
  }

  .active-order-banner {
    padding: 0.9rem 1.1rem;
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 0.75rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--primary-faint);
    color: var(--color-base-content);
    text-align: left;
    cursor: pointer;
  }

  .active-order-type {
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: var(--color-primary);
    color: #171717;
    font-size: var(--type-caption);
    font-weight: 750;
  }

  .active-order-stage {
    font-weight: 700;
    font-size: var(--type-caption);
  }

  .active-order-next {
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .active-order-banner :global(svg) {
    width: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
  }

  .active-order-overflow {
    padding: 0.6rem 1.1rem;
    border: var(--border) dashed var(--soft-border);
    border-radius: var(--radius-field);
    background: transparent;
    color: var(--soft-content);
    font-size: var(--type-caption);
    text-align: left;
    cursor: pointer;
  }

  .action-row {
    margin-top: 1.5rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
  }

  .primary-button,
  .secondary-button {
    min-height: 3.25rem;
    border-radius: var(--radius-field);
    font-weight: 750;
    cursor: pointer;
    transition: transform 180ms ease, opacity 180ms ease;
  }

  .primary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    border: var(--border) solid color-mix(in oklab, var(--color-primary-content) 12%, transparent);
    background: var(--color-primary);
    color: #171717;
    box-shadow: 0 10px 24px color-mix(in oklab, var(--color-primary) 22%, transparent);
  }

  .primary-button:hover {
    transform: translateY(-1px);
  }

  .primary-button :global(svg) {
    width: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
  }

  .secondary-button {
    border: var(--border) solid var(--soft-border);
    background: var(--color-base-100);
    color: #171717;
  }

  .secondary-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .filter-row {
    margin-top: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .search-field {
    flex: 1 1 16rem;
    min-height: 3rem;
    padding: 0 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
  }

  .search-field:focus-within {
    border-color: var(--color-primary);
  }

  .search-field :global(svg) {
    width: 1.05rem;
    flex: 0 0 auto;
    fill: none;
    stroke: var(--faint-content);
    stroke-width: 1.8;
  }

  .search-field input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-base-content);
  }

  .segmented-control {
    padding: 0.2rem;
    display: flex;
    gap: 0.2rem;
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-field);
    background: var(--color-base-200);
  }

  .segmented-control button {
    min-height: 2.3rem;
    padding: 0.4rem 0.8rem;
    border: 0;
    border-radius: calc(var(--radius-field) - 0.2rem);
    background: transparent;
    color: var(--soft-content);
    cursor: pointer;
  }

  .segmented-control button.active {
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-weight: 700;
  }

  .unit-grid {
    margin-top: 1.25rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }

  .unit-card {
    border: var(--border) solid var(--soft-border);
    border-radius: var(--radius-box);
    background: var(--color-base-100);
    overflow: hidden;
  }

  .skeleton-card {
    min-height: 8rem;
    background: linear-gradient(90deg, var(--color-base-200) 25%, color-mix(in oklab, var(--color-base-200) 60%, transparent) 37%, var(--color-base-200) 63%);
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  .unit-main {
    width: 100%;
    padding: 0.85rem;
    display: grid;
    grid-template-columns: 5.4rem minmax(0, 1fr);
    gap: 0.85rem;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
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

  .placeholder-glyph {
    position: relative;
    width: 1.9rem;
    height: 1.4rem;
    border: 1.5px solid currentColor;
    border-radius: 0.3rem;
    opacity: 0.7;
  }

  .placeholder-label {
    position: absolute;
    right: 0.4rem;
    bottom: 0.3rem;
    font-weight: 650;
    font-size: 0.65rem;
  }

  .item-placeholder {
    width: 5.4rem;
    height: 6rem;
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
    gap: 0.5rem;
  }

  .unit-title-row strong {
    font-weight: 780;
  }

  .unit-price {
    flex: 0 0 auto;
    color: var(--soft-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .unit-description,
  .unit-caption {
    margin-top: 0.2rem;
    color: var(--soft-content);
    font-size: var(--type-caption);
  }

  .unit-status {
    margin-top: auto;
    padding-top: 0.4rem;
    color: var(--color-primary-content);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .unit-actions {
    padding: 0 0.85rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    border-top: var(--border) solid var(--muted-border);
    padding-top: 0.6rem;
  }

  .unit-actions .link-button {
    margin-left: 0;
  }

  .empty-search {
    grid-column: 1 / -1;
    padding: 1.5rem;
    text-align: center;
    color: var(--soft-content);
    border: var(--border) dashed var(--soft-border);
    border-radius: var(--radius-box);
  }

  .empty-search p {
    margin: 0 0 0.5rem;
  }

  .empty-state {
    margin-top: 3rem;
    padding: 2.5rem 1.5rem;
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 0.6rem;
    border: var(--border) dashed var(--soft-border);
    border-radius: var(--radius-box);
  }

  .empty-illustration {
    width: 3.5rem;
    height: 3.5rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--primary-faint);
    color: var(--color-base-content);
  }

  .empty-illustration :global(svg) {
    width: 1.7rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
  }

  .empty-state h2 {
    margin: 0.4rem 0 0;
    font-size: var(--type-heading);
  }

  .empty-state p {
    margin: 0;
    max-width: 26rem;
    color: var(--soft-content);
  }

  .empty-state .primary-button {
    margin-top: 0.75rem;
    width: min(100%, 18rem);
    padding: 0 1.2rem;
  }

  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: 0 0; }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  :global(button:focus-visible),
  :global(input:focus-visible) {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent);
    outline-offset: 3px;
  }

  @media (max-width: 720px) {
    .app-header {
      padding: 0 1rem;
    }

    .dashboard-shell {
      width: calc(100% - 2rem);
    }

    .summary-card {
      flex-wrap: wrap;
    }

    .summary-side {
      margin-left: 0;
      align-items: flex-start;
      justify-items: start;
      text-align: left;
    }

    .action-row {
      grid-template-columns: 1fr;
    }

    .unit-grid {
      grid-template-columns: 1fr;
    }

    .active-order-banner {
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
    }

    .active-order-next {
      grid-column: 1 / -1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }



</style>
