<script>
  import { formatMoney } from '../demo.js';
  let { payments = [], initialTheme = 'bumblebee', onBack = () => {}, onReceipt = () => {} } = $props();
  const statusText = { paid: 'Оплачено', refunded: 'Возврат', failed: 'Ошибка' };
</script>

<svelte:head><title>История платежей · WHM</title></svelte:head>
<div class:dark={initialTheme === 'halloween'} class="page">
  <header><button class="back" type="button" onclick={onBack} aria-label="Назад">←</button><div class="brand"><img src="/bee.svg" alt="" /><strong>WHM</strong></div></header>
  <main><span class="eyebrow">ПРОФИЛЬ / ПОДПИСКА</span><h1>История платежей</h1><p class="intro">Начисления за хранение и доступные чеки. В демо-контуре показаны примеры операций.</p>
    <section class="list" aria-label="Платежи">
      {#each payments as payment}
        <div class="row"><div class="icon">₽</div><div class="details"><strong>Хранение вещей</strong><span>{payment.date} · {payment.id}</span></div><div class="amount"><strong>{formatMoney(payment.amount)}</strong><small class:refunded={payment.status === 'refunded'}>{statusText[payment.status] || payment.status}</small></div>{#if payment.hasReceipt}<button type="button" onclick={() => onReceipt(payment)}>Чек ↗</button>{/if}</div>
      {:else}<div class="empty">Платежей пока нет.</div>{/each}
    </section>
    <p class="note">Данные и чеки демонстрационные. Реальные списания здесь не выполняются.</p>
  </main>
</div>
<style>
  .page{min-height:100dvh;background:#fff;color:#22221e;font:16px/1.5 'Open Sans',sans-serif}.page.dark{background:#24231f;color:#f3f0e8}.page header{height:75px;max-width:990px;margin:auto;padding:0 20px;display:flex;align-items:center;gap:15px}.back{width:42px;height:42px;border:1px solid #e5e5e2;border-radius:10px;background:#fff;font-size:24px}.dark .back{background:#302f29;border-color:#48463f;color:#f3f0e8}.brand{display:flex;align-items:center;gap:7px;letter-spacing:.1em}.brand img{width:27px;height:27px}.page main{max-width:950px;margin:35px auto 70px;padding:0 20px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.1em;color:#947721}h1{font-size:clamp(33px,5vw,50px);letter-spacing:-.04em;margin:13px 0 8px}.intro{color:#777;max-width:570px}.dark .intro,.dark .details span,.dark .note{color:#b2afa5}.list{border:1px solid #e7e7e3;border-radius:17px;overflow:hidden;margin-top:28px}.dark .list,.dark .row{border-color:#48463f}.row{display:flex;align-items:center;gap:15px;padding:18px 22px;border-bottom:1px solid #ebebe8}.row:last-child{border-bottom:0}.icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#fff0be;font-weight:800;color:#655221}.details{display:grid;gap:3px;flex:1}.details span{font-size:12px;color:#777}.amount{display:grid;justify-items:end;gap:2px}.amount small{color:#2d7b3d;font-size:11px;font-weight:700}.amount small.refunded{color:#8b6b28}.row button{border:0;background:none;font-size:12px;text-decoration:underline;font-weight:700;color:#222}.dark .row button{color:#f3f0e8}.empty{padding:35px;color:#777}.note{font-size:12px;color:#777;margin-top:20px}@media(max-width:600px){.page main{margin-top:18px}.row{display:grid;grid-template-columns:38px 1fr auto;gap:8px}.row button{grid-column:2/-1;justify-self:start;padding:0}.amount strong{font-size:13px}}
</style>
