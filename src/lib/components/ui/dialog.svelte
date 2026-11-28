<script>
  import { Dialog } from 'bits-ui';
  let { onDismiss, children } = $props();
  const trigger = document.activeElement;

  function dismiss(event) {
    event.preventDefault();
    onDismiss();
  }

  function restoreFocus(event) {
    if (trigger instanceof HTMLElement && trigger.isConnected) {
      event.preventDefault();
      trigger.focus({ preventScroll: true });
    }
  }
</script>

<Dialog.Root open>
  <Dialog.Overlay class="whm-dialog-layer">
    <Dialog.Content onEscapeKeydown={dismiss} onInteractOutside={dismiss} onCloseAutoFocus={restoreFocus}>
      {#snippet child({ props })}{@render children(props)}{/snippet}
    </Dialog.Content>
  </Dialog.Overlay>
</Dialog.Root>

<style>
  :global(.whm-dialog-layer) {
    position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
    padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
    background: rgb(18 17 14 / 55%); overscroll-behavior: contain;
  }
  :global(.whm-dialog-layer > [data-dialog-content]) {
    position: relative; inset: auto; margin: 0; transform: none;
    max-width: 100%; max-height: calc(100dvh - 32px); overflow: auto; overscroll-behavior: contain;
    background-color: var(--ui-card); color: var(--ui-foreground); border: 1px solid var(--ui-line);
    box-shadow: 0 18px 60px rgb(0 0 0 / 18%);
  }
  @media (max-width: 600px) {
    :global(.whm-dialog-layer:has(.filter-sheet)) { align-items: end; padding: 0; }
  }
</style>
