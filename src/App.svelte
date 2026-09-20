<script>
  import { ExternalLink } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import Auth from '../WHM-3-Avtorizatsiya-i-Onboarding-v3.svelte';
  import Home from '../WHM-4-Moi-veshchi.svelte';
  import ActiveOrder from '../WHM-6-Active-Order (1).svelte';
  import Intake from '../WHM-7-Storage-Intake (1) (2).svelte';
  import ReturnItems from '../WHM-9-Return-Items-16 (2).svelte';
  import History from '../WHM-11-Order-History (1).svelte';
  import Support from '../WHM-12-Podderzhka-klienta-v4.svelte';
  import Profile from '../WHM-13-Profil-i-Billing-v5.svelte';
  import ItemDetail from './screens/ItemDetail.svelte';
  import Subscription from './screens/Subscription.svelte';
  import Payments from './screens/Payments.svelte';
  import Preview from './screens/Preview.svelte';
  import InfoScreen from './screens/InfoScreen.svelte';
  import { createDemo, dashboardFrom, loadDemo, orderFromIntake, orderFromReturn, plans, profileFrom, saveDemo } from './demo.js';

  const validRoots = new Set(['preview', 'signin', 'home', 'item', 'order', 'intake', 'return', 'history', 'support', 'profile', 'subscription', 'payments', 'info']);
  const currentRoute = () => {
    const path = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home';
    return validRoots.has(path.split('/')[0]) ? path : 'home';
  };

  let route = $state(currentRoute());
  let demo = $state(loadDemo());
  let selectedItem = $state(null);
  let itemBackRoute = $state('home');
  let selectedForReturn = $state([]);
  let supportContext = $state(null);
  let supportType = $state(null);
  let infoTitle = $state('Документ');
  let infoDescription = $state('Информация пока недоступна в демонстрационном контуре.');
  let infoBackRoute = $state('home');
  let theme = $state('bumblebee');

  let root = $derived(route.split('/')[0]);
  let routeItemId = $derived(route.startsWith('item/') ? route.split('/')[1] : '');
  let item = $derived(selectedItem?.id === routeItemId ? selectedItem : demo.units.find(unit => unit.id === routeItemId));

  onMount(() => {
    const syncRoute = () => { route = currentRoute(); window.scrollTo({ top: 0, behavior: 'instant' }); };
    const syncTheme = (event) => {
      if (event.detail === 'bumblebee' || event.detail === 'halloween') {
        theme = event.detail;
        try { localStorage.setItem('whm-theme', theme); } catch { /* private mode */ }
      }
    };
    try { const storedTheme = localStorage.getItem('whm-theme'); if (storedTheme === 'bumblebee' || storedTheme === 'halloween') theme = storedTheme; } catch { /* private mode */ }
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('whm-theme-change', syncTheme);
    return () => { window.removeEventListener('hashchange', syncRoute); window.removeEventListener('whm-theme-change', syncTheme); };
  });

  function navigate(path) {
    const destination = path.replace(/^\//, '');
    if (location.hash !== `#/${destination}`) location.hash = `/${destination}`;
    else { route = destination; window.scrollTo({ top: 0, behavior: 'instant' }); }
  }

  function updateDemo(next) { demo = next; saveDemo(next); }
  function openItem(unit, backRoute = 'home') {
    selectedItem = unit;
    itemBackRoute = backRoute;
    navigate(`item/${unit.id}`);
  }
  function openReturn(ids = []) { selectedForReturn = ids; navigate('return'); }
  function openSupport(context = null, type = null) { supportContext = context; supportType = type || (context ? 'incident' : null); navigate('support'); }
  function openInfo(title, description, backRoute = root) { infoTitle = title; infoDescription = description; infoBackRoute = backRoute; navigate('info'); }
  function setScenario(scenario) { updateDemo(createDemo(scenario)); selectedForReturn = []; selectedItem = null; }
  function setOrderStage(stage) {
    if (!demo.activeOrder) return;
    const order = demo.activeOrder;
    const history = order.history.some(entry => entry.status === stage) ? order.history : [...order.history, { status: stage, at: new Date().toISOString() }];
    updateDemo({ ...demo, activeOrder: { ...order, status: stage, history, documentAvailable: stage === 'completed' } });
  }

  function createIntakeOrder(payload) {
    const id = `WHM-S-${String(Date.now()).slice(-6)}`;
    updateDemo({ ...demo, activeOrder: orderFromIntake(id, payload, demo) });
    return { ok: true, orderNumber: id };
  }
  function createReturnOrder(payload) {
    const id = `WHM-R-${String(Date.now()).slice(-6)}`;
    updateDemo({ ...demo, activeOrder: orderFromReturn(id, payload, demo) });
    return { ok: true, orderId: id };
  }
  function cancelOrder() {
    if (demo.activeOrder) updateDemo({ ...demo, activeOrder: { ...demo.activeOrder, status: 'cancelled', cancelReason: 'Отменено клиентом в демо-контуре' } });
    return { ok: true };
  }

  function updateProfile(data) { updateDemo({ ...demo, profile: { ...demo.profile, ...data } }); return { ok: true }; }
  function changePlan(planId) {
    const plan = plans.find(entry => entry.id === planId);
    if (!plan) return { ok: false, message: 'Тариф не найден.' };
    if (demo.units.length > plan.limit) return { ok: false, message: `Сначала верните вещи: лимит тарифа — ${plan.limit}.` };
    updateProfile({ planId, monthlyPrice: plan.price });
    return { ok: true, plan };
  }
  function changePaymentMethod() {
    const paymentMethod = { brand: 'Демо-карта', last4: '1111' };
    updateProfile({ paymentMethod });
    return { ok: true, paymentMethod };
  }
  function pauseSubscription() {
    if (demo.units.length || (demo.activeOrder && !['completed', 'cancelled'].includes(demo.activeOrder.status))) return { ok: false, message: 'Сначала верните вещи и завершите активные заказы.' };
    updateProfile({ paused: true });
    return { ok: true };
  }
  function contextOptions() {
    return demo.units.map(unit => ({ orderId: 'WHM-S-1842', unitId: unit.id, title: `${unit.title} · ${unit.description}`, caption: `Вещь ${unit.id}` }));
  }
  function addTicket(type, payload) {
    const id = `SUP-${String(Date.now()).slice(-6)}`;
    const text = payload.description || 'Новое обращение';
    const ticket = { id, type, shortDescription: text.slice(0, 70), status: 'submitted', updatedAt: 'Только что', relatedOrderId: payload.orderId || null, messages: [{ author: 'client', text, date: 'Только что' }] };
    updateDemo({ ...demo, tickets: [ticket, ...demo.tickets] });
    return { ok: true, ticketId: id, expectedResponse: type === 'incident' ? 'Ответим в течение 2 рабочих дней' : 'Обычно отвечаем в течение 1 рабочего дня' };
  }
  function replyTicket(ticketId, text) {
    updateDemo({ ...demo, tickets: demo.tickets.map(ticket => ticket.id === ticketId ? { ...ticket, messages: [...ticket.messages, { author: 'client', text, date: 'Только что' }], updatedAt: 'Только что' } : ticket) });
    return { ok: true };
  }
</script>

<div class="review-bar" role="region" aria-label="Навигация по демо-контру">
  <span><strong>Клиентский демо-контур</strong><i></i>Без бэкенда</span>
  <div><button type="button" onclick={() => navigate('home')}>Главная</button><button type="button" onclick={() => navigate('preview')}>Все экраны <ExternalLink size={14} aria-hidden="true" /></button></div>
</div>

{#key route}
  {#if root === 'preview'}
    <Preview {demo} onNavigate={navigate} onScenario={setScenario} onStage={setOrderStage} />
  {:else if root === 'signin'}
    <Auth initialTheme={theme} onCheckSession={() => ({ active: false, biometricEnabled: false })} onRequestOtp={() => ({ ok: true })} onVerifyOtp={(code) => code === '0000' ? { ok: false, message: 'Неверный код' } : { ok: true }} onSaveProfile={updateProfile} onOpenTerms={() => openInfo('Публичная оферта', 'Текст оферты ещё не утверждён. В демо-контуре не заключаются договоры и не проводятся платежи.', 'signin')} onOpenPrivacy={() => openInfo('Политика конфиденциальности', 'Текст политики ещё не утверждён. Демо-контур не отправляет введённые данные на сервер.', 'signin')} onComplete={() => navigate('home')} />
  {:else if root === 'home'}
    <Home initialTheme={theme} userName={demo.profile.firstName} onLoadDashboard={() => dashboardFrom(demo)} onOpenItem={(unit) => openItem(unit, 'home')} onGoToHandover={() => navigate('intake')} onGoToReturn={() => openReturn()} onQuickReturn={(unit) => openReturn([unit.id])} onOpenActiveOrder={() => navigate('order')} onOpenActiveOrdersList={() => navigate('order')} onOpenHistory={() => navigate('history')} onOpenProfile={() => navigate('profile')} onOpenSupport={() => openSupport()} />
  {:else if root === 'item'}
    {#if item}<ItemDetail {item} initialTheme={theme} onBack={() => navigate(itemBackRoute)} onReturn={(unit) => openReturn([unit.id])} onSupport={(context) => openSupport(context)} onOpenDocument={() => openInfo('Документы по вещи', 'Акт приёмки и фотофиксация станут доступны после подключения склада и документооборота.', `item/${item.id}`)} />{:else}<InfoScreen title="Вещь не найдена" description="В текущем демо-сценарии нет доступных вещей." onBack={() => navigate('home')} />{/if}
  {:else if root === 'order'}
    {#if demo.activeOrder}<ActiveOrder initialTheme={theme} order={demo.activeOrder} autoRefreshMs={0} onRefresh={() => demo.activeOrder} onCancel={cancelOrder} onContactCourier={() => openInfo('Связь с курьером', 'Контакт курьера появится после назначения исполнителя в реальной системе.', 'order')} onSupport={(context) => openSupport(context, 'incident')} onBack={() => navigate('home')} onHome={() => navigate('home')} onItemOpen={(unit) => openItem(unit, 'order')} onOpenHistory={() => navigate('history')} onDownloadDocument={() => openInfo('Акт по заказу', 'В демо-контуре документ не формируется. После подключения бэкенда здесь появится акт заказа.', 'order')} />{:else}<InfoScreen title="Активных заказов нет" description="Оформите сдачу вещей или возврат, чтобы увидеть отслеживание заказа." onBack={() => navigate('home')} />{/if}
  {:else if root === 'intake'}
    <Intake customerName={demo.profile.firstName} savedPhone={demo.profile.phone} demoMode={true} startAtService={true} onCreateOrder={createIntakeOrder} onNavigateOrder={() => navigate('order')} onNavigateHome={() => navigate('home')} onOpenTerms={(kind) => openInfo(kind === 'storage' ? 'Условия хранения' : 'Публичная оферта', 'Текст документа ещё не утверждён. В демо-контуре согласие не фиксируется и платежи не проводятся.', 'intake')} />
  {:else if root === 'return'}
    <ReturnItems storageUnits={demo.units} initialSelectedIds={selectedForReturn} initialTheme={theme} demoMode={true} onOpenPayment={() => ({ ok: true })} onCreateReturn={createReturnOrder} onNavigateToOrder={() => navigate('order')} onNavigateHome={() => navigate('home')} onExit={() => navigate('home')} />
  {:else if root === 'history'}
    <History initialTheme={theme} activeOrder={demo.activeOrder ? { id: demo.activeOrder.id, number: demo.activeOrder.id, type: demo.activeOrder.type === 'return' ? 'return' : 'intake', statusLabel: demo.activeOrder.status, updatedAt: 'сейчас' } : null} onBack={() => navigate('home')} onOpenActiveOrder={() => navigate('order')} onOpenItem={(unit) => openItem(unit, 'history')} onOpenReceipt={() => openInfo('Чек по заказу', 'Фискальный чек недоступен в демо-контуре. Реальные платежи не проводятся.', 'history')} onOpenDocument={() => openInfo('Документ по заказу', 'Документы появятся после подключения бэкенда.', 'history')} onOpenSupport={(context) => openSupport(context, 'incident')} onOpenRelatedOrder={() => navigate('history')} />
  {:else if root === 'support'}
    <Support initialTheme={theme} initialType={supportType} initialContext={supportContext} onLoadContextOptions={contextOptions} onSubmitIncident={(payload) => addTicket('incident', payload)} onSubmitTechnical={(payload) => addTicket('technical', payload)} onLoadTickets={() => demo.tickets} onReplyTicket={replyTicket} onOpenRelatedOrder={() => navigate('history')} onGoHome={() => navigate('home')} />
  {:else if root === 'profile'}
    <Profile initialTheme={theme} onLoadProfile={() => profileFrom(demo)} onSaveProfile={updateProfile} onRequestPhoneChange={() => ({ ok: true })} onConfirmPhoneChange={(code) => code === '0000' ? { ok: false, message: 'Неверный код' } : { ok: true }} onChangePaymentMethod={changePaymentMethod} onChangePlan={changePlan} onPauseSubscription={pauseSubscription} onOpenSubscription={() => navigate('subscription')} onOpenAllPayments={() => navigate('payments')} onOpenReceipt={() => openInfo('Чек', 'Фискальный чек недоступен в демо-контуре. Реальные платежи не проводятся.', 'profile')} onOpenSupport={() => openSupport()} onOpenTerms={() => openInfo('Публичная оферта', 'Текст оферты ещё не утверждён. В демо-контуре не заключаются договоры и не проводятся платежи.', 'profile')} onOpenPrivacy={() => openInfo('Политика конфиденциальности', 'Текст политики ещё не утверждён. Демо-контур не отправляет введённые данные на сервер.', 'profile')} onGoToReturn={() => openReturn()} onGoBack={() => navigate('home')} onLogout={() => navigate('signin')} onDeleteAccount={() => ({ ok: false, message: 'Удаление аккаунта недоступно без серверной части.' })} />
  {:else if root === 'subscription'}
    <Subscription profile={profileFrom(demo)} unitCount={demo.units.length} hasActiveOrder={Boolean(demo.activeOrder && !['completed', 'cancelled'].includes(demo.activeOrder.status))} initialTheme={theme} onBack={() => navigate('profile')} onChangePlan={changePlan} onPause={pauseSubscription} onReturn={() => openReturn()} onOpenPayments={() => navigate('payments')} />
  {:else if root === 'payments'}
    <Payments payments={demo.profile.recentPayments} initialTheme={theme} onBack={() => navigate('profile')} onReceipt={() => openInfo('Чек', 'Фискальный чек недоступен в демо-контуре. Реальные платежи не проводятся.', 'payments')} />
  {:else}
    <InfoScreen title={infoTitle} description={infoDescription} onBack={() => navigate(infoBackRoute)} />
  {/if}
{/key}

<style>
  .review-bar{height:38px;padding:0 clamp(12px,3vw,30px);display:flex;align-items:center;justify-content:space-between;gap:12px;background:#292922;color:#e8e8df;font:11px/1 'Open Sans', sans-serif}.review-bar span{display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-bar strong{color:#f4c84a;letter-spacing:.08em}.review-bar i{width:4px;height:4px;border-radius:50%;background:#9c9c8c}.review-bar div{display:flex;gap:3px;flex:0 0 auto}.review-bar button{border:0;background:transparent;color:#f1f1ea;font-size:11px;font-weight:700;padding:8px}.review-bar button:hover{color:#f4c84a}@media(max-width:520px){.review-bar span{font-size:0}.review-bar strong{font-size:11px}.review-bar i{display:none}}
</style>
