<script>
  import { ArrowLeft, ArrowRight, Box, Package, Truck, Check } from '@lucide/svelte';
  import '../live.css';
  let { kind = 'intake', tariffs = [], units = [], warehouses = [], selectedIds = [], initialTheme = 'bumblebee', onSubmit, onBack } = $props();
  let step = $state(0), busy = $state(false), error = $state('');
  let quantities = $state({}), descriptions = $state({}), chosen = $state([...selectedIds]);
  let fulfillment = $state('pickup'), address = $state(''), slot = $state('');
  let key = crypto.randomUUID(), lastPayload = '';
  const money = value => new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(value);
  let lines = $derived(tariffs.filter(t => Number(quantities[t.id]) > 0).map(t => ({ tariffID:t.id, quantity:Number(quantities[t.id]), description:descriptions[t.id] || '' })));
  let selectedUnits = $derived(units.filter(u => chosen.includes(u.id)));
  let total = $derived(kind === 'intake' ? lines.reduce((sum, l) => sum + tariffs.find(t => t.id === l.tariffID).monthlyPrice * l.quantity, 0) : selectedUnits.reduce((sum, u) => sum + u.monthlyPrice, 0));
  const steps = ['Вещи', 'Передача', 'Проверка'];
  function toggle(id) { chosen = chosen.includes(id) ? chosen.filter(v => v !== id) : [...chosen, id]; }
  function next() {
    error = '';
    if (step === 0 && !(kind === 'intake' ? lines.length : chosen.length)) { error = 'Выберите хотя бы одну вещь.'; return; }
    if (step === 1 && fulfillment === 'courier' && !address.trim()) { error = 'Укажите адрес.'; return; }
    step += 1;
  }
  async function submit() {
    if (busy) return; busy = true; error = '';
    const payload = { ...(kind === 'intake' ? { items:lines } : { itemIDs:chosen }), fulfillment, address, slot };
    const fingerprint = JSON.stringify(payload);
    if (lastPayload && lastPayload !== fingerprint) key = crypto.randomUUID();
    lastPayload = fingerprint;
    try { const r = await onSubmit(payload, key); if (r?.ok === false) error = r.message || 'Не удалось создать заявку.'; }
    catch { error = 'Нет соединения. Повторите попытку: заявка не продублируется.'; }
    finally { busy = false; }
  }
</script>
<svelte:head><title>{kind === 'intake' ? 'Сдать вещи' : 'Вернуть вещи'} · WHM</title></svelte:head>
<div class:dark={initialTheme === 'halloween'} class="live-page">
  <header><button type="button" onclick={onBack} aria-label="Назад"><ArrowLeft /></button><strong>Клиентский интерфейс</strong></header>
  <main class="live-shell"><span class="eyebrow">МОИ ВЕЩИ / {kind === 'intake' ? 'СДАЧА' : 'ВОЗВРАТ'}</span><h1>{kind === 'intake' ? 'Сдать вещи на хранение' : 'Вернуть вещи'}</h1>
    <div class="steps">{#each steps as label, i}<span>{#if i === step}<strong>{i+1}. {label}</strong>{:else}{i+1}. {label}{/if}</span>{/each}</div>
    {#if step === 0}
      <section class="card"><h2>{kind === 'intake' ? 'Что будем хранить?' : 'Что возвращаем?'}</h2>
        {#if kind === 'intake'}
          <p class="muted">Каталог и цены загружены с сервера. Сейчас это тестовые тарифы.</p>
          <div class="grid">{#each tariffs as tariff}<div class="card" style="margin:0"><h3>{#if tariff.itemType === 'box'}<Box size={20} />{:else}<Package size={20} />{/if} {tariff.title}</h3><p>{money(tariff.monthlyPrice)} / месяц</p><label>Количество<input type="number" min="0" max="20" step="1" bind:value={quantities[tariff.id]} /></label>{#if quantities[tariff.id] > 0}<label>Что внутри / описание<textarea maxlength="500" bind:value={descriptions[tariff.id]}></textarea></label>{/if}</div>{:else}<p class="muted">Сотрудник ещё не добавил доступные тарифы.</p>{/each}</div>
        {:else}
          {#each units.filter(u => u.status !== 'returned') as unit}<label class:selected={chosen.includes(unit.id)} class="choice"><input type="checkbox" checked={chosen.includes(unit.id)} disabled={unit.status !== 'stored'} onchange={() => toggle(unit.id)} /><Box size={24} /><span><strong>{unit.title}</strong><br /><small>{unit.description} · {unit.internalID}</small><br /><small>{unit.statusLabel}</small></span><strong>{money(unit.monthlyPrice)}/мес.</strong></label>{:else}<p class="empty">Вещей на хранении пока нет.</p>{/each}
        {/if}
      </section>
    {:else if step === 1}
      <section class="card"><h2>Как передать вещи?</h2><div class="grid"><label class:selected={fulfillment === 'pickup'} class="choice"><input type="radio" name="fulfillment" value="pickup" bind:group={fulfillment} /><Package size={24} /><span>Самостоятельно</span></label><label class:selected={fulfillment === 'courier'} class="choice"><input type="radio" name="fulfillment" value="courier" bind:group={fulfillment} /><Truck size={24} /><span>Курьером</span></label></div>
        {#if fulfillment === 'courier'}<label>Адрес передачи<textarea maxlength="500" bind:value={address}></textarea></label>{:else}{#each warehouses as warehouse}<p>{warehouse.name}<br /><span class="muted">{warehouse.address}</span></p>{/each}{/if}
        <label>Желаемые дата и время<input maxlength="150" placeholder="Например: 12 октября, с 14 до 18" bind:value={slot} /></label><p class="muted">Это пожелание. Сотрудник подтвердит передачу отдельно. Реальные доставки и оплата доставки пока не подключены.</p>
      </section>
    {:else}
      <section class="card"><h2>Проверьте заявку</h2>{#if kind === 'intake'}{#each lines as line}<div class="row"><span>{tariffs.find(t => t.id === line.tariffID).title} × {line.quantity}<br /><small>{line.description}</small></span><strong>{money(tariffs.find(t => t.id === line.tariffID).monthlyPrice * line.quantity)}</strong></div>{/each}{:else}{#each selectedUnits as unit}<div class="row"><span>{unit.title} · {unit.internalID}</span><Check size={18} /></div>{/each}{/if}
        <p><strong>{fulfillment === 'pickup' ? 'Самостоятельная передача' : 'Курьер'}</strong><br />{address}<br />{slot || 'Время нужно согласовать'}</p>
        {#if kind === 'intake'}<div class="row"><strong>Тестовый платёж за первый месяц</strong><strong>{money(total)}</strong></div><p class="muted">После создания заявки откроется симулятор оплаты. Деньги не списываются. Юридические и коммерческие правила ещё не утверждены.</p>{:else}<p class="muted">После подтверждения вещи будут зарезервированы для возврата. Они останутся на складе до выдачи с фото и подписью.</p>{/if}
      </section>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">{#if step > 0}<button class="secondary" type="button" disabled={busy} onclick={() => { step -= 1; error = ''; }}>Назад</button>{/if}{#if step < 2}<button class="primary" type="button" onclick={next}>Продолжить <ArrowRight size={16} /></button>{:else}<button class="primary" type="button" disabled={busy} onclick={submit}>{busy ? 'Сохраняем…' : kind === 'intake' ? 'Создать заявку и перейти к оплате' : 'Оформить возврат'}</button>{/if}</div>
  </main>
</div>
