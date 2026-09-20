<script>
  import { ArrowRight, ExternalLink } from '@lucide/svelte';
  import { formatMoney } from '../demo.js';
  let { demo, onNavigate = () => {}, onScenario = () => {}, onStage = () => {} } = $props();
  const screens = [
    { id: 'signin', code: 'WHM-3', title: 'Авторизация и онбординг', group: 'Начало' },
    { id: 'home', code: 'WHM-4', title: 'Мои вещи', group: 'Хранение' },
    { id: 'item/BX-104', code: 'WHM-5', title: 'Карточка вещи', group: 'Хранение' },
    { id: 'order', code: 'WHM-6', title: 'Активный заказ', group: 'Заказы' },
    { id: 'intake', code: 'WHM-7', title: 'Сдать вещи', group: 'Заказы' },
    { id: 'return', code: 'WHM-9', title: 'Вернуть вещи', group: 'Заказы' },
    { id: 'history', code: 'WHM-11', title: 'История заказов', group: 'Заказы' },
    { id: 'support', code: 'WHM-12', title: 'Поддержка клиента', group: 'Аккаунт' },
    { id: 'profile', code: 'WHM-13', title: 'Профиль и биллинг', group: 'Аккаунт' },
    { id: 'subscription', code: 'WHM-14', title: 'Управление подпиской', group: 'Аккаунт' },
    { id: 'payments', code: 'WHM-14', title: 'История платежей', group: 'Аккаунт' }
  ];
  const groups = ['Начало', 'Хранение', 'Заказы', 'Аккаунт'];
  let total = $derived(demo.units.reduce((sum, unit) => sum + unit.monthlyPrice, 0));
</script>

<svelte:head><title>Карта клиентских экранов</title></svelte:head>

<main class="preview">
  <header><div class="brand">Клиентский демо-контур</div><button type="button" onclick={() => onNavigate('home')}>В приложение <ArrowRight size={16} aria-hidden="true" /></button></header>
  <div class="hero"><span class="eyebrow">ОБЗОР ПРОДУКТА</span><h1>Все клиентские экраны<br />в одном месте</h1><p>Пройдите сценарии сдачи и возврата, изучите состояния и навигацию. Данные демонстрационные: сервер, SMS и реальные платежи не подключены.</p></div>
  <div class="layout">
    <div>
      {#each groups as group}
        <section class="group"><h2>{group}</h2><div class="screen-grid">
          {#each screens.filter(screen => screen.group === group) as screen}
            <button class="screen-card" type="button" onclick={() => onNavigate(screen.id)}><span>{screen.code}</span><strong>{screen.title}</strong><b aria-hidden="true"><ExternalLink size={17} /></b></button>
          {/each}
        </div></section>
      {/each}
    </div>
    <aside>
      <section class="demo-card"><span class="eyebrow">ДАННЫЕ ДЛЯ ПРОСМОТРА</span><h2>Сценарий</h2><div class="scenario-switch"><button class:active={demo.scenario === 'standard'} type="button" onclick={() => onScenario('standard')}>С вещами</button><button class:active={demo.scenario === 'empty'} type="button" onclick={() => onScenario('empty')}>Первый вход</button></div><div class="stat"><span>Вещей на хранении</span><strong>{demo.units.length}</strong></div><div class="stat"><span>Стоимость / месяц</span><strong>{formatMoney(total)}</strong></div><div class="stat"><span>Активный заказ</span><strong>{demo.activeOrder?.id || 'Нет'}</strong></div></section>
      <section class="demo-card"><span class="eyebrow">ПРОВЕРКА СТАТУСОВ</span><h2>Активный заказ</h2><p>Выберите этап, чтобы посмотреть ленту заказа.</p><div class="stage-list">{#each ['created', 'courier', 'warehouse_received', 'storing', 'completed'] as stage}<button type="button" disabled={!demo.activeOrder} class:active={demo.activeOrder?.status === stage} onclick={() => onStage(stage)}>{({ created: 'Заявка создана', courier: 'Курьер в пути', warehouse_received: 'Принято на складе', storing: 'Размещаем', completed: 'Завершён' })[stage]}</button>{/each}</div><button class="open-order" type="button" onclick={() => onNavigate('order')}>Открыть заказ <ArrowRight size={16} aria-hidden="true" /></button></section>
      <p class="sidebar-note">Действия в этом контуре сохраняются только в браузере. Переключение сценария сбрасывает демо-данные.</p>
    </aside>
  </div>
</main>

<style>
  .preview{min-height:100dvh;background:#f7f7f4;color:#24241f;font:16px/1.5 'Open Sans',sans-serif;padding-bottom:70px}.preview>header{display:flex;align-items:center;justify-content:space-between;gap:15px;max-width:1200px;margin:auto;padding:26px 25px}.brand{font-size:20px;font-weight:800;letter-spacing:.1em;display:flex;align-items:center;gap:8px}.preview>header button,.open-order{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;background:#f4c84a;border-radius:10px;padding:12px 17px;font-weight:800;color:#24241f}.hero{max-width:1200px;margin:35px auto 45px;padding:0 25px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:#8b731f}.hero h1{font-size:clamp(35px,5.5vw,66px);letter-spacing:-.05em;line-height:1.08;margin:14px 0}.hero p{max-width:640px;color:#777873;font-size:15px}.layout{max-width:1200px;margin:auto;padding:0 25px;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:35px}.group{margin-bottom:35px}.group h2{font-size:18px;margin:0 0 13px}.screen-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.screen-card{position:relative;min-height:105px;text-align:left;background:#fff;border:1px solid #e7e7e3;border-radius:15px;padding:18px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;color:#24241f;transition:border-color .2s,transform .2s}.screen-card:hover{border-color:#e1b735;transform:translateY(-2px)}.screen-card span{font-size:11px;color:#8b731f;font-weight:800;letter-spacing:.05em}.screen-card strong{font-size:16px}.screen-card b{position:absolute;right:18px;top:16px;font-size:17px}aside{display:grid;align-content:start;gap:16px}.demo-card{background:#fff;border:1px solid #e7e7e3;border-radius:16px;padding:21px}.demo-card h2{font-size:20px;margin:8px 0 15px}.demo-card p{font-size:12px;color:#777873}.scenario-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#f3f3ee;border-radius:10px;padding:4px;margin-bottom:18px}.scenario-switch button{border:0;background:transparent;border-radius:7px;min-height:35px;font-size:12px;font-weight:700}.scenario-switch button.active{background:#f4c84a;color:#24241f}.stat{border-top:1px solid #ededeb;padding:12px 0;display:flex;justify-content:space-between;gap:8px;font-size:12px}.stat span{color:#777873}.stat strong{text-align:right}.stage-list{display:grid;gap:5px}.stage-list button{text-align:left;border:1px solid #ebebe7;background:#fafaf8;border-radius:7px;padding:8px 10px;font-size:12px}.stage-list button.active{background:#fff3c7;border-color:#e5c45c;font-weight:800}.stage-list button:disabled{opacity:.5}.open-order{width:100%;margin-top:13px}.sidebar-note{font-size:11px;color:#777873;margin:0 5px}
  @media(max-width:850px){.layout{grid-template-columns:1fr}aside{grid-row:1;grid-template-columns:repeat(2,1fr)}.sidebar-note{grid-column:1/-1}}@media(max-width:570px){.preview>header,.hero,.layout{padding-left:16px;padding-right:16px}.screen-grid,aside{grid-template-columns:1fr}.sidebar-note{grid-column:auto}}
</style>
