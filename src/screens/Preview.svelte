<script>
  import Brand from '$lib/components/Brand.svelte';
  import Card from '$lib/components/ui/card.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { ArrowRight, ArrowUpRight } from '@lucide/svelte';
  import { formatMoney } from '../demo.js';
  let { demo, onScenario = () => {}, onStage = () => {} } = $props();
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

  const stages = {
    created: 'Заявка создана', courier: 'Курьер в пути', warehouse_received: 'Принято на складе',
    storing: 'Размещаем', completed: 'Завершён'
  };
</script>

<svelte:head><title>Карта клиентских экранов · WHM D</title></svelte:head>

<main class="preview">
  <header><Brand /><Button href="#/home" variant="outline" size="sm">В приложение <ArrowRight size={16} aria-hidden="true" /></Button></header>
  <div class="hero"><h1>Карта клиентских экранов</h1><p>Выберите экран или смените сценарий, чтобы посмотреть, как работает хранение.</p></div>
  <div class="layout">
    <div>
      {#each groups as group}
        <section class="group"><h2>{group}</h2><div class="screen-grid">
          {#each screens.filter(screen => screen.group === group) as screen}
            <a class="screen-card" href={'#/' + screen.id}><small>{screen.code}</small><strong>{screen.title}</strong><ArrowUpRight size={16} aria-hidden="true" /></a>
          {/each}
        </div></section>
      {/each}
    </div>
    <aside>
      <Card as="section" class="demo-card">
        <h2>Сценарий</h2>
        <div class="switch">{#each [['standard','С вещами'],['empty','Первый вход']] as [value,label]}<Button size="sm" variant={demo.scenario === value ? 'default' : 'ghost'} aria-pressed={demo.scenario === value} onclick={() => onScenario(value)}>{label}</Button>{/each}</div>
        <dl><div><dt>Вещей на хранении</dt><dd>{demo.units.length}</dd></div><div><dt>Стоимость / месяц</dt><dd>{formatMoney(total)}</dd></div><div><dt>Активный заказ</dt><dd>{demo.activeOrder?.id || 'Нет'}</dd></div></dl>
        <p>Переключение сценария сбрасывает демо-данные в этом браузере.</p>
      </Card>
      <Card as="section" class="demo-card">
        <h2>Этап заказа</h2>
        <div class="stage-list">{#each Object.entries(stages) as [value,label]}<Button variant={demo.activeOrder?.status === value ? 'default' : 'outline'} size="sm" aria-pressed={demo.activeOrder?.status === value} disabled={!demo.activeOrder} onclick={() => onStage(value)}>{label}</Button>{/each}</div>
        <Button href="#/order" variant="link">Открыть заказ <ArrowRight size={15} aria-hidden="true" /></Button>
      </Card>
    </aside>
  </div>
</main>

<style>
  .preview { min-height: 100dvh; padding: 0 max(1rem, calc((100vw - 72rem) / 2)) 4rem; }
  header { min-height: 4.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--ui-line); }
  .hero { padding: clamp(2rem, 5vw, 4rem) 0; }
  h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -.055em; line-height: 1.12; }
  h2 { margin: 0 0 .85rem; font-size: 1.15rem; }
  p, dt, small { color: var(--ui-muted-foreground); }
  .hero p { max-width: 38rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, .45fr); gap: 2rem; }
  .group + .group { margin-top: 1.75rem; }
  .screen-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .65rem; }
  .screen-card { position: relative; padding: 1.1rem; display: grid; gap: .55rem; border: 1px solid var(--ui-line); border-radius: .8rem; background: var(--ui-card); color: inherit; text-decoration: none; }
  .screen-card:hover { border-color: var(--ui-ring); }
  .screen-card :global(svg) { position: absolute; right: 1rem; top: 1rem; }
  small { font-size: .72rem; font-weight: 650; }
  aside, .stage-list { display: grid; align-content: start; gap: .6rem; }
  :global(.demo-card[data-slot="card"]) { padding: 1.25rem; }
  .switch { display: flex; gap: .25rem; }
  dl { margin: .75rem 0; }
  dl div { display: flex; justify-content: space-between; gap: .6rem; border-bottom: 1px solid var(--ui-line); padding: .6rem 0; font-size: .82rem; }
  dd { margin: 0; font-weight: 650; }
  aside p { font-size: .8rem; line-height: 1.5; }
  @media(max-width: 700px) { .layout { grid-template-columns: 1fr; } }
  @media(max-width: 450px) { .screen-grid { grid-template-columns: 1fr; } }
</style>
