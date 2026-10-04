<script>
  import { onMount } from 'svelte';
  import { ExternalLink, Moon, Sun } from '@lucide/svelte';
  import Auth from '../WHM-3-Avtorizatsiya-i-Onboarding-v3.svelte';
  import Home from '../WHM-4-Moi-veshchi.svelte';
  import ActiveOrder from '../WHM-6-Active-Order (1).svelte';
  import Support from '../WHM-12-Podderzhka-klienta-v4.svelte';
  import Profile from '../WHM-13-Profil-i-Billing-v5.svelte';
  import ItemDetail from './screens/ItemDetail.svelte';
  import Subscription from './screens/Subscription.svelte';
  import Payments from './screens/Payments.svelte';
  import InfoScreen from './screens/InfoScreen.svelte';
  import LiveOrderForm from './screens/LiveOrderForm.svelte';
  import Checkout from './screens/Checkout.svelte';
  import LiveHistory from './screens/LiveHistory.svelte';
  import { api, safe, download, uploadSupport } from './api.js';
  import './live.css';

  const currentRoute = () => { try { return decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home'; } catch { return 'home'; } };
  let route = $state(currentRoute()), theme = $state('bumblebee'), loading = $state(true), authenticated = $state(false), error = $state('');
  let data = $state({ units:[], orders:[], activeOrders:[], profile:{}, tariffs:[], warehouses:[], tickets:[] });
  let chosen = $state([]), supportContext = $state(null), supportType = $state(null);
  let info = $state({ title:'Информация', description:'', back:'home' });
  let pendingPhone = '', refreshing = false, planOperation = null;
  let root = $derived(route.split('/')[0]), routeID = $derived(route.split('/')[1] || '');
  let item = $derived(data.units.find(u => u.id === routeID));
  let order = $derived(data.orders.find(o => o.id === routeID));
  let plans = $derived(data.tariffs.filter(t => t.kind === 'subscription').map(t => ({ ...t, limit:t.itemLimit, volume:`до ${t.itemLimit} вещей` })));
  let storedCount = $derived(data.units.filter(u => ['stored','reserved','picked'].includes(u.status)).length);
  const legal = 'Это тестовая среда. Юридические документы и коммерческие правила ещё не утверждены. Реальные SMS, платежи и доставки не выполняются.';
  function navigate(path) { location.hash = `/${path}`; route = path; }
  function infoScreen(title, description, back = route) { info = { title, description, back }; navigate('info'); }
  function openSupport(context = null, type = null) { supportContext = context; supportType = type || (context ? 'incident' : null); navigate('support'); }
  function openOrder(o) { navigate(`order/${typeof o === 'string' ? o : o.id}`); }
  function openReturn(ids = []) { chosen = ids; navigate('return'); }
  function toggleTheme() { theme = theme === 'bumblebee' ? 'halloween' : 'bumblebee'; try { localStorage.setItem('whm-theme', theme); } catch {} }
  async function refresh() {
    if (refreshing) return data;
    refreshing = true;
    try { data = await api('/v1/dashboard'); authenticated = true; error = ''; return data; }
    catch (e) { if (e.status === 401) { authenticated = false; navigate('signin'); } else error = e.message || 'Нет соединения с сервером.'; throw e; }
    finally { refreshing = false; }
  }
  onMount(() => {
    try { const value = localStorage.getItem('whm-theme'); if (['bumblebee','halloween'].includes(value)) theme = value; } catch {}
    const routeChanged = () => { route = currentRoute(); window.scrollTo({ top:0, behavior:'instant' }); };
    const themeChanged = event => { if (['bumblebee','halloween'].includes(event.detail)) { theme = event.detail; try { localStorage.setItem('whm-theme', theme); } catch {} } };
    window.addEventListener('hashchange', routeChanged); window.addEventListener('whm-theme-change', themeChanged);
    void (async () => { const me = await safe(() => api('/me')); if (me.ok !== false) { authenticated = true; await safe(refresh); if (root === 'signin') navigate('home'); } else if (me.code === 'UNAUTHENTICATED') navigate('signin'); else error = me.message; loading = false; })();
    const timer = setInterval(() => { if (authenticated && !document.hidden) void safe(refresh); }, 8000);
    return () => { clearInterval(timer); window.removeEventListener('hashchange', routeChanged); window.removeEventListener('whm-theme-change', themeChanged); };
  });
  async function saveProfile(payload) { return safe(async () => { const r = await api('/v1/profile', payload, 'PATCH'); await refresh(); return r; }); }
  async function verified(code, phone) { return safe(async () => { const r = await api('/auth/verify-otp', { phone, code }); authenticated = true; await refresh(); return r; }); }
  async function authComplete() { const r = await safe(refresh); if (r.ok !== false) navigate('home'); }
  async function createOrder(kind, payload, key) {
    return safe(async () => { const r = await api(kind === 'intake' ? '/v1/intake' : '/v1/returns', payload, 'POST', key); await refresh();
      if (kind === 'intake') { const payment = await safe(() => api('/v1/payments', { orderID:r.order.id })); if (payment.ok === false) { openOrder(r.order); error = payment.message; } else navigate(`checkout/${payment.payment.id}`); }
      else openOrder(r.order);
      return r;
    });
  }
  async function payOrder(o) { const r = await safe(() => api('/v1/payments', { orderID:o.id })); if (r.ok === false) error = r.message; else navigate(`checkout/${r.payment.id}`); }
  async function changePlan(id) { return safe(async () => { if (planOperation?.tariffID !== id) planOperation = { tariffID:id, key:crypto.randomUUID() }; const r = await api('/v1/payments', { tariffID:id }, 'POST', planOperation.key); planOperation = null; navigate(`checkout/${r.payment.id}`); return { ok:true }; }); }
  async function pauseSubscription() { return safe(async () => { const r = await api('/v1/subscription/pause', {}); await refresh(); return r; }); }
  async function logout() { const r = await safe(() => api('/auth/logout', {})); if (r.ok === false) error = r.message; else { authenticated = false; data = { units:[], orders:[], activeOrders:[], profile:{}, tariffs:[], warehouses:[], tickets:[] }; navigate('signin'); } }
  async function loadOrder() { const r = await api(`/v1/orders/${routeID}`); data.orders = data.orders.map(o => o.id === r.order.id ? r.order : o); return displayedOrder(r.order); }
  function displayedOrder(value) {
    const monthly = data.profile.monthlyPrice || 0, pending = !['completed','cancelled'].includes(value.backendStatus);
    const delta = value.items.reduce((sum, i) => sum + (i.monthlyPrice || 0), 0);
    return { ...value, id:value.number, apiID:value.id, courier:{ name:'Не назначен', vehicle:'', plate:'' }, warehouse:data.warehouses[0]?.name || 'Склад не назначен', warehouseAddress:data.warehouses[0]?.address || '', currentMonthlyStorage:monthly, futureMonthlyStorage:pending ? value.type === 'return' ? Math.max(0, monthly-delta) : monthly+delta : monthly };
  }
  function contextOptions() { return data.units.map(u => ({ unitId:u.id, orderId:data.orders.find(o => o.items.some(i => i.id === u.id))?.id, title:`${u.title} · ${u.description}`, caption:u.internalID })); }
  async function submitTicket(type, payload) { return safe(async () => { const attachments = []; for (const a of payload.attachments || []) { if (a.file) attachments.push(await uploadSupport(a.file)); } const r = await api('/v1/support', { ...payload, attachments, type }); await refresh(); return r; }); }
</script>

<div class:dark={theme === 'halloween'} class="live-banner" role="region" aria-label="Тестовая среда">
  <span><strong>Тестовая среда</strong> · SMS и оплата симулируются{#if !authenticated} · Номер +7 999 000 00 01{/if}</span><div><button onclick={toggleTheme} aria-label="Сменить тему">{#if theme === 'halloween'}<Sun size={16}/>{:else}<Moon size={16}/>{/if}</button>{#if authenticated}<button onclick={() => navigate('home')}>Главная</button>{/if}<a href="/admin" target="_blank" rel="noopener">Админка <ExternalLink size={12}/></a></div>
</div>
{#if error}<div class="connection-error" role="alert">{error}<button onclick={() => void safe(refresh)}>Повторить</button></div>{/if}
{#if loading}<div class:dark={theme === 'halloween'} class="live-page"><main class="live-shell"><p role="status">Подключаемся к WHM…</p></main></div>
{:else}
  {#key route}
    {#if root === 'info'}<InfoScreen title={info.title} description={info.description} onBack={() => navigate(info.back)} />
    {:else if !authenticated || root === 'signin'}<Auth initialTheme={theme} otpLength={6} simulation={true} onCheckSession={() => ({ active:authenticated, biometricEnabled:false })} onRequestOtp={phone => safe(() => api('/auth/request-otp', { phone }))} onVerifyOtp={verified} onSaveProfile={saveProfile} onComplete={authComplete} onOpenTerms={() => infoScreen('Публичная оферта', legal, 'signin')} onOpenPrivacy={() => infoScreen('Политика конфиденциальности', legal, 'signin')} />
    {:else if root === 'home'}<Home initialTheme={theme} userName={data.profile.firstName} onLoadDashboard={() => ({ units:data.units.filter(u => u.status !== 'returned'), activeOrders:data.activeOrders.map(o => ({ ...o, stage:o.status, nextEventLabel:o.statusLabel })), nextChargeDate:data.profile.nextChargeDate })} onOpenItem={u => navigate(`item/${u.id}`)} onGoToHandover={() => navigate('intake')} onGoToReturn={() => openReturn()} onQuickReturn={u => openReturn([u.id])} onOpenActiveOrder={openOrder} onOpenActiveOrdersList={() => navigate('orders')} onOpenHistory={() => navigate('history')} onOpenProfile={() => navigate('profile')} onOpenSupport={() => openSupport()} />
    {:else if root === 'intake' || root === 'return'}<LiveOrderForm kind={root} initialTheme={theme} tariffs={data.tariffs.filter(t => t.kind === 'storage')} units={data.units} warehouses={data.warehouses} selectedIds={chosen} onSubmit={(payload,key) => createOrder(root, payload, key)} onBack={() => navigate('home')} />
    {:else if root === 'checkout'}<Checkout id={routeID} initialTheme={theme} onBack={() => navigate('payments')} onComplete={async (payment, leave) => { await safe(refresh); if (leave) navigate(payment.orderID ? `order/${payment.orderID}` : 'subscription'); }} />
    {:else if root === 'item'}{#if item}<ItemDetail {item} initialTheme={theme} live={true} onBack={() => navigate('home')} onReturn={u => openReturn([u.id])} onSupport={openSupport} onOpenDocument={() => infoScreen('Материалы вещи', 'Фото, опись и история доступны в карточке. Юридический шаблон акта ещё не утверждён.')} />{:else}<InfoScreen title="Вещь не найдена" description="Эта вещь недоступна вашему аккаунту." onBack={() => navigate('home')}/>{/if}
    {:else if root === 'order'}{#if order}
      <div class:dark={theme === 'halloween'} class="live-page order-extra"><div class="live-shell"><p><strong>{order.number}</strong> · {order.statusLabel}</p>{#if order.type === 'storage' && order.backendStatus !== 'cancelled' && order.paymentStatus !== 'paid'}<button class="primary" onclick={() => payOrder(order)}>Перейти к тестовой оплате</button>{/if}</div></div>
      <ActiveOrder initialTheme={theme} order={displayedOrder(order)} autoRefreshMs={8000} onRefresh={loadOrder} onCancel={() => safe(async () => { const r = await api(`/v1/orders/${order.id}/cancel`, {}); await refresh(); return r; })} onBack={() => navigate('home')} onHome={() => navigate('home')} onItemOpen={u => navigate(`item/${u.id}`)} onOpenHistory={() => navigate('history')} onSupport={() => openSupport({ orderId:order.id }, 'incident')} onContactCourier={() => infoScreen('Курьер', 'Курьер не назначен. Это тестовая логистическая заявка.')} />
      <div class:dark={theme === 'halloween'} class="live-page order-extra"><section class="live-shell"><h2>История операций</h2>{#each order.events || [] as event}<div class="row"><strong>{event.label}</strong><span>{new Date(event.at).toLocaleString('ru-RU')}</span>{#if event.note}<small>{event.note}</small>{/if}</div>{/each}<div class="actions"><button class="secondary" onclick={() => download(`/v1/orders/${order.id}/report`)}>Скачать отчёт об операции</button></div></section></div>
    {:else}<InfoScreen title="Заказ недоступен" description="Откройте историю и выберите заказ." onBack={() => navigate('history')} />{/if}
    {:else if root === 'history' || root === 'orders'}<LiveHistory orders={data.orders} activeOnly={root === 'orders'} initialTheme={theme} onBack={() => navigate('home')} onOpen={openOrder} />
    {:else if root === 'support'}<Support initialTheme={theme} initialType={supportType} initialContext={supportContext} live={true} onLoadContextOptions={contextOptions} onSubmitIncident={payload => submitTicket('incident',payload)} onSubmitTechnical={payload => submitTicket('technical',payload)} onLoadTickets={() => data.tickets} onReplyTicket={(id,text) => safe(async () => { const r = await api(`/v1/support/${id}/reply`, { text }); await refresh(); return r; })} liveTickets={data.tickets} onOpenRelatedOrder={ticket => openOrder(ticket.relatedOrderId)} onGoHome={() => navigate('home')} />
    {:else if root === 'profile'}<Profile initialTheme={theme} planOptions={plans} otpLength={6} simulation={true} onLoadProfile={() => data.profile} onSaveProfile={saveProfile} onRequestPhoneChange={phone => { pendingPhone = phone; return safe(() => api('/v1/profile/phone/request',{phone})); }} onConfirmPhoneChange={code => safe(async () => { const r = await api('/v1/profile/phone/confirm',{phone:pendingPhone,code}); await refresh(); return r; })} onChangePaymentMethod={() => safe(async () => { const r = await api('/v1/payment-method/simulate',{}); await refresh(); return r; })} onChangePlan={changePlan} onPauseSubscription={pauseSubscription} onOpenSubscription={() => navigate('subscription')} onOpenAllPayments={() => navigate('payments')} onOpenReceipt={p => download(`/v1/payments/${p.id}/receipt`)} onOpenSupport={() => openSupport()} onOpenTerms={() => infoScreen('Публичная оферта',legal)} onOpenPrivacy={() => infoScreen('Политика конфиденциальности',legal)} onGoToReturn={() => openReturn()} onGoBack={() => navigate('home')} onLogout={logout} onDeleteAccount={() => safe(async () => { const r = await api('/v1/profile/deactivate',{}); await logout(); return r; })} />
    {:else if root === 'subscription'}<Subscription profile={data.profile} {plans} simulation={true} unitCount={storedCount} hasActiveOrder={data.activeOrders.length > 0} initialTheme={theme} onBack={() => navigate('profile')} onChangePlan={changePlan} onPause={pauseSubscription} onReturn={() => openReturn()} onOpenPayments={() => navigate('payments')} />
    {:else if root === 'payments'}<Payments simulation={true} payments={data.profile.recentPayments || []} initialTheme={theme} onBack={() => navigate('profile')} onReceipt={p => download(`/v1/payments/${p.id}/receipt`)} onRetry={p => navigate(`checkout/${p.id}`)} />
    {:else}<InfoScreen title="Экран не найден" description="Вернитесь на главную страницу." onBack={() => navigate('home')} />{/if}
  {/key}
{/if}
<style>
  .live-banner { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:10px 24px; background:#f2e7ad; color:#383424; font:11px 'Open Sans',sans-serif; }
  .live-banner.dark { background:#343024; color:#e9e3cb; }
  .live-banner div { display:flex; align-items:center; gap:12px; }
  .live-banner button,.live-banner a { display:inline-flex; align-items:center; gap:6px; font:inherit; background:none; border:0; color:inherit; cursor:pointer; text-decoration:none; }
  .connection-error { display:flex; align-items:center; justify-content:center; gap:16px; padding:14px; background:#fff0e8; color:#742f18; font:12px 'Open Sans',sans-serif; }
  .order-extra { min-height:0; }
  .order-extra .live-shell { padding-top:20px; padding-bottom:20px; }
</style>
