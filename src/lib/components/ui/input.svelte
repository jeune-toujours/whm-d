<script>
  import { cn } from '$lib/utils.js';
  let { class: className, ref = $bindable(null), value = $bindable(''), type = 'text', ...props } = $props();
</script>

<input bind:this={ref} data-slot="input" class={cn('w-full min-w-0 min-h-11 rounded-lg border border-solid border-border bg-card px-3 py-2 text-foreground shadow-xs disabled:opacity-50', className)} {type} bind:value {...props} />
