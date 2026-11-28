<script>
  import { onMount } from 'svelte';
  import { ChevronDown } from '@lucide/svelte';
  import Card from '$lib/components/ui/card.svelte';
  import { Button } from '$lib/components/ui/button/index.js';

  let { loadQuestions } = $props();
  let questions = $state([]);
  let loading = $state(true);
  let failed = $state(false);
  let active = true;

  onMount(() => {
    void load();
    return () => { active = false; };
  });

  async function load() {
    loading = true;
    failed = false;
    try {
      const result = await loadQuestions();
      if (active) questions = result;
    } catch {
      if (active) failed = true;
    } finally {
      if (active) loading = false;
    }
  }
</script>

<Card as="section" class="faq-panel" aria-labelledby="faq-title">
  <h2 id="faq-title">Частые вопросы</h2>
  {#if loading}
    <p role="status">Загружаем вопросы…</p>
  {:else if failed}
    <p role="alert">Не удалось загрузить вопросы.</p>
    <Button variant="outline" onclick={load}>Повторить загрузку</Button>
  {:else}
    {#each questions as { id, question, answer } (id)}
      <details>
        <summary><span>{question}</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <p>{answer}</p>
      </details>
    {:else}
      <p>Здесь появятся ответы на частые вопросы. Пока можно написать в поддержку.</p>
    {/each}
  {/if}
</Card>

<style>
  :global(.faq-panel[data-slot="card"]) { padding: clamp(1rem, 2.4vw, 1.5rem); min-width: 0; }
  h2 { margin: 0 0 .65rem; font-size: 1.25rem; }
  details { border-block-start: 1px solid var(--ui-line); }
  summary { display: flex; align-items: center; justify-content: space-between; gap: .8rem; min-height: 3rem; padding: .55rem .2rem; cursor: pointer; font-weight: 650; touch-action: manipulation; overflow-wrap: anywhere; }
  summary::-webkit-details-marker { display: none; }
  summary:hover { text-decoration: underline; text-underline-offset: .25em; }
  summary :global(svg) { flex: none; }
  details[open] summary :global(svg) { transform: rotate(180deg); }
  p { margin: .35rem 0 .9rem; color: var(--ui-muted-foreground); white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
