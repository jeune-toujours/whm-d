<script>
  import { ChevronLeft } from '@lucide/svelte';
  let { onBack = () => {}, label = 'Назад' } = $props();
</script>

<button class="navigation-back" type="button" onclick={onBack} aria-label={label}>
  <ChevronLeft aria-hidden="true" />
</button>

<style>
  .navigation-back {
    display: grid;
    place-items: center;
    flex: 0 0 2.75rem;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 1px solid var(--line, #e5e5e2);
    border-radius: var(--radius-field, 0.5rem);
    background: var(--surface, var(--panel, transparent));
    color: inherit;
  }
  .navigation-back :global(svg) { display: block; width: 1.2rem; height: 1.2rem; stroke-width: 1.7; }
  .navigation-back:hover { border-color: var(--yellow, var(--accent, #b78200)); }
</style>
