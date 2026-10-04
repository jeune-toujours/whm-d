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
  import InfoScreen from './screens/InfoScreen.svelte';
  import Intake from '../WHM-7-Storage-Intake (1) (2).svelte';
  import ReturnItems from '../WHM-9-Return-Items-16 (2).svelte';
  import History from '../WHM-11-Order-History (1).svelte';
  import { intakeInput, returnInput, operationKey, historyDates } from './order-adapters.js';
  import Checkout from './screens/Checkout.svelte';
  import LiveHistory from './screens/LiveHistory.svelte';
  import { api, safe, download, uploadSupport } from './api.js';
  import './live.css';

  const currentRoute = () => { try { return decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home'; } catch { return 'home'; } };
  let route = $state(currentRoute()), theme = $state('bumblebee'), loading = $state(true), authenticated = $state(false), error = $state('');
  let data = $state({ units:[], orders:[], activeOrders:[], profile:{}, tariffs:[], warehouses:[], tickets:[] });
  let chosen = $state([]), supportContext = $state(null), supportType = $state(null);
  let info = $state({ title:'Информация', description:'', back:'home' });
  let checkoutConfig = $state(null), paymentDialog = $state(null), archivedItem = $state(null), itemBackRoute = $state('home');
  const uploadedFiles = new WeakMap();
  let pendingPhone = '', refreshing = false, planOperation = null;
  let root = $derived(route.split('/')[0]), routeID = $derived(route.split('/')[1] || '');
  let item = $derived(archivedItem?.id === routeID ? archivedItem : data.units.find(u => u.id === routeID));
  let order = $derived(data.orders.find(o => o.id === routeID));
  let plans = $derived(data.tariffs.filter(t => t.kind === 'subscription').map(t => ({ ...t, limit:t.itemLimit, volume:`до ${t.itemLimit} вещей` })));
  let storedCount = $derived(data.units.filter(u => ['stored','reserved','picked'].includes(u.status)).length);
  const legal = 'Это тестовая среда. Юридические документы и коммерческие правила ещё не утверждены. Реальные SMS, платежи и доставки не выполняются.';
  function navigate(path) { location.hash = `/${path}`; route = path; }
  function infoScreen(title, description, back = route) { info = { title, description, back }; navigate('info'); }
  function openSupport(context = null, type = null) { supportContext = context; supportType = type || (context ? 'incident' : null); navigate('support'); }
  function openOrder(o) { const id = typeof o === 'string' ? o : o.id; const value = data.orders.find(o => o.id === id); navigate(`${value && ['completed','cancelled'].includes(value.backendStatus) ? 'history' : 'order'}/${id}`); }
  function openItem(value, back='home') { archivedItem = null; itemBackRoute = back; navigate(`item/${value.id}`); }
  function openReturn(ids = []) { chosen = ids; navigate('return'); }
  function toggleTheme() { theme = theme === 'bumblebee' ? 'halloween' : 'bumblebee'; try { localStorage.setItem('whm-theme', theme); } catch {} }
  async function refresh() {
    if (refreshing) return data;
    refreshing = true;
    try { data = await api('/v1/dashboard'); if (!checkoutConfig) checkoutConfig = (await api('/v1/checkout-config')).config; authenticated = true; error = ''; return data; }
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
  async function quoteWizard(kind, value) { return safe(() => api(kind === 'intake' ? '/v1/intake/quote' : '/v1/returns/quote', kind === 'intake' ? intakeInput(value) : returnInput(value))); }
  async function createWizard(kind, value) {
    return safe(async () => {
      const input = kind === 'intake' ? intakeInput(value) : returnInput(value), key = await operationKey(value.operationKey, input);
      const result = await quoteWizard(kind, value); if (result.ok === false) return result;
      if (value.quoteHash && value.quoteHash !== result.quote.hash) return { ok:false, message:'Стоимость или состав изменились. Вернитесь к проверке заявки.' };
      let order;
      if (result.quote.amount > 0) {
        const checkout = await api('/v1/checkouts', { kind,input,quoteHash:result.quote.hash }, 'POST',key);
        const paid = await new Promise(resolve => { paymentDialog = { id:checkout.payment.id, resolve, status:checkout.payment.status }; });
        if (paid.ok === false) return paid;
        order = (await api(`/v1/orders/${paid.payment.orderID}`)).order;
      } else order = (await api(kind === 'intake' ? '/v1/intake' : '/v1/returns', { ...input,quoteHash:result.quote.hash }, 'POST',key)).order;
      await refresh(); return { ok:true, orderId:order.id, orderNumber:order.number };
    });
  }
  async function finishPayment(payment, leave) {
    if (!paymentDialog) return;
    paymentDialog.status = payment.status;
    if (leave) { const resolve=paymentDialog.resolve; paymentDialog=null; resolve({ ok:true,payment }); }
  }
  async function cancelPayment() {
    if (!paymentDialog) return;
    const value=paymentDialog;
    if (value.status === 'paid') { const r=await api(`/v1/payments/${value.id}`); paymentDialog=null; value.resolve({ ok:true,payment:r.payment }); return; }
    await safe(() => api(`/v1/payments/${value.id}/simulate`,{ result:'failed' })); paymentDialog=null; value.resolve({ ok:false,message:'Оплата отменена. Данные заявки сохранены.' });
  }
  async function loadHistory(params) { const query=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,String(v)])); const r=await api('/v1/history?'+query); return { ...r,orders:r.orders.map(historyDates) }; }
  async function historyDetail(id) { return historyDates((await api(`/v1/history/${id}`)).order); }
  async function payOrder(o) { const r = await safe(() => api('/v1/payments', { orderID:o.id })); if (r.ok === false) error = r.message; else navigate(`checkout/${r.payment.id}`); }
  async function changePlan(id) { return safe(async () => { if (planOperation?.tariffID !== id) planOperation = { tariffID:id, key:crypto.randomUUID() }; const r = await api('/v1/payments', { tariffID:id }, 'POST', planOperation.key); planOperation = null; navigate(`checkout/${r.payment.id}`); return { ok:true }; }); }
  async function pauseSubscription() { return safe(async () => { const r = await api('/v1/subscription/pause', {}); await refresh(); return r; }); }
  async function logout() { const r = await safe(() => api('/auth/logout', {})); if (r.ok === false) error = r.message; else { authenticated = false; data = { units:[], orders:[], activeOrders:[], profile:{}, tariffs:[], warehouses:[], tickets:[] }; navigate('signin'); } }
  async function loadOrder() { const r = await api(`/v1/orders/${routeID}`); data.orders = data.orders.map(o => o.id === r.order.id ? r.order : o); return displayedOrder(r.order); }
  function displayedOrder(value) {
    return { ...value,id:value.number,apiID:value.id };
  }
  function contextOptions() { return [...data.units.map(u=>({unitId:u.id,orderId:`item:${u.id}`,title:u.title,caption:u.internalID})),...data.orders.map(o=>({orderId:o.id,title:o.number,caption:'Заказ'}))]; }
  async function submitTicket(type, payload) { return safe(async () => { const attachments = []; for (const a of payload.attachments || []) { if (a.file) { let id=uploadedFiles.get(a.file); if (!id) { id=await uploadSupport(a.file,type); uploadedFiles.set(a.file,id); } attachments.push(id); } } const { operationKey:key, ...fields }=payload; const r = await api('/v1/support', { ...fields,attachments,type,appVersion:import.meta.env.VITE_SOURCE_COMMIT || 'staging',platform:navigator.userAgent },'POST',await operationKey(key || crypto.randomUUID(),{...fields,attachments,type})); await refresh(); return r; }); }
