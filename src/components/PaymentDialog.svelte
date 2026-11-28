<script>
  import { Dialog } from 'bits-ui';
  let { children } = $props();
</script>

<Dialog.Root open>
  <Dialog.Portal>
    <Dialog.Overlay class="payment-backdrop" />
    <Dialog.Content class="payment-frame" data-slot="dialog-content"
      escapeKeydownBehavior="ignore" interactOutsideBehavior="ignore">
      <Dialog.Title class="sr-only">Симулятор оплаты</Dialog.Title>
      {@render children()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.payment-backdrop) { position: fixed; inset: 0; z-index: 1000; background: rgb(15 14 12 / 60%); }
  :global(.payment-frame) { position: fixed; z-index: 1001; inset: 50% auto auto 50%; transform: translate(-50%, -50%); width: min(680px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow: auto; overscroll-behavior: contain; border: 1px solid var(--ui-line); border-radius: 1rem; background: var(--ui-card); }
</style>
