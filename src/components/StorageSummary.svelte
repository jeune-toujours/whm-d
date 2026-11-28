<script>
  import { ArrowUpRight, RefreshCw } from '@lucide/svelte';
  import Card from '$lib/components/ui/card.svelte';
  import { Button } from '$lib/components/ui/button/index.js';

  let { amount, count, nextChargeDate, refreshing, onRefresh, onOpenHistory } = $props();
  const plurals = new Intl.PluralRules('ru');
  let unit = $derived(({ one: 'вещь', few: 'вещи', many: 'вещей' })[plurals.select(count)] ?? 'вещей');
</script>

<Card as="section" class="storage-summary" aria-label="Хранение сейчас">
  <div class="balance">
    <span class="label">Хранение сейчас</span>
    <strong>{amount}<small> / мес.</small></strong>
    <div class="storage-meta">
      <span>{count} {unit} на хранении</span>
      <span class="meta-separator" aria-hidden="true">·</span>
      <span>{nextChargeDate ? `Следующее списание ${nextChargeDate}` : 'Дата списания пока не назначена'}</span>
    </div>
  </div>
  <div class="billing">
    <Button variant="outline" size="sm" onclick={onOpenHistory}>История заказов <ArrowUpRight size={15} aria-hidden="true" /></Button>
  </div>
  <Button class="summary-refresh" size="icon" variant="outline" aria-label="Обновить" disabled={refreshing} onclick={onRefresh}>
    <RefreshCw size={17} aria-hidden="true" />
  </Button>
</Card>

<style>
  :global(.storage-summary[data-slot="card"]) {
    position: relative; display: flex; align-items: end; justify-content: space-between;
    gap: 1.5rem; margin-block: 1.25rem 1rem; padding: clamp(1.25rem, 3vw, 2rem);
    background: #282720 url('/honeycomb.svg') no-repeat right top;
    border-color: #423e32; color: #f7f5eb;
  }
  .balance, .billing { display: grid; gap: .5rem; }
  .balance > span, .storage-meta { font-size: .82rem; color: #dad7c9; }
  .balance .label { font-weight: 650; color: #f4d56b; }
  .balance strong { font-size: clamp(2rem,4vw,3.2rem); letter-spacing: -.05em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  small { font-size: .95rem; font-weight: 500; letter-spacing: 0; color: #dad7c9; }
  .storage-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: .25rem .5rem; }
  .billing { flex-shrink: 0; justify-items: end; }
  :global(.storage-summary .summary-refresh) { position: absolute; inset: .65rem .65rem auto auto; background: #35342c; color: #eeeadd; border-color: #555245; }
  :global(.storage-summary .summary-refresh:hover) { background: #444238; }
  @media (max-width: 600px) {
    :global(.storage-summary[data-slot="card"]) { flex-direction: column; align-items: stretch; gap: 1rem; }
    .storage-meta { display: grid; }
    .meta-separator { display: none; }
    .billing { border-top: 1px solid #504d43; padding-top: .85rem; justify-items: start; }
  }
</style>