</script>

<div class:dark={theme === 'halloween'} class="live-banner" role="region" aria-label="Тестовая среда"><span>Тестовый контур · SMS, оплата и логистика симулируются</span></div>
{#if paymentDialog}<div class="payment-overlay" role="presentation"><div class="payment-frame" role="dialog" aria-modal="true" aria-label="Симулятор оплаты" tabindex="-1"><Checkout id={paymentDialog.id} initialTheme={theme} embedded={true} onBack={cancelPayment} onComplete={finishPayment}/></div></div>{/if}
{#if error}<div class="connection-error" role="alert">{error}<button onclick={() => void safe(refresh)}>Повторить</button></div>{/if}
{#if loading}<div class:dark={theme === 'halloween'} class="live-page"><main class="live-shell"><p role="status">Подключаемся к WHM…</p></main></div>
{:else}
  {#key root === 'history' ? 'history' : route}
    {#if root === 'info'}<InfoScreen title={info.title} description={info.description} onBack={() => navigate(info.back)} />
    {:else if !authenticated || root === 'signin'}<Auth initialTheme={theme} otpLength={6} simulation={true} onCheckSession={() => ({ active:authenticated, biometricEnabled:false })} onRequestOtp={phone => safe(() => api('/auth/request-otp', { phone }))} onVerifyOtp={verified} onSaveProfile={saveProfile} onComplete={authComplete} onOpenTerms={() => infoScreen('Публичная оферта', legal, 'signin')} onOpenPrivacy={() => infoScreen('Политика конфиденциальности', legal, 'signin')} />
    {:else if root === 'home'}<Home initialTheme={theme} userName={data.profile.firstName} liveDashboard={{ units:data.homeUnits || [], monthlyPrice:data.profile.monthlyPrice, activeOrders:data.activeOrders.map(o => ({ ...o,stage:o.statusLabel,nextEventLabel:o.visitWindow || 'Открыть детали' })),nextChargeDate:data.profile.nextChargeDate }} onLoadDashboard={() => ({ units:data.homeUnits || [],monthlyPrice:data.profile.monthlyPrice,activeOrders:data.activeOrders,nextChargeDate:data.profile.nextChargeDate })} onOpenItem={u => openItem(u)} onGoToHandover={() => navigate('intake')} onGoToReturn={() => openReturn()} onQuickReturn={u => openReturn([u.id])} onOpenActiveOrder={openOrder} onOpenActiveOrdersList={() => navigate('orders')} onOpenHistory={() => navigate('history')} onOpenProfile={() => navigate('profile')} onOpenSupport={() => openSupport()} />
    {:else if root === 'intake' && checkoutConfig}<Intake live={true} config={checkoutConfig} catalog={data.tariffs.filter(t=>t.kind==='storage')} initialTheme={theme} insuranceRate={checkoutConfig.insuranceRate} insuranceMinPremium={checkoutConfig.insuranceMinPremium} customerName={data.profile.firstName} savedAddress="" savedPhone={data.profile.phone} draftKey={`whm-intake:${data.userID}`} demoMode={false} startAtService={true} onCalculateOrder={v=>quoteWizard('intake',v)} onCreateOrder={v=>createWizard('intake',v)} onNavigateOrder={v=>openOrder(v.orderId)} onNavigateHome={()=>navigate('home')} onOversizeRequest={v=>submitTicket('incident',{ operationKey:crypto.randomUUID(),description:'Индивидуальный расчёт негабарита: '+v.description,attachments:v.file?[{file:v.file}]:[] })} onOpenTerms={()=>infoScreen('Условия хранения',legal,'intake')}/>
    {:else if root === 'return' && checkoutConfig}<ReturnItems live={true} config={checkoutConfig} storageUnits={data.units.filter(u=>['stored','reserved','picked'].includes(u.status))} initialSelectedIds={chosen} initialTheme={theme} savedAddress="" savedPhone={data.profile.phone} currentMonthlyPrice={data.profile.monthlyPrice} draftKey={`whm-return:${data.userID}`} onCalculateReturn={async v=>{const r=await quoteWizard('return',v);return r.ok===false?r:{...r,deliveryPrice:r.quote.deliveryPrice};}} onCreateReturn={v=>createWizard('return',v)} onSupport={openSupport} onNavigateToOrder={v=>openOrder(v.orderId)} onNavigateHome={()=>navigate('home')} onExit={()=>navigate('home')}/>
    {:else if root === 'checkout'}<Checkout id={routeID} initialTheme={theme} onBack={() => navigate('payments')} onComplete={async (payment, leave) => { await safe(refresh); if (leave) navigate(payment.orderID ? `order/${payment.orderID}` : 'subscription'); }} />
    {:else if root === 'item'}{#if item}<ItemDetail {item} initialTheme={theme} live={true} onBack={() => navigate(itemBackRoute)} onReturn={u => openReturn([u.id])} onSupport={openSupport} onOpenDocument={() => infoScreen('Материалы вещи', 'Фото, опись и история доступны в карточке. Юридический шаблон акта ещё не утверждён.')} />{:else}<InfoScreen title="Вещь не найдена" description="Эта вещь недоступна вашему аккаунту." onBack={() => navigate('home')}/>{/if}
    {:else if root === 'order'}{#if order}
      <ActiveOrder live={true} initialTheme={theme} order={displayedOrder(order)} autoRefreshMs={8000} onRefresh={loadOrder} onCancel={() => safe(async () => { const r = await api(`/v1/orders/${order.id}/cancel`, {}); await refresh(); return r; })} onBack={() => navigate('home')} onHome={() => navigate('home')} onItemOpen={u=>openItem(u,`order/${order.id}`)} onOpenHistory={() => navigate('history')} onSupport={() => openSupport({ orderId:order.id }, 'incident')} onContactCourier={() => infoScreen('Курьер', 'Курьер не назначен. Это тестовая логистическая заявка.')} />
    {:else}<InfoScreen title="Заказ недоступен" description="Откройте историю и выберите заказ." onBack={() => navigate('history')} />{/if}
    {:else if root === 'history' || root === 'payments'}<History userInitials={[data.profile.firstName?.[0],data.profile.lastName?.[0]].filter(Boolean).join('') || 'П'} onOpenProfile={()=>navigate('profile')} live={true} activeOrder={data.activeOrders[0] || null} initialTheme={theme} financialView={root === 'payments' || routeID === 'payments'} onLoadPayments={v=>api('/v1/payments?'+new URLSearchParams(v))} onPaymentReceipt={p=>download(`/v1/payments/${p.id}/receipt`)} onPaymentRetry={p=>navigate(`checkout/${p.id}`)} onShowPayments={()=>navigate('history/payments')} onShowOrders={()=>navigate('history')} initialOrderId={root === 'payments' || routeID === 'payments' ? '' : routeID} viewKey={`whm-history:${data.userID}`} onLoadPage={loadHistory} onLoadDetail={historyDetail} onSelectOrder={id=>navigate(id?`history/${id}`:'history')} onBack={()=>navigate(root==='payments'||routeID==='payments'?'profile':'home')} onOpenActiveOrder={openOrder} onOpenItem={(value,context)=>{ archivedItem={...value,status:value.currentStatus,contents:typeof value.contents==='string'?value.contents.split('\n'):value.contents||[],media:data.units.find(i=>i.id===value.id)?.media||[]};itemBackRoute=`history/${context.order.id}`;navigate(`item/${value.id}`); }} onOpenReceipt={o=>download(`/v1/payments/${o.financial.paymentID}/receipt`)} onOpenSupport={openSupport} onOpenRelatedOrder={id=>navigate(`history/${id}`)}/>
    {:else if root === 'orders'}<LiveHistory orders={data.activeOrders} activeOnly={true} initialTheme={theme} onBack={()=>navigate('home')} onOpen={openOrder}/>
    {:else if root === 'support'}<Support initialTheme={theme} initialType={supportType} initialContext={supportContext} live={true} onLoadContextOptions={contextOptions} onSubmitIncident={payload => submitTicket('incident',payload)} onSubmitTechnical={payload => submitTicket('technical',payload)} onLoadTickets={() => data.tickets} onReplyTicket={(id,text,key) => safe(async () => { const r = await api(`/v1/support/${id}/reply`, { text }, 'POST',key); await refresh(); return r; })} liveTickets={data.tickets} onOpenRelatedItem={id=>openItem({id},'support')} onOpenRelatedOrder={ticket => openOrder(ticket.relatedOrderId)} onGoHome={() => navigate('home')} />
    {:else if root === 'profile'}<Profile initialTheme={theme} planOptions={plans} otpLength={6} simulation={true} onLoadProfile={() => ({ ...data.profile,recentPayments:data.profile.recentPayments.slice(0,3) })} onSaveProfile={saveProfile} onRequestPhoneChange={phone => { pendingPhone = phone; return safe(() => api('/v1/profile/phone/request',{phone})); }} onConfirmPhoneChange={code => safe(async () => { const r = await api('/v1/profile/phone/confirm',{phone:pendingPhone,code}); await refresh(); return r; })} onChangePaymentMethod={() => safe(async () => { const r = await api('/v1/payment-method/simulate',{}); await refresh(); return r; })} onChangePlan={changePlan} onPauseSubscription={pauseSubscription} onOpenSubscription={() => navigate('subscription')} onOpenAllPayments={() => navigate('history/payments')} onOpenReceipt={p => download(`/v1/payments/${p.id}/receipt`)} onOpenSupport={() => openSupport()} onOpenTerms={() => infoScreen('Публичная оферта',legal)} onOpenPrivacy={() => infoScreen('Политика конфиденциальности',legal)} onGoToReturn={() => openReturn()} onGoBack={() => navigate('home')} onLogout={logout} onDeleteAccount={() => safe(async () => { const r = await api('/v1/profile/deactivate',{}); await logout(); return r; })} />
    {:else if root === 'subscription'}<Subscription profile={data.profile} {plans} simulation={true} unitCount={storedCount} hasActiveOrder={data.activeOrders.length > 0} initialTheme={theme} onBack={() => navigate('profile')} onChangePlan={changePlan} onPause={pauseSubscription} onReturn={() => openReturn()} onOpenPayments={() => navigate('history/payments')} />
    {:else}<InfoScreen title="Экран не найден" description="Вернитесь на главную страницу." onBack={() => navigate('home')} />{/if}
  {/key}
{/if}
<style>
  .live-banner { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:10px 24px; background:#f2e7ad; color:#383424; font:11px 'Open Sans',sans-serif; }
  .live-banner.dark { background:#343024; color:#e9e3cb; }
  .connection-error { display:flex; align-items:center; justify-content:center; gap:16px; padding:14px; background:#fff0e8; color:#742f18; font:12px 'Open Sans',sans-serif; }
  .payment-overlay { position:fixed; inset:0; background:#0008; z-index:1000; display:grid; place-items:center; padding:16px; overflow:auto; }
  .payment-overlay .payment-frame { width:min(680px,100%); max-height:calc(100dvh - 32px); overflow:auto; border-radius:24px; }
</style>
