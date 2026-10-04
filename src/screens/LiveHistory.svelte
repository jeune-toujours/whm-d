<script>
  import { ArrowLeft, ArrowRight, Package, RotateCcw } from '@lucide/svelte';
  import '../live.css';
  let { orders = [], initialTheme = 'bumblebee', activeOnly = false, onBack, onOpen } = $props();
  let filter = $state(activeOnly ? 'active' : 'all');
  let shown = $derived(orders.filter(o => filter === 'all' || (filter === 'active' ? !['completed','cancelled'].includes(o.backendStatus) : o.backendStatus === filter)));
</script>
<div class:dark={initialTheme === 'halloween'} class="live-page"><header><button onclick={onBack} aria-label="Назад"><ArrowLeft /></button><strong>Клиентский интерфейс</strong></header><main class="live-shell"><span class="eyebrow">МОИ ЗАКАЗЫ</span><h1>{activeOnly ? 'Активные заказы' : 'История заказов'}</h1><div class="actions">{#each [['all','Все'],['active','Активные'],['completed','Завершённые'],['cancelled','Отменённые']] as f}<button class={filter === f[0] ? 'primary' : 'secondary'} onclick={() => filter = f[0]}>{f[1]}</button>{/each}</div>
    <section class="card">{#each shown as order}<div class="row"><div>{#if order.type === 'return'}<RotateCcw size={20} />{:else}<Package size={20} />{/if} <strong>{order.number}</strong><p class="muted">{order.type === 'return' ? 'Возврат' : 'Сдача'} · {new Date(order.createdAt).toLocaleString('ru-RU')} · {order.items.length} вещей</p></div><span class="status">{order.statusLabel}</span><button class="secondary" onclick={() => onOpen(order)}>Открыть <ArrowRight size={16} /></button></div>{:else}<p class="empty">Заказов пока нет.</p>{/each}</section>
  </main></div>
