<script>
  import Brand from '$lib/components/Brand.svelte';
  let { current } = $props();
  const pages = [['home', 'Мои вещи'], ['history', 'История заказов'], ['support', 'Помощь'], ['profile', 'Профиль']];
</script>

<footer class="app-footer">
  <div class="footer-inner">
    <a href="#/home" class="footer-brand" aria-label="WHM D — Мои вещи"><Brand /></a>
    <nav aria-label="Навигация в подвале">
      {#each pages as [route, title]}
        <a href={'#/' + (route === 'support' ? 'support/help' : route)} aria-current={current === route ? 'page' : undefined}>{title}</a>
      {/each}
    </nav>
  </div>
</footer>

<style>
  .app-footer { border-block-start: 1px solid var(--ui-line); background: var(--ui-card); color: var(--ui-foreground); }
  .footer-inner {
    width: min(calc(100% - 2 * var(--layout-gutter)), var(--layout-width)); margin: auto;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1.5rem;
    padding-block: 1rem max(1rem, env(safe-area-inset-bottom));
  }
  nav { display: flex; flex-wrap: wrap; gap: .25rem 1rem; }
  a { display: inline-flex; align-items: center; min-height: 44px; color: var(--ui-muted-foreground); font-size: .875rem; text-decoration: none; }
  a:hover, a[aria-current="page"] { color: var(--ui-foreground); text-decoration: underline; text-underline-offset: .25em; }
</style>
