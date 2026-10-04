<script>
  import { onMount } from 'svelte';
  import { ArrowLeft, CreditCard, CheckCircle, XCircle } from '@lucide/svelte';
  import { api, safe, download } from '../api.js';
  import '../live.css';
  let { id, initialTheme = 'bumblebee', onBack, onComplete } = $props();
  let payment = $state(null), simulation = $state(false), error = $state(''), busy = $state(false);
  async function load() { const r = await safe(() => api(`/v1/payments/${id}`)); if (r.ok === false) error = r.message; else { payment = r.payment; simulation = r.simulation; error = ''; } }
  onMount(() => { void load(); });
  async function result(status) {
    if (busy) return; busy = true; error = '';
    const r = await safe(() => api(`/v1/payments/${id}/simulate`, { result:status }));
    if (r.ok === false) error = r.message; else { payment = r.payment; await onComplete(payment, false); }
    busy = false;
  }
</script>
<svelte:head><title>Тестовая оплата · WHM</title></svelte:head>
<div class:dark={initialTheme === 'halloween'} class="live-page"><header><button onclick={onBack} aria-label="Назад"><ArrowLeft /></button><strong>Клиентский интерфейс</strong></header>
  <main class="live-shell" style="max-width:720px"><span class="eyebrow">ОПЛАТА</span><h1>Подтверждение платежа</h1>
    {#if payment}<section class="card"><CreditCard size={32} /><h2>{new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(payment.amount)}</h2><p class="muted">{payment.orderID ? 'Хранение по заявке' : 'Изменение тарифа подписки'}<br />{payment.id}</p>
      {#if ['paid','refunded'].includes(payment.status)}<p role="status"><CheckCircle size={20} /> {payment.status === 'refunded' ? 'Тестовый платёж возвращён' : 'Тестовый платёж подтверждён'}</p><div class="actions"><button class="primary" onclick={() => onComplete(payment, true)}>Продолжить</button><button class="secondary" onclick={() => download(`/v1/payments/${id}/receipt`)}>Тестовая квитанция</button></div>
      {:else}<p class="muted">Симулятор платёжного провайдера. Выберите результат. Реквизиты карты не нужны, деньги не списываются.</p>{#if payment.status === 'failed'}<p class="error" role="alert"><XCircle size={18} /> Оплата отклонена. Можно повторить попытку.</p>{/if}<div class="actions"><button class="primary" disabled={busy || !simulation} onclick={() => result('paid')}>{busy ? 'Подтверждаем…' : 'Симулировать успешную оплату'}</button><button class="secondary" disabled={busy || !simulation} onclick={() => result('failed')}>Симулировать отказ</button></div>{/if}
    </section>{:else if !error}<p role="status">Загрузка платежа…</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p><button class="secondary" onclick={load}>Повторить загрузку</button>{/if}
  </main>
</div>
