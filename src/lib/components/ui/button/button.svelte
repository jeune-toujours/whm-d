<script>
  import { buttonVariants } from './index.js';
  import { cn } from '$lib/utils.js';
  let { class: className, variant, size, ref = $bindable(null), href, type = 'button', disabled, children, ...props } = $props();
  let classes = $derived(cn('inline-flex items-center justify-center gap-2', buttonVariants({ variant, size }), className));
</script>

{#if href}
  <a bind:this={ref} data-slot="button" class={classes} href={disabled ? undefined : href} aria-disabled={disabled} {...props}>{@render children?.()}</a>
{:else}
  <button bind:this={ref} data-slot="button" class={classes} {type} {disabled} {...props}>{@render children?.()}</button>
{/if}
