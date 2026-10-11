<script>
  import BackButton from '../components/BackButton.svelte';
  let { title = 'Документ', description = 'Информация пока недоступна в демонстрационном контуре.', initialTheme = 'bumblebee', live = false, onBack = () => {} } = $props();
</script>

<svelte:head><title>{title} · Клиентский интерфейс</title></svelte:head>
<main class:dark={initialTheme === 'halloween'} class="info">
  <header><BackButton {onBack} /><strong class="system-label">Клиентский интерфейс</strong></header>
  <div class="content"><span>{live ? 'ТЕСТОВЫЙ КОНТУР' : 'ДЕМО-КОНТУР'}</span><h1>{title}</h1><p>{description}</p><button class="primary" type="button" onclick={onBack}>Вернуться назад</button></div>
</main>
<style>
  .info { --bg:#fff; --surface:#fff; --line:#e8e8e5; --ink:#22221f; --muted:#777873; --yellow:#f5c844; min-height:100dvh; background:var(--bg); color:var(--ink); font:16px/1.5 'Open Sans',sans-serif; }
  .info.dark { --bg:#24231f; --surface:#292824; --line:#47453d; --ink:#f3f0e8; --muted:#b2afa5; --yellow:#e6aa35; }
  .info header { max-width:800px; margin:auto; min-height:76px; padding:12px 24px; display:flex; align-items:center; gap:16px; }
  .content { max-width:800px; margin:12vh auto; padding:0 24px; }
  .content span { font-size:11px; letter-spacing:.1em; font-weight:800; color:var(--muted); }
  .content h1 { font-size:clamp(32px,5vw,50px); letter-spacing:-.04em; margin:10px 0; overflow-wrap:anywhere; }
  .content p { color:var(--muted); max-width:550px; overflow-wrap:anywhere; }
  .primary { margin-top:22px; padding:15px 22px; border:0; border-radius:10px; background:var(--yellow); color:#171717; font-weight:800; }
  @media(max-width:760px) { .info header { min-height:66px; padding:11px 16px; } .content { padding:0 16px; } }
</style>
