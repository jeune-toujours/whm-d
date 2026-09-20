<script>
  import { ArrowLeft, Check, Copy, ExternalLink, Camera, Image, Video } from '@lucide/svelte';
  import { formatMoney } from '../demo.js';

  let { item, initialTheme = 'bumblebee', onBack = () => {}, onReturn = () => {}, onSupport = () => {}, onOpenDocument = () => {} } = $props();
  let copied = $state(false);
  let dark = $derived(initialTheme === 'halloween');
  let archived = $derived(Boolean(item?.archived || item?.currentStatus === 'returned'));
  let canReturn = $derived(!archived && item?.status === 'stored' && !item?.lockReason);
  let contents = $derived(item?.contents?.length ? item.contents : item?.description ? item.description.split(',').map(value => value.trim()) : []);

  async function copyId() {
    try { await navigator.clipboard.writeText(item.id); copied = true; setTimeout(() => copied = false, 2000); } catch { copied = false; }
  }
</script>

<svelte:head><title>{item?.title || 'Вещь'} · Клиентский интерфейс</title></svelte:head>

<div class:dark class="detail-page">
  <header class="header">
    <button class="back" type="button" onclick={onBack} aria-label="Назад"><ArrowLeft aria-hidden="true" /></button>
    <div class="brand"><strong>Клиентский интерфейс</strong></div>
    <button class="header-link" type="button" onclick={() => onSupport({ orderId: item?.sourceOrderId, unitId: item?.id })}>Помощь</button>
  </header>

  <main class="shell">
    <div class="eyebrow">Мои вещи <span>/</span> {item?.id}</div>
    <div class="title-row">
      <div><h1>{item?.title || 'Вещь на хранении'}</h1><p>{item?.description || 'Подробная информация о единице хранения'}</p></div>
      <span class:archive={archived} class="status">{archived ? 'Возвращена' : item?.status === 'return-requested' ? 'Готовится к возврату' : 'На хранении'}</span>
    </div>

    <div class="columns">
      <div class="main-column">
        <section class="visual-card" aria-label="Плейсхолдер фотографии вещи">
          <Image aria-hidden="true" />
          <span class="placeholder-title">Место для фотографии</span>
          <span class="visual-label">Фотография появится после подключения складского контура</span>
        </section>

        <section class="card">
          <div class="section-title"><h2>Что внутри</h2><span>{contents.length} позиции</span></div>
          {#if contents.length}
            <ul class="contents">{#each contents as content}<li><span class="check"><Check size={14} aria-hidden="true" /></span>{content}</li>{/each}</ul>
          {:else}<p class="muted">Опись пока не добавлена. После приёмки она появится здесь.</p>{/if}
          <p class="note">Опись в этом прототипе демонстрационная и не является актом приёмки.</p>
        </section>

        <section class="card">
          <div class="section-title"><h2>Материалы приёмки</h2></div>
          <div class="media-list"><div><Camera aria-hidden="true" /><strong>Фотографии</strong><small>Появятся после фотофиксации</small></div><div><Video aria-hidden="true" /><strong>Видео</strong><small>Появится, если запись была сделана</small></div></div>
        </section>

        <section class="card">
          <div class="section-title"><h2>Путь вещи</h2></div>
          <ol class="timeline">
            <li><span class="dot"></span><div><strong>Принята на хранение</strong><small>{item?.storedSinceLabel || item?.storedSince || 'Дата уточняется'}</small></div></li>
            <li><span class="dot"></span><div><strong>{archived ? 'Возвращена владельцу' : 'На охраняемом складе'}</strong><small>{archived ? item?.returnedAt || 'Возврат завершён' : 'Доступна для оформления возврата'}</small></div></li>
          </ol>
        </section>
      </div>

      <aside class="side-column">
        <section class="card summary">
          <div class="section-title"><h2>Информация</h2></div>
          <dl>
            <div><dt>Номер вещи</dt><dd><button class="copy" type="button" onclick={copyId}>{item?.id} {#if copied}<Check size={14} aria-hidden="true" />{:else}<Copy size={14} aria-hidden="true" />{/if}</button></dd></div>
            <div><dt>Тип</dt><dd>{item?.type === 'box' ? 'Коробка' : 'Отдельный предмет'}</dd></div>
            <div><dt>Габариты</dt><dd>{item?.size || 'Уточняются'}</dd></div>
            <div><dt>Пломба</dt><dd>{item?.seal || 'Уточняется'}</dd></div>
            <div><dt>На хранении с</dt><dd>{item?.storedSinceLabel || item?.storedSince || '—'}</dd></div>
          </dl>
          <div class="price"><span>Стоимость хранения</span><strong>{formatMoney(item?.monthlyPrice)}<small>/мес.</small></strong></div>
          {#if item?.lockReason}<p class="warning">{item.lockReason}</p>{/if}
          {#if canReturn}<button class="primary" type="button" onclick={() => onReturn(item)}>Вернуть эту вещь <ExternalLink size={16} aria-hidden="true" /></button>{/if}
          {#if archived}<p class="note">Эта единица уже возвращена и доступна только для просмотра истории.</p>{/if}
        </section>
        <button class="secondary" type="button" onclick={() => onSupport({ orderId: item?.sourceOrderId, unitId: item?.id })}>Сообщить о проблеме</button>
        <button class="text-link" type="button" onclick={() => onOpenDocument(item)}>Документы по вещи <ExternalLink size={16} aria-hidden="true" /></button>
      </aside>
    </div>
  </main>
</div>

<style>
  .detail-page{--bg:#fff;--surface:#fff;--soft:#f8f8f6;--line:#e8e8e5;--ink:#22221f;--muted:#777873;--yellow:#f5c844;min-height:100dvh;background:var(--bg);color:var(--ink);font:16px/1.5 'Open Sans',sans-serif}
  .detail-page.dark{--bg:#24231f;--surface:#292824;--soft:#313029;--line:#47453d;--ink:#f3f0e8;--muted:#b2afa5;--yellow:#e6aa35}
  .header{height:76px;max-width:1160px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:16px}.back{width:42px;height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:24px}.brand{display:flex;align-items:center;gap:8px;font-size:19px;letter-spacing:.1em}.header-link{margin-left:auto;border:0;background:transparent;color:var(--ink);font-weight:700}
  .shell{max-width:1112px;margin:30px auto 70px;padding:0 24px}.eyebrow{color:var(--muted);font-size:13px}.eyebrow span{padding:0 8px}.title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:14px 0 28px}.title-row h1{font-size:clamp(30px,4vw,46px);line-height:1.15;letter-spacing:-.04em;margin:0}.title-row p{margin:10px 0 0;color:var(--muted)}.status{flex:0 0 auto;padding:8px 14px;border-radius:100px;background:#e7f5e8;color:#236532;font-size:12px;font-weight:800}.status.archive{background:var(--soft);color:var(--muted)}
  .columns{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr);gap:24px}.main-column,.side-column{display:grid;align-content:start;gap:20px}.visual-card{height:330px;position:relative;display:grid;place-items:center;align-content:center;gap:12px;overflow:hidden;border-radius:20px;background:var(--soft);border:1px dashed var(--line);color:var(--muted)}.visual-card>:global(svg){width:42px;height:42px}.placeholder-title{font-size:15px;font-weight:700}.visual-label{position:absolute;bottom:17px;left:20px;color:var(--muted);font-size:11px}
  .card{padding:24px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-title h2{margin:0;font-size:19px}.section-title span,.muted,.note{color:var(--muted);font-size:13px}.contents{list-style:none;margin:20px 0;padding:0;display:grid;gap:13px}.contents li{display:flex;align-items:center;gap:11px}.check{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#ffedaa;font-weight:800;font-size:14px;color:#4a3c0b}.note{margin:16px 0 0}.timeline{list-style:none;margin:20px 0 0;padding:0}.timeline li{display:flex;gap:16px;position:relative;padding-bottom:23px}.timeline li:last-child{padding-bottom:0}.timeline li:not(:last-child):before{content:'';position:absolute;left:8px;top:20px;bottom:1px;width:2px;background:var(--line)}.dot{width:18px;height:18px;flex:0 0 18px;border:5px solid var(--yellow);border-radius:50%}.timeline strong,.timeline small{display:block}.timeline small{color:var(--muted);margin-top:3px}
  .media-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:17px}.media-list>div{border:1px dashed var(--line);background:var(--soft);border-radius:10px;padding:16px;display:grid;gap:4px}.media-list :global(svg){width:20px;height:20px;color:var(--muted)}.media-list strong{font-size:13px}.media-list small{font-size:11px;color:var(--muted)}
  dl{margin:20px 0 0}dl>div{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}dt{color:var(--muted)}dd{margin:0;text-align:right;font-weight:700}.copy{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:none;color:var(--ink);font-weight:700}.price{display:flex;justify-content:space-between;align-items:end;gap:8px;margin:22px 0}.price span{font-size:13px;color:var(--muted)}.price strong{font-size:23px;white-space:nowrap}.price small{font-size:12px;font-weight:500;color:var(--muted)}.primary,.secondary{width:100%;min-height:52px;border-radius:10px;font-weight:800}.primary{display:flex;align-items:center;justify-content:space-between;padding:0 18px;border:0;background:var(--yellow);color:#171717}.secondary{border:1px solid var(--line);background:var(--surface);color:var(--ink)}.text-link{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--ink);font-weight:700;text-align:left;padding:4px 0}.warning{padding:12px;border-radius:9px;background:#fff1d4;color:#7b4b00;font-size:13px}
  @media(max-width:760px){.header{height:66px;padding:0 16px}.shell{margin:18px auto 45px;padding:0 16px}.title-row{display:block}.title-row .status{display:inline-block;margin-top:15px}.columns{grid-template-columns:1fr}.side-column{grid-row:1}.visual-card{height:250px}.summary{order:2}.media-list{grid-template-columns:1fr}}
</style>
