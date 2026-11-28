<script>
  import { ChevronLeft } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  let { onBack = () => {}, label = 'Назад' } = $props();
</script>

<Button class="navigation-back" variant="outline" size="icon" onclick={onBack} aria-label={label}>
  <ChevronLeft size={20} aria-hidden="true" />
</Button>
