<script>
  import { MapPin, Search } from '@lucide/svelte';

  let { id, value = '', catalog = [], suggest, onChange, onSelect, invalid = false, describedBy } = $props();
  let query = $state('');
  let addresses = $state([]);
  let status = $state('');
  let current = $state(-1);
  let listId = $derived(id + '-options');
  let expanded = $derived(addresses.length > 0);

  $effect(() => {
    const input = query.trim();
    const load = suggest;
    if (input.length < 3 || query !== value) return;
    if (!load) {
      addresses = catalog.map(item => item.value)
        .filter(address => address.toLocaleLowerCase('ru-RU').includes(input.toLocaleLowerCase('ru-RU')))
        .slice(0, 7);
      return;
    }

    const request = new AbortController();
    const timer = setTimeout(async () => {
      try {
        status = 'Ищем адрес…';
        const results = await load(input, request.signal);
        if (request.signal.aborted) return;
        addresses = results;
        status = results.length ? '' : 'Адрес не найден. Можно ввести его вручную.';
      } catch {
        if (!request.signal.aborted) status = 'Подсказки пока недоступны. Можно ввести адрес вручную.';
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  });

  function close() {
    query = '';
    addresses = [];
    status = '';
    current = -1;
  }

  function change(event) {
    close();
    query = event.currentTarget.value;
    onChange(query);
  }

  function choose(address) {
    close();
    (onSelect ?? onChange)(address);
  }

  function onKeydown(event) {
    if (event.isComposing) return;
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (expanded && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      current = event.key === 'ArrowDown'
        ? (current + 1) % addresses.length
        : (current <= 0 ? addresses.length - 1 : current - 1);
      document.getElementById(listId + '-' + current)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && expanded && current !== -1) {
      event.preventDefault();
      choose(addresses[current]);
    }
  }
</script>

<div class="address-input">
  <div class="address-control field-group" class:invalid>
    <Search size={18} aria-hidden="true" />
    <input
      {id} {value}
      name="address"
      type="text"
      role="combobox"
      autocomplete="off"
      maxlength="500"
      placeholder="Город, улица, дом…"
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded && current !== -1 ? listId + '-' + current : undefined}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      oninput={change}
      onkeydown={onKeydown}
      onblur={close}
    />
  </div>
  {#if expanded}
    <div id={listId} class="address-options" role="listbox" aria-label="Подсказки адресов">
      {#each addresses as address, index (address)}
        <button type="button" role="option" tabindex="-1" id={listId + '-' + index}
          aria-selected={current === index} onmousedown={(event) => event.preventDefault()}
          onclick={() => choose(address)}>
          <MapPin size={16} aria-hidden="true" />
          <span>{address}</span>
        </button>
      {/each}
    </div>
  {/if}
  <span class="address-status" role="status">{status}</span>
</div>

<style>
  .address-input { min-width: 0; }
  .address-control {
    display: flex; align-items: center; gap: .55rem; padding-inline: .8rem;
    border: 1px solid var(--ui-line); border-radius: .5rem; background: var(--ui-card);
  }
  .address-control.invalid { border-color: var(--ui-danger); }
  .address-control :global(svg), .address-options :global(svg) { flex: none; color: var(--ui-muted-foreground); }
  .address-control input {
    width: 100%; min-width: 0; min-height: 3rem; padding: .5rem 0;
    border: 0; border-radius: 0; background: transparent; color: var(--ui-foreground);
  }
  .address-control input::placeholder { color: var(--ui-muted-foreground); }
  .address-options {
    max-height: 13rem; overflow: auto; overscroll-behavior: contain; margin-block-start: .45rem;
    border: 1px solid var(--ui-line); border-radius: .5rem; background: var(--ui-card);
  }
  .address-options button {
    display: flex; align-items: center; gap: .65rem; width: 100%; min-height: 44px;
    padding: .55rem .8rem; border: 0; background: transparent; color: var(--ui-foreground);
    text-align: start; overflow-wrap: anywhere;
  }
  .address-options button + button { border-top: 1px solid var(--ui-line); }
  .address-options button:hover, .address-options [aria-selected="true"] { background: var(--ui-muted); }
  .address-status { display: block; color: var(--ui-muted-foreground); font-size: .8rem; }
  .address-status:not(:empty) { margin-block-start: .35rem; }
</style>
