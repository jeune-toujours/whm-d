<script>
  import { ArrowLeft, ArrowRight, Check, CreditCard, Pause } from '@lucide/svelte';
  import { plans as demoPlans, formatMoney } from '../demo.js';

  let { plans = demoPlans, simulation = false, profile, unitCount = 0, hasActiveOrder = false, initialTheme = 'bumblebee', onBack = () => {}, onChangePlan = async () => ({ ok: true }), onPause = async () => ({ ok: true }), onReturn = () => {}, onOpenPayments = () => {} } = $props();
  let selected = $state(profile?.planId || (simulation ? '' : 'standard'));
  let busy = $state(false);
  let notice = $state('');
  let paused = $state(profile?.subscriptionStatus === 'paused');
  let currentPlan = $derived(plans.find(plan => plan.id === profile?.planId) || (simulation ? { id:'', title:'Подписка не выбрана', price:0, volume:'' } : plans[1]));
  let selectedPlan = $derived(plans.find(plan => plan.id === selected) || { limit:Infinity });
  let downgradeBlocked = $derived(selectedPlan.limit < unitCount);
  let pauseBlocked = $derived(unitCount > 0 || hasActiveOrder);

  async function applyPlan() {
    notice = '';
    if (downgradeBlocked) { notice = `Тариф вмещает до ${selectedPlan.limit} единиц. Сначала оформите возврат лишних вещей.`; return; }
    busy = true;
    try {
      const result = await onChangePlan(selected);
      notice = result?.ok === false ? result.message || 'Не удалось изменить тариф.' : simulation ? 'Подтвердите тестовую оплату.' : `Тариф «${selectedPlan.title}» выбран в демо-контуре.`;
    } catch { notice = 'Не удалось изменить тариф. Повторите попытку.'; }
    finally { busy = false; }
  }

  async function pause() {
    notice = '';
    if (pauseBlocked) { notice = 'Для приостановки нужно вернуть все вещи и завершить активные заказы.'; return; }
    busy = true;
    try {
      const result = await onPause();
      if (result?.ok === false) notice = result.message || 'Не удалось приостановить подписку.';
      else { paused = true; notice = simulation ? 'Тестовая подписка приостановлена.' : 'Подписка приостановлена в демо-контуре.'; }
    } catch { notice = 'Не удалось приостановить подписку.'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Управление подпиской · Клиентский интерфейс</title></svelte:head>

<div class:dark={initialTheme === 'halloween'} class="subscription-page">
  <header class="header">
    <button class="back" type="button" onclick={onBack} aria-label="Назад"><ArrowLeft aria-hidden="true" /></button>
    <div class="brand"><strong>Клиентский интерфейс</strong></div>
    <span class="header-label">Подписка</span>
  </header>

  <main class="shell">
    <div class="eyebrow">Профиль <span>/</span> Подписка</div>
    <h1>Ваше хранение<br />под контролем</h1>
    <p class="intro">Посмотрите условия, сравните тарифы и настройте подписку.</p>

    <section class="current-card">
      <div>
        <span class="kicker">Текущий тариф</span>
        <h2>{currentPlan.title}</h2>
        <p>{currentPlan.volume} · {unitCount} {unitCount === 1 ? 'вещь' : 'вещей'} сейчас на хранении</p>
      </div>
      <div class="current-price"><strong>{formatMoney(profile?.monthlyPrice || currentPlan.price)}</strong><span>в месяц</span></div>
      <div class="charge-line"><span class="dot"></span>{paused ? 'Подписка приостановлена' : `Следующее списание ${profile?.nextChargeDate || 'уточняется'}`}</div>
    </section>

    <section class="section">
      <div class="section-heading"><h2>Выберите тариф</h2><p>{simulation ? 'Тестовый тариф применяется после подтверждения оплаты.' : 'Изменение в демо сохраняется только в этом браузере.'}</p></div>
      <div class="plan-grid">
        {#each plans as plan}
          <button class:selected={selected === plan.id} class="plan-card" type="button" onclick={() => { selected = plan.id; notice = ''; }} aria-pressed={selected === plan.id}>
            <span class="plan-top"><strong>{plan.title}</strong>{#if plan.id === currentPlan.id}<small>Текущий</small>{/if}</span>
            <span class="plan-volume">{plan.volume}</span>
            <span class="plan-price">{formatMoney(plan.price)}<small>/мес.</small></span>
            <span class="plan-action">{#if selected === plan.id}<Check size={16} aria-hidden="true" /> Выбран{:else}Выбрать <ArrowRight size={16} aria-hidden="true" />{/if}</span>
          </button>
        {/each}
      </div>
      {#if downgradeBlocked}<p class="warning">Выбранный тариф рассчитан на меньшее число вещей. Верните часть вещей перед переходом.</p>{/if}
      <div class="action-row">
        <button class="primary" type="button" disabled={busy || !selected || selected === currentPlan.id || downgradeBlocked} onclick={applyPlan}>{busy ? 'Сохраняем…' : 'Применить тариф'}</button>
        {#if downgradeBlocked}<button class="secondary" type="button" onclick={onReturn}>Оформить возврат</button>{/if}
      </div>
    </section>

    <section class="section lower-grid">
      <div class="info-card">
        <div class="icon"><CreditCard aria-hidden="true" /></div><h2>История платежей</h2>
        <p>Последние начисления и доступные чеки по хранению.</p>
        <button class="text-link" type="button" onclick={onOpenPayments}>Смотреть историю <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      <div class="info-card">
        <div class="icon">Ⅱ</div><h2>Приостановка</h2>
        <p>{pauseBlocked ? 'Доступна после возврата вещей и завершения заказов.' : 'Доступна, когда вещей на хранении нет.'}</p>
        <button class="text-link" type="button" disabled={busy || pauseBlocked || paused} onclick={pause}>{#if paused}<Pause size={16} aria-hidden="true" /> Приостановлена{:else}Приостановить подписку <ArrowRight size={16} aria-hidden="true" />{/if}</button>
      </div>
    </section>
    {#if notice}<p class="notice" role="status" aria-live="polite">{notice}</p>{/if}
    <p class="footnote">Правила сроков приостановки пока не утверждены в продуктовой документации. Этот экран показывает интерфейс и ограничения клиентского сценария.</p>
  </main>
</div>

<style>
  .subscription-page{--bg:#fff;--surface:#fff;--soft:#f8f8f6;--line:#e8e8e5;--ink:#22221f;--muted:#777873;--yellow:#f5c844;min-height:100dvh;background:var(--bg);color:var(--ink);font:16px/1.5 'Open Sans',sans-serif}.subscription-page.dark{--bg:#24231f;--surface:#292824;--soft:#313029;--line:#47453d;--ink:#f3f0e8;--muted:#b2afa5;--yellow:#e6aa35}
  .header{height:76px;max-width:1080px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:16px}.back{width:42px;height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:24px}.brand{display:flex;align-items:center;gap:8px;font-size:19px;letter-spacing:.1em}.header-label{margin-left:auto;color:var(--muted);font-size:13px}
  .shell{max-width:1032px;margin:32px auto 70px;padding:0 24px}.eyebrow{color:var(--muted);font-size:13px}.eyebrow span{padding:0 8px}h1{margin:18px 0 8px;font-size:clamp(34px,5vw,56px);line-height:1.1;letter-spacing:-.045em}.intro{margin:0 0 30px;color:var(--muted)}
  .current-card{display:grid;grid-template-columns:1fr auto;gap:20px;padding:30px;border-radius:22px;background:#fae5a0;color:#27251e}.current-card h2{font-size:28px;letter-spacing:-.03em;margin:10px 0 3px}.current-card p{margin:0;color:#655734;font-size:13px}.kicker{font-weight:800;font-size:12px;letter-spacing:.07em;text-transform:uppercase}.current-price{text-align:right;display:grid;align-content:center}.current-price strong{font-size:32px;letter-spacing:-.04em}.current-price span{font-size:13px}.charge-line{grid-column:1/-1;display:flex;gap:8px;align-items:center;border-top:1px solid #ad934f77;padding-top:17px;font-size:13px;font-weight:700}.dot{width:8px;height:8px;background:#4e8b51;border-radius:50%}
  .section{margin-top:45px}.section-heading h2{margin:0;font-size:24px}.section-heading p{margin:4px 0 20px;color:var(--muted);font-size:13px}.plan-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.plan-card{padding:21px;text-align:left;border:1px solid var(--line);border-radius:17px;background:var(--surface);color:var(--ink);min-height:194px;display:flex;flex-direction:column;align-items:stretch}.plan-card.selected{border:2px solid #d1a52e;background:#fffaf0;padding:20px}.dark .plan-card.selected{background:#393327}.plan-top{display:flex;align-items:center;justify-content:space-between;gap:5px;font-size:17px}.plan-top small{border-radius:100px;padding:4px 7px;background:var(--soft);font-size:10px;color:var(--muted)}.plan-volume{color:var(--muted);font-size:13px;margin-top:4px}.plan-price{font-weight:800;font-size:25px;letter-spacing:-.03em;margin-top:auto}.plan-price small{font-size:12px;color:var(--muted);font-weight:500}.plan-action{display:inline-flex;align-items:center;gap:5px;margin-top:9px;font-size:12px;font-weight:800}.action-row{display:flex;gap:10px;margin-top:20px}.primary,.secondary{min-height:50px;padding:0 21px;border-radius:10px;font-weight:800}.primary{background:var(--yellow);color:#171717;border:0}.primary:disabled{opacity:.45;cursor:not-allowed}.secondary{border:1px solid var(--line);background:var(--surface);color:var(--ink)}.warning,.notice{padding:14px 16px;border-radius:10px;margin:16px 0 0;background:#fff2d5;color:#684509;font-size:13px}.notice{background:var(--soft);color:var(--ink)}
  .lower-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.info-card{border:1px solid var(--line);border-radius:17px;padding:23px}.icon{width:35px;height:35px;display:grid;place-items:center;background:#fff2c1;border-radius:9px;color:#5d4b11;font-weight:800}.info-card h2{font-size:19px;margin:16px 0 6px}.info-card p{font-size:13px;color:var(--muted);min-height:39px}.text-link{padding:0;border:0;background:none;color:var(--ink);font-weight:800;font-size:13px}.text-link:disabled{opacity:.45;cursor:not-allowed}.footnote{font-size:12px;color:var(--muted);max-width:650px;margin-top:30px}
  @media(max-width:720px){.header{height:66px;padding:0 16px}.shell{margin:18px auto 45px;padding:0 16px}.current-card{padding:22px;grid-template-columns:1fr}.current-price{text-align:left}.charge-line{grid-column:auto}.plan-grid{grid-template-columns:1fr}.plan-card{min-height:130px}.lower-grid{grid-template-columns:1fr}}
</style>
