<script>
  let { as = 'div', children, ...props } = $props();
</script>

<svelte:element this={as} data-slot="card" {...props}>{@render children?.()}</svelte:element>
