<script>
  import { ArrowLeft } from '@lucide/svelte';
  let { title = 'Документ', description = 'Информация пока недоступна в демонстрационном контуре.', onBack = () => {} } = $props();
</script>

<svelte:head><title>{title} · Клиентский интерфейс</title></svelte:head>
<main class="info"><header><button type="button" onclick={onBack} aria-label="Назад"><ArrowLeft aria-hidden="true" /></button><strong>Клиентский интерфейс</strong></header><div class="content"><span>ДЕМО-КОНТУР</span><h1>{title}</h1><p>{description}</p><button class="primary" type="button" onclick={onBack}>Вернуться назад</button></div></main>
<style>.info{min-height:100dvh;background:#fff;color:#222;font:16px/1.5 'Open Sans',sans-serif}.info header{max-width:850px;margin:auto;height:75px;padding:0 20px;display:flex;align-items:center;gap:15px}.info header button{width:42px;height:42px;border:1px solid #ddd;border-radius:10px;background:#fff;font-size:23px}.info header strong{display:flex;align-items:center;gap:7px}.content{max-width:800px;margin:12vh auto;padding:0 20px}.content span{font-size:11px;letter-spacing:.1em;font-weight:800;color:#927a29}.content h1{font-size:clamp(32px,5vw,50px);letter-spacing:-.04em;margin:10px 0}.content p{color:#777;max-width:550px}.primary{margin-top:22px;padding:15px 22px;border:0;border-radius:10px;background:#f4c84a;color:#171717;font-weight:800}</style>
