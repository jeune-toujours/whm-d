<script>
  import { ChevronLeft, Moon, Sun, TriangleAlert, X } from '@lucide/svelte';
  /*
   * WHM-13 — Профиль и Биллинг
   *
   * Автономный Svelte 5 demo component.
   * Личные данные (включая защищённую смену номера телефона через OTP),
   * подписка, способ оплаты, последние платежи, поддержка, выход/удаление.
   *
   * Важно про оплату: реальная привязка карты происходит на стороне внешнего
   * эквайринга (PSP), встроенного как iframe/redirect. Модалка «Способ оплаты»
   * ниже визуально имитирует эту страницу для демо/прототипа — WHM не сохраняет
   * и не обрабатывает введённые в неё данные карты: наружу передаётся только
   * результат хука onChangePaymentMethod (маскированные brand + last4),
   * полученный от процессинга.
   *
   * API hooks:
   * - onLoadProfile()                 -> { firstName, lastName, phone, email,
   *                                         planId, monthlyPrice, paymentMethod,
   *                                         nextChargeDate, recentPayments,
   *                                         hasStoredItems, hasActiveOrders }
   * - onSaveProfile(data)             -> { ok, message? }                     (имя, фамилия, email)
   * - onRequestPhoneChange(newPhone)  -> { ok, message? }                     (отправка OTP на новый номер)
   * - onConfirmPhoneChange(code)      -> { ok, phone?, message? }             (подтверждение OTP)
   * - onChangePaymentMethod(draft)    -> { ok, paymentMethod?, message? }     (внешний эквайринг)
   * - onChangePlan(planId)            -> { ok, plan?, message? }
   * - onPauseSubscription()           -> { ok, message? }
   * - onOpenAllPayments()             -> WHM-11 (фильтр «Оплата»)
   * - onOpenReceipt(payment)
   * - onOpenSupport()                 -> WHM-12
   * - onOpenTerms() / onOpenPrivacy()
   * - onGoToReturn()                  -> WHM-9
   * - onGoBack()                      -> WHM-4
   * - onLogout()                      -> WHM-3
   * - onDeleteAccount()               -> { ok, message? }
   */

  const demoPlans = [
    { id: 'basic', title: 'Базовый', volume: 'до 4 коробок', price: 990 },
    { id: 'standard', title: 'Стандарт', volume: 'до 10 коробок', price: 1990 },
    { id: 'premium', title: 'Премиум', volume: 'до 25 коробок', price: 3490 }
  ];

  const paymentStatusLabel = { paid: 'Оплачено', refunded: 'Возврат', failed: 'Ошибка' };

  const demoProfile = {
    firstName: 'Анна',
    lastName: 'Соколова',
    phone: '+7 999 123-45-67',
    email: 'anna@example.com',
    planId: 'standard',
    monthlyPrice: 1990,
    nextChargeDate: '1 сентября 2026',
    paymentMethod: { brand: 'Mastercard', last4: '4242' },
    hasStoredItems: true,
    hasActiveOrders: false,
    recentPayments: [
      { id: 'PMT-3312', date: '1 августа 2026', amount: 1990, status: 'paid', hasReceipt: true },
      { id: 'PMT-3201', date: '1 июля 2026', amount: 1990, status: 'paid', hasReceipt: true },
      { id: 'PMT-3099', date: '12 июня 2026', amount: 990, status: 'refunded', hasReceipt: false }
    ]
  };

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function defaultLoadProfile() {
    await delay(650);
    return demoProfile;
  }

  async function defaultSaveProfile() {
    await delay(500);
    return { ok: true };
  }

  async function defaultRequestPhoneChange() {
    await delay(600);
    return { ok: true };
  }

  async function defaultConfirmPhoneChange(code) {
    await delay(600);
    if (code === '0000') {
      return { ok: false, message: 'Неверный код. Попробуйте ещё раз.' };
    }
    return { ok: true };
  }

  async function defaultChangePaymentMethod() {
    await delay(900);
    return {
      ok: true,
      paymentMethod: { brand: 'Демо-карта', last4: '1111' }
    };
  }

  async function defaultChangePlan(planId) {
    await delay(600);
    const plan = demoPlans.find((item) => item.id === planId);
    return { ok: true, plan };
  }

  function extractPhoneDigits(value) {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  function formatPhoneDigits(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean);
    return parts.join(' ');
  }

  let {
    initialTheme = 'bumblebee',
    onLoadProfile = defaultLoadProfile,
    onSaveProfile = defaultSaveProfile,
    onRequestPhoneChange = defaultRequestPhoneChange,
    onConfirmPhoneChange = defaultConfirmPhoneChange,
    onChangePaymentMethod = defaultChangePaymentMethod,
    onChangePlan = defaultChangePlan,
    onPauseSubscription = async () => ({ ok: true }),
    onOpenSubscription = () => {},
    onOpenAllPayments = () => {},
    onOpenReceipt = () => {},
    onOpenSupport = () => {},
    onOpenTerms = () => {},
    onOpenPrivacy = () => {},
    onGoToReturn = () => {},
    onGoBack = () => {},
    onLogout = () => {},
    onDeleteAccount = async () => ({ ok: true })
  } = $props();

  let theme = $state('bumblebee');
  let initialized = $state(false);

  let loading = $state(true);
  let loadError = $state(false);

  let firstName = $state('');
  let lastName = $state('');
  let phone = $state('');
  let phoneDigits = $state('');
  let email = $state('');
  let planId = $state('');
  let monthlyPrice = $state(0);
  let nextChargeDate = $state('');
  let paymentMethod = $state(null);
  let hasStoredItems = $state(false);
  let hasActiveOrders = $state(false);
  let recentPayments = $state([]);

  let editOpen = $state(false);
  let editStep = $state('form');
  let editFirstName = $state('');
  let editLastName = $state('');
  let editEmail = $state('');
  let editPhoneDigits = $state('');
  let editError = $state('');
  let savingProfile = $state(false);

  let pendingPhoneDigits = $state('');
  let otpCode = $state('');
  let otpError = $state('');
  let otpBusy = $state(false);
  let resendCooldown = $state(0);
  let resendTimer = null;

  let planModalOpen = $state(false);
  let selectedPlanId = $state('');
  let planActionError = $state('');
  let planBusy = $state(false);

  let paymentModalOpen = $state(false);
  let cardError = $state('');
  let paymentBusy = $state(false);
  let paymentNotice = $state('');

  let pauseBusy = $state(false);
  let pauseBlockedMessage = $state('');

  let logoutConfirmOpen = $state(false);
  let deleteConfirmOpen = $state(false);
  let deleteBlockedMessage = $state('');
  let deleteBusy = $state(false);

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    initialized = true;
  });

  $effect(() => {
    fetchProfile();
  });

  async function fetchProfile() {
    loading = true;
    loadError = false;
    try {
      const data = await onLoadProfile();
      firstName = data?.firstName ?? '';
      lastName = data?.lastName ?? '';
      phone = data?.phone ?? '';
      phoneDigits = extractPhoneDigits(phone);
      email = data?.email ?? '';
      planId = data?.planId ?? '';
      monthlyPrice = data?.monthlyPrice ?? 0;
      nextChargeDate = data?.nextChargeDate ?? '';
      paymentMethod = data?.paymentMethod ?? null;
      hasStoredItems = Boolean(data?.hasStoredItems);
      hasActiveOrders = Boolean(data?.hasActiveOrders);
      recentPayments = data?.recentPayments ?? [];
    } catch (error) {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  }

  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function openEdit() {
    editFirstName = firstName;
    editLastName = lastName;
    editEmail = email;
    editPhoneDigits = phoneDigits;
    editError = '';
    editStep = 'form';
    editOpen = true;
  }

  function closeEdit() {
    stopResendCountdown();
    editOpen = false;
  }

  function handleEditPhoneInput(event) {
    editPhoneDigits = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
    editError = '';
  }

  function startResendCountdown() {
    resendCooldown = 60;
    stopResendCountdown();
    resendTimer = setInterval(() => {
      resendCooldown = Math.max(0, resendCooldown - 1);
      if (resendCooldown === 0) stopResendCountdown();
    }, 1000);
  }

  function stopResendCountdown() {
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
  }

  async function saveProfile() {
    const trimmedFirstName = editFirstName.trim();
    const trimmedLastName = editLastName.trim();
    const trimmedEmail = editEmail.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      editError = 'Заполните имя и фамилию.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      editError = 'Введите корректный email.';
      return;
    }
    if (editPhoneDigits.length !== 10) {
      editError = 'Введите корректный номер телефона.';
      return;
    }

    savingProfile = true;
    editError = '';
    try {
      const result = await onSaveProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail
      });
      if (result?.ok === false) {
        editError = result.message || 'Не удалось сохранить данные.';
        return;
      }
      firstName = trimmedFirstName;
      lastName = trimmedLastName;
      email = trimmedEmail;

      if (editPhoneDigits === phoneDigits) {
        editOpen = false;
        return;
      }

      await requestPhoneOtp();
    } catch (error) {
      editError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      savingProfile = false;
    }
  }

  async function requestPhoneOtp() {
    pendingPhoneDigits = editPhoneDigits;
    otpCode = '';
    otpError = '';
    otpBusy = true;
    try {
      const result = await onRequestPhoneChange('+7' + pendingPhoneDigits);
      if (result?.ok === false) {
        editError = result.message || 'Не удалось отправить код подтверждения.';
        return;
      }
      editStep = 'otp';
      startResendCountdown();
    } catch (error) {
      editError = 'Нет соединения. Код не отправлен.';
    } finally {
      otpBusy = false;
    }
  }

  async function confirmPhoneOtp() {
    if (otpCode.trim().length < 4) {
      otpError = 'Введите код из SMS.';
      return;
    }
    otpBusy = true;
    otpError = '';
    try {
      const result = await onConfirmPhoneChange(otpCode.trim());
      if (result?.ok === false) {
        otpError = result.message || 'Не удалось подтвердить номер.';
        return;
      }
      phoneDigits = pendingPhoneDigits;
      phone = '+7 ' + formatPhoneDigits(pendingPhoneDigits);
      stopResendCountdown();
      editOpen = false;
    } catch (error) {
      otpError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      otpBusy = false;
    }
  }

  function backToEditForm() {
    stopResendCountdown();
    editStep = 'form';
    otpError = '';
  }

  async function resendPhoneOtp() {
    if (resendCooldown > 0 || otpBusy) return;
    otpBusy = true;
    otpError = '';
    try {
      const result = await onRequestPhoneChange('+7' + pendingPhoneDigits);
      if (result?.ok === false) {
        otpError = result.message || 'Не удалось отправить код повторно.';
        return;
      }
      startResendCountdown();
    } catch (error) {
      otpError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      otpBusy = false;
    }
  }

  function openPlanModal() {
    selectedPlanId = planId;
    planActionError = '';
    planModalOpen = true;
  }

  function closePlanModal() {
    planModalOpen = false;
  }

  async function confirmPlanChange() {
    const nextPlan = demoPlans.find((plan) => plan.id === selectedPlanId);
    const activePlan = demoPlans.find((plan) => plan.id === planId);
    if (!nextPlan || nextPlan.id === planId) {
      planModalOpen = false;
      return;
    }

    const isDowngrade = activePlan && nextPlan.price < activePlan.price;
    if (isDowngrade && hasStoredItems) {
      planActionError = 'Нельзя понизить тариф при вещах на хранении. Сначала оформите возврат.';
      return;
    }

    planBusy = true;
    planActionError = '';
    try {
      const result = await onChangePlan(nextPlan.id);
      if (result?.ok === false) {
        planActionError = result.message || 'Не удалось изменить тариф.';
        return;
      }
      planId = nextPlan.id;
      monthlyPrice = nextPlan.price;
      planModalOpen = false;
    } catch (error) {
      planActionError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      planBusy = false;
    }
  }

  function goToReturnFromPlan() {
    planModalOpen = false;
    onGoToReturn();
  }

  function openPaymentModal() {
    cardError = '';
    paymentModalOpen = true;
  }

  function closePaymentModal() {
    if (paymentBusy) return;
    paymentModalOpen = false;
  }

  async function submitPaymentDemo() {
    paymentBusy = true;
    cardError = '';
    try {
      const result = await onChangePaymentMethod();

      if (result?.ok === false) {
        cardError = result.message || 'Не удалось привязать способ оплаты.';
        return;
      }

      if (result?.paymentMethod) paymentMethod = result.paymentMethod;
      paymentModalOpen = false;
      paymentNotice = 'Способ оплаты обновлён.';
    } catch (error) {
      cardError = 'Нет соединения. Способ оплаты не изменён.';
    } finally {
      paymentBusy = false;
    }
  }

  async function pauseSubscription() {
    if (hasStoredItems || hasActiveOrders) {
      pauseBlockedMessage = 'Приостановка недоступна: у вас есть вещи на хранении или активный заказ.';
      return;
    }
    pauseBusy = true;
    pauseBlockedMessage = '';
    try {
      const result = await onPauseSubscription();
      if (result?.ok === false) {
        pauseBlockedMessage = result.message || 'Не удалось приостановить подписку.';
      }
    } finally {
      pauseBusy = false;
    }
  }

  function requestLogout() {
    logoutConfirmOpen = true;
  }

  function confirmLogout() {
    logoutConfirmOpen = false;
    onLogout();
  }

  function requestDeleteAccount() {
    if (hasStoredItems || hasActiveOrders) {
      deleteBlockedMessage = hasActiveOrders
        ? 'Удаление недоступно: у вас есть активный заказ. Дождитесь его завершения.'
        : 'Удаление недоступно: у вас есть вещи на хранении. Сначала оформите возврат.';
      return;
    }
    deleteBlockedMessage = '';
    deleteConfirmOpen = true;
  }

  async function confirmDeleteAccount() {
    deleteBusy = true;
    try {
      const result = await onDeleteAccount();
      if (result?.ok === false) {
        deleteBlockedMessage = result.message || 'Не удалось удалить аккаунт.';
        deleteConfirmOpen = false;
        return;
      }
      deleteConfirmOpen = false;
    } finally {
      deleteBusy = false;
    }
  }

  let isDark = $derived(theme === 'halloween');
  let currentPlan = $derived(demoPlans.find((plan) => plan.id === planId));
  let fullName = $derived(`${firstName} ${lastName}`.trim() || 'Клиент');
  let editFormattedPhone = $derived(formatPhoneDigits(editPhoneDigits));
  let maskedPendingPhone = $derived(formatPhoneDigits(pendingPhoneDigits));
</script>

<svelte:head>
  <title>Профиль и биллинг · Клиентский интерфейс</title>
  <meta name="description" content="Личные данные, подписка и оплата хранения" />
</svelte:head>

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  <header class="app-header">
    <button class="back-button" type="button" aria-label="Назад" onclick={onGoBack}>
      <ChevronLeft aria-hidden="true" />
    </button>
    <div class="brand" aria-label="Клиентский интерфейс">
      <span class="system-label">Клиентский интерфейс</span>
    </div>
    <button
      class="icon-button"
      type="button"
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onclick={toggleTheme}
    >
      {#if isDark}
        <Sun aria-hidden="true" />
      {:else}
        <Moon aria-hidden="true" />
      {/if}
    </button>
  </header>

  <main class="page-shell">
    <div class="page-heading">
      <h1>Профиль и биллинг</h1>
      <p>Личные данные, подписка и способ оплаты хранения.</p>
    </div>

    {#if loadError}
      <div class="error-banner" role="alert">
        <TriangleAlert aria-hidden="true" />
        <span>Не удалось загрузить профиль.</span>
        <button class="link-button" type="button" onclick={fetchProfile}>Повторить</button>
      </div>
    {/if}

    {#if loading}
      <div class="section-card skeleton" aria-hidden="true"></div>
      <div class="section-card skeleton" aria-hidden="true"></div>
      <div class="section-card skeleton" aria-hidden="true"></div>
    {:else}
      <section class="section-card">
        <div class="section-head">
          <h2>Личные данные</h2>
          <button class="link-button" type="button" onclick={openEdit}>Изменить</button>
        </div>
        <dl class="field-list">
          <div><dt>Имя и фамилия</dt><dd>{fullName}</dd></div>
          <div><dt>Телефон</dt><dd>{phone}</dd></div>
          <div><dt>Email</dt><dd>{email || 'Не указан'}</dd></div>
        </dl>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>Подписка и оплата</h2>
          <button class="link-button" type="button" onclick={onOpenSubscription}>Подробнее</button>
        </div>
        <div class="plan-summary">
          <div>
            <span class="field-label">Текущий тариф</span>
            <strong>{currentPlan?.title ?? '—'}</strong>
            <span class="field-caption">{currentPlan?.volume ?? ''}</span>
          </div>
          <div>
            <span class="field-label">Стоимость</span>
            <strong>{formatMoney(monthlyPrice)}/мес.</strong>
            <span class="field-caption">Следующее списание: {nextChargeDate}</span>
          </div>
        </div>

        <div class="payment-row">
          <div>
            <span class="field-label">Способ оплаты</span>
            {#if paymentMethod}
              <strong>{paymentMethod.brand} •••• {paymentMethod.last4}</strong>
            {:else}
              <strong>Не привязан</strong>
            {/if}
          </div>
          <button class="secondary-button" type="button" onclick={openPaymentModal}>
            {paymentMethod ? 'Изменить способ оплаты' : 'Привязать способ оплаты'}
          </button>
        </div>
        {#if paymentNotice}
          <p class="inline-note" role="status" aria-live="polite">{paymentNotice}</p>
        {/if}

        <div class="plan-actions">
          <button class="secondary-button" type="button" onclick={openPlanModal}>Изменить тариф</button>
          <button
            class="secondary-button"
            type="button"
            disabled={hasStoredItems || hasActiveOrders || pauseBusy}
            title={hasStoredItems || hasActiveOrders ? 'Недоступно при вещах на хранении или активном заказе' : undefined}
            onclick={pauseSubscription}
          >
            {pauseBusy ? 'Приостанавливаем…' : 'Приостановить подписку'}
          </button>
        </div>
        {#if pauseBlockedMessage}
          <p class="inline-note warning" role="alert">{pauseBlockedMessage}</p>
        {/if}
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>Последние платежи</h2>
          <button class="link-button" type="button" onclick={onOpenAllPayments}>Вся история</button>
        </div>
        <div class="payment-list">
          {#each recentPayments as payment}
            <div class="payment-item">
              <span class="payment-date">{payment.date}</span>
              <span class="payment-amount">{formatMoney(payment.amount)}</span>
              <span
                class="payment-status"
                class:refunded={payment.status === 'refunded'}
                class:failed={payment.status === 'failed'}
              >
                {paymentStatusLabel[payment.status] ?? payment.status}
              </span>
              {#if payment.hasReceipt}
                <button class="link-button" type="button" onclick={() => onOpenReceipt(payment)}>Чек</button>
              {/if}
            </div>
          {/each}
          {#if recentPayments.length === 0}
            <p class="inline-note">Платежей пока нет.</p>
          {/if}
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>Поддержка и документы</h2>
        </div>
        <div class="link-list">
          <button class="link-button" type="button" onclick={onOpenSupport}>Обратиться в поддержку</button>
          <button class="link-button" type="button" onclick={onOpenTerms}>Публичная оферта</button>
          <button class="link-button" type="button" onclick={onOpenPrivacy}>Политика конфиденциальности</button>
        </div>
      </section>

      <section class="section-card account-actions">
        <button class="secondary-button" type="button" onclick={requestLogout}>Выйти</button>
        <button class="danger-link" type="button" onclick={requestDeleteAccount}>Удалить аккаунт</button>
        {#if deleteBlockedMessage}
          <p class="inline-note warning" role="alert">
            {deleteBlockedMessage}
            {#if hasStoredItems}
              <button class="link-button" type="button" onclick={onGoToReturn}>Оформить возврат</button>
            {/if}
          </p>
        {/if}
      </section>
    {/if}
  </main>

  {#if editOpen}
    <div class="modal-backdrop" role="presentation" onclick={closeEdit}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={closeEdit}><X aria-hidden="true" /></button>

        {#if editStep === 'form'}
          <h2 id="edit-modal-title">Изменить личные данные</h2>
          <label class="text-field">
            <span>Имя</span>
            <input type="text" bind:value={editFirstName} />
          </label>
          <label class="text-field">
            <span>Фамилия</span>
            <input type="text" bind:value={editLastName} />
          </label>
          <label class="text-field">
            <span>Email</span>
            <input type="email" bind:value={editEmail} />
          </label>
          <label class="text-field">
            <span>Телефон</span>
            <span class="phone-field">
              <span class="country-code">+7</span>
              <input
                type="tel"
                inputmode="numeric"
                placeholder="999 123 45 67"
                value={editFormattedPhone}
                oninput={handleEditPhoneInput}
              />
            </span>
            <small>При смене номера мы отправим код подтверждения по SMS.</small>
          </label>
          {#if editError}
            <p class="inline-note warning" role="alert">{editError}</p>
          {/if}
          <div class="modal-actions">
            <button class="primary-button" type="button" disabled={savingProfile} onclick={saveProfile}>
              {savingProfile ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button class="secondary-button" type="button" onclick={closeEdit}>Отмена</button>
          </div>
        {:else}
          <h2 id="edit-modal-title">Подтвердите новый номер</h2>
          <p>Код отправлен на +7 {maskedPendingPhone}</p>
          <label class="text-field">
            <span>Код из SMS</span>
            <input type="tel" inputmode="numeric" maxlength="6" bind:value={otpCode} />
          </label>
          {#if otpError}
            <p class="inline-note warning" role="alert">{otpError}</p>
          {/if}
          <div class="otp-actions">
            <button class="link-button" type="button" disabled={resendCooldown > 0 || otpBusy} onclick={resendPhoneOtp}>
              {resendCooldown > 0 ? `Выслать код повторно через 0:${String(resendCooldown).padStart(2, '0')}` : 'Выслать код повторно'}
            </button>
          </div>
          <div class="modal-actions">
            <button class="primary-button" type="button" disabled={otpBusy} onclick={confirmPhoneOtp}>
              {otpBusy ? 'Проверяем…' : 'Подтвердить номер'}
            </button>
            <button class="secondary-button" type="button" onclick={backToEditForm}>Изменить номер</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if planModalOpen}
    <div class="modal-backdrop" role="presentation" onclick={closePlanModal}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={closePlanModal}><X aria-hidden="true" /></button>
        <h2 id="plan-modal-title">Выберите тариф</h2>
        <div class="plan-list">
          {#each demoPlans as plan}
            <label class="plan-option" class:selected={selectedPlanId === plan.id}>
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={selectedPlanId === plan.id}
                onchange={() => (selectedPlanId = plan.id)}
              />
              <span>
                <strong>{plan.title}</strong>
                <span class="field-caption">{plan.volume}</span>
              </span>
              <strong>{formatMoney(plan.price)}/мес.</strong>
            </label>
          {/each}
        </div>
        {#if planActionError}
          <div class="inline-note warning" role="alert">
            <p>{planActionError}</p>
            <button class="link-button" type="button" onclick={goToReturnFromPlan}>Перейти к возврату вещей</button>
          </div>
        {/if}
        <div class="modal-actions">
          <button class="primary-button" type="button" disabled={planBusy} onclick={confirmPlanChange}>
            {planBusy ? 'Применяем…' : 'Применить тариф'}
          </button>
          <button class="secondary-button" type="button" onclick={closePlanModal}>Отмена</button>
        </div>
      </div>
    </div>
  {/if}

  {#if paymentModalOpen}
    <div class="modal-backdrop" role="presentation" onclick={closePaymentModal}>
      <div
        class="modal-card payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" disabled={paymentBusy} onclick={closePaymentModal}><X aria-hidden="true" /></button>
        <h2 id="payment-modal-title">Способ оплаты</h2>
        <p>В рабочей версии привязка карты откроется в защищённом интерфейсе платёжного провайдера. Приложение получит только маскированный способ оплаты.</p>
        <p class="inline-note">В демо-контуре можно посмотреть успешный результат без ввода реквизитов и списания денег.</p>

        {#if cardError}
          <p class="inline-note warning" role="alert">{cardError}</p>
        {/if}

        <div class="modal-actions">
          <button class="primary-button" type="button" disabled={paymentBusy} onclick={submitPaymentDemo}>
            {paymentBusy ? 'Подключаем…' : 'Показать демо-привязку'}
          </button>
          <button class="secondary-button" type="button" disabled={paymentBusy} onclick={closePaymentModal}>Отмена</button>
        </div>
      </div>
    </div>
  {/if}

  {#if logoutConfirmOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (logoutConfirmOpen = false)}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={() => (logoutConfirmOpen = false)}><X aria-hidden="true" /></button>
        <h2 id="logout-modal-title">Выйти из аккаунта?</h2>
        <p>Вы сможете войти снова по номеру телефона.</p>
        <div class="modal-actions">
          <button class="primary-button" type="button" onclick={confirmLogout}>Выйти</button>
          <button class="secondary-button" type="button" onclick={() => (logoutConfirmOpen = false)}>Отмена</button>
        </div>
      </div>
    </div>
  {/if}

  {#if deleteConfirmOpen}
    <div class="modal-backdrop" role="presentation" onclick={() => (deleteConfirmOpen = false)}>
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
      >
        <button class="modal-close" type="button" aria-label="Закрыть" onclick={() => (deleteConfirmOpen = false)}><X aria-hidden="true" /></button>
        <h2 id="delete-modal-title">Удалить аккаунт без возможности восстановления?</h2>
        <p>Это действие необратимо. Личные данные и история будут удалены согласно регламенту.</p>
        <div class="modal-actions">
          <button class="danger-button" type="button" disabled={deleteBusy} onclick={confirmDeleteAccount}>
            {deleteBusy ? 'Удаляем…' : 'Удалить аккаунт'}
          </button>
          <button class="secondary-button" type="button" onclick={() => (deleteConfirmOpen = false)}>Отмена</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html) { min-width: 320px; background: var(--color-base-100, white); }
  :global(body) { margin: 0; font-family: 'Open Sans', sans-serif; }
  :global(button), :global(input) { font: inherit; font-family: 'Open Sans', sans-serif; }
  :global(button) { -webkit-tap-highlight-color: transparent; }

  .whm-app {
    --page-gutter: clamp(1rem, 3vw, 2.5rem);
    --header-height: 4.75rem;
    --content-max: 46rem;
    --type-h1: clamp(1.9rem, 3.2vw, 2.6rem);
    --type-heading: clamp(1.1rem, 1.8vw, 1.35rem);
    --type-body: 1rem;
    --type-caption: 0.75rem;
    --soft-border: color-mix(in oklab, var(--color-base-content) 12%, transparent);
    --muted-border: color-mix(in oklab, var(--color-base-content) 7%, transparent);
    --soft-content: color-mix(in oklab, var(--color-base-content) 62%, transparent);
    --faint-content: color-mix(in oklab, var(--color-base-content) 42%, transparent);
    --primary-faint: color-mix(in oklab, var(--color-primary) 9%, var(--color-base-100));

    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-family: 'Open Sans', sans-serif;
    font-size: var(--type-body);
    line-height: 1.5;
    transition: background-color 200ms ease, color 200ms ease;
  }

  .whm-app[data-theme='bumblebee'] {
    color-scheme: light;
    --color-base-100: oklch(100% 0 0);
    --color-base-200: oklch(97% 0 0);
    --color-base-content: oklch(20% 0 0);
    --color-primary: oklch(85% 0.199 91.936);
    --color-primary-content: oklch(42% 0.095 57.708);
    --color-warning: oklch(82% 0.189 84.429);
    --color-error: oklch(70% 0.191 22.216);
    --color-secondary: oklch(75% 0.183 55.934);
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .whm-app[data-theme='halloween'] {
    color-scheme: dark;
    --color-base-100: oklch(21% 0.006 56.043);
    --color-base-200: oklch(14% 0.004 49.25);
    --color-base-content: oklch(84.955% 0 0);
    --color-primary: oklch(76% 0.188 70.08);
    --color-primary-content: oklch(19.693% 0.004 196.779);
    --color-warning: oklch(66.584% 0.157 58.318);
    --color-error: oklch(65.72% 0.199 27.33);
    --color-secondary: oklch(45.98% 0.248 305.03);
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .ambient { position: fixed; z-index: -1; border-radius: 999px; pointer-events: none; opacity: 0.5; }
  .ambient-one { top: -14rem; right: -12rem; width: 30rem; height: 30rem; background: radial-gradient(circle, var(--primary-faint), transparent 68%); }
  .ambient-two { bottom: -16rem; left: -14rem; width: 34rem; height: 34rem; background: radial-gradient(circle, color-mix(in oklab, var(--color-secondary) 10%, transparent), transparent 67%); }

  .app-header {
    position: relative;
    z-index: 20;
    width: min(100%, var(--content-max));
    height: var(--header-height);
    margin: 0 auto;
    padding: 0 var(--page-gutter);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .brand { display: flex; align-items: center; gap: 0.6rem; }





  .back-button, .icon-button {
    width: 2.6rem; height: 2.6rem; display: grid; place-items: center; flex: 0 0 auto;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
    color: var(--color-base-content); cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }
  .back-button:hover, .icon-button:hover { border-color: var(--color-primary); background: var(--color-base-200); }
  .back-button:active, .icon-button:active { transform: scale(0.96); }
  .back-button :global(svg), .icon-button :global(svg) { width: 1.15rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .page-shell { width: min(calc(100% - (var(--page-gutter) * 2)), var(--content-max)); margin: 0 auto 3rem; }
  .page-heading { margin-top: 1.25rem; }
  .page-heading h1 { margin: 0; font-size: var(--type-h1); font-weight: 800; letter-spacing: -0.02em; }
  .page-heading p { margin: 0.4rem 0 0; color: var(--soft-content); }

  .error-banner {
    margin-top: 1.25rem; padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.65rem;
    border-radius: var(--radius-field); background: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
  }
  .error-banner :global(svg) { width: 1.1rem; fill: none; stroke: var(--color-error); stroke-width: 1.8; flex: 0 0 auto; }
  .error-banner span { font-size: var(--type-caption); }

  .link-button {
    padding: 0; margin-left: auto; border: 0; background: transparent; color: var(--color-base-content);
    font-weight: 700; font-size: var(--type-caption); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer;
  }
  .link-button:hover { color: var(--color-primary); }
  .link-button:disabled { color: var(--faint-content); cursor: not-allowed; text-decoration: none; }

  .section-card {
    margin-top: 1.25rem; padding: 1.25rem 1.4rem;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: var(--color-base-100);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--color-base-content) 4%, transparent);
  }

  .section-card.skeleton {
    height: 7rem;
    background: linear-gradient(90deg, var(--color-base-200) 25%, color-mix(in oklab, var(--color-base-200) 60%, transparent) 37%, var(--color-base-200) 63%);
    background-size: 400% 100%; animation: shimmer 1.4s ease infinite;
  }

  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .section-head h2 { margin: 0; font-size: var(--type-heading); font-weight: 780; }

  .field-list { margin: 0.9rem 0 0; display: grid; gap: 0.6rem; }
  .field-list > div { display: flex; justify-content: space-between; gap: 1rem; }
  .field-list dt { color: var(--soft-content); font-size: var(--type-caption); }
  .field-list dd { margin: 0; font-weight: 700; font-size: var(--type-caption); text-align: right; }

  .plan-summary { margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .plan-summary > div { display: grid; gap: 0.2rem; }
  .field-label { color: var(--soft-content); font-size: var(--type-caption); }
  .field-caption { color: var(--faint-content); font-size: var(--type-caption); }

  .payment-row {
    margin-top: 1.1rem; padding-top: 1.1rem; border-top: var(--border) solid var(--muted-border);
    display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  }
  .payment-row > div { display: grid; gap: 0.2rem; }

  .inline-note { margin-top: 0.6rem; color: var(--soft-content); font-size: var(--type-caption); }
  .inline-note.warning { color: var(--color-error); font-weight: 700; }

  .plan-actions {
    margin-top: 1.1rem; padding-top: 1.1rem; border-top: var(--border) solid var(--muted-border);
    display: flex; flex-wrap: wrap; gap: 0.75rem;
  }

  .payment-list { margin-top: 0.9rem; display: grid; gap: 0.6rem; }
  .payment-item {
    display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 0.75rem;
    padding: 0.6rem 0.7rem; border-radius: var(--radius-field); background: var(--color-base-200);
    font-size: var(--type-caption);
  }
  .payment-amount { font-weight: 700; }
  .payment-status { padding: 0.2rem 0.55rem; border-radius: 999px; background: var(--primary-faint); font-weight: 700; white-space: nowrap; }
  .payment-status.refunded { background: color-mix(in oklab, var(--color-warning) 22%, transparent); }
  .payment-status.failed { background: color-mix(in oklab, var(--color-error) 18%, transparent); color: var(--color-error); }

  .link-list { margin-top: 0.9rem; display: grid; gap: 0.6rem; }
  .link-list .link-button { margin-left: 0; }

  .account-actions { display: grid; gap: 0.75rem; }

  .primary-button, .secondary-button, .danger-button {
    min-height: 3rem; padding: 0 1.1rem; border-radius: var(--radius-field); font-weight: 750; cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease;
  }
  .primary-button {
    border: var(--border) solid color-mix(in oklab, var(--color-primary-content) 12%, transparent);
    background: var(--color-primary); color: #171717;
    box-shadow: 0 8px 20px color-mix(in oklab, var(--color-primary) 22%, transparent);
  }
  .primary-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 24px color-mix(in oklab, var(--color-primary) 28%, transparent); }
  .primary-button:disabled, .secondary-button:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .secondary-button { border: var(--border) solid var(--soft-border); background: var(--color-base-100); color: #171717; }
  .secondary-button:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-base-200); }
  .danger-button { border: var(--border) solid var(--color-error); background: var(--color-error); color: #ffffff; }
  .danger-button:hover:not(:disabled) { background: color-mix(in oklab, var(--color-error) 88%, black); }
  .danger-link {
    justify-self: start; padding: 0; border: 0; background: transparent; color: var(--color-error);
    font-weight: 700; font-size: var(--type-caption); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer;
  }
  .danger-link:hover { color: color-mix(in oklab, var(--color-error) 80%, black); }

  .modal-backdrop {
    position: fixed; z-index: 100; inset: 0; padding: 1rem; display: grid; place-items: center;
    background: color-mix(in oklab, black 55%, transparent); backdrop-filter: blur(6px);
  }
  .modal-card {
    position: relative; width: min(100%, 28rem); max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.4rem;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: var(--color-base-100);
    box-shadow: 0 24px 60px color-mix(in oklab, black 22%, transparent);
  }
  .modal-close {
    position: absolute; top: 0.7rem; right: 0.7rem; width: 2.4rem; height: 2.4rem;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: var(--color-base-100);
    color: var(--color-base-content); font-size: 1.35rem; cursor: pointer;
  }
  .modal-close:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-card h2 { margin: 0.5rem 0 0; font-size: var(--type-heading); }
  .modal-card p { margin: 0.6rem 0 0; color: var(--soft-content); font-size: var(--type-caption); }
  .modal-actions { margin-top: 1.2rem; display: grid; gap: 0.6rem; }

  .payment-modal { width: min(100%, 30rem); }
  .card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }

  .text-field { display: grid; gap: 0.4rem; margin-top: 0.9rem; color: var(--soft-content); font-size: var(--type-caption); font-weight: 700; }
  .text-field input {
    min-height: 2.9rem; padding: 0 0.8rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    outline: 0; background: var(--color-base-100); color: var(--color-base-content);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .text-field input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .text-field small { color: var(--faint-content); font-weight: 550; }

  .phone-field {
    min-height: 2.9rem; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: var(--color-base-100);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .phone-field:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .country-code { padding: 0 0.7rem 0 0.85rem; border-right: var(--border) solid var(--soft-border); color: var(--color-base-content); font-weight: 700; }
  .phone-field input { border: 0; height: 2.8rem; padding: 0 0.8rem; background: transparent; color: var(--color-base-content); }
  .phone-field input:focus { border: 0; box-shadow: none; }

  .otp-actions { margin-top: 0.6rem; display: flex; justify-content: flex-start; }
  .otp-actions .link-button { margin-left: 0; }

  .plan-list { margin-top: 0.9rem; display: grid; gap: 0.6rem; }
  .plan-option {
    padding: 0.8rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.75rem;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease;
  }
  .plan-option:hover { border-color: color-mix(in oklab, var(--color-primary) 55%, var(--soft-border)); }
  .plan-option.selected { border-color: var(--color-primary); background: var(--primary-faint); }
  .plan-option input { width: 1.1rem; height: 1.1rem; accent-color: var(--color-primary); }
  .plan-option span { display: grid; gap: 0.15rem; }

  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

  :global(button:focus-visible), :global(input:focus-visible) {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent); outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .app-header { padding: 0 1rem; }
    .page-shell { width: calc(100% - 2rem); }
    .plan-summary { grid-template-columns: 1fr; }
    .payment-item { grid-template-columns: 1fr; text-align: left; }
    .field-list dd { text-align: left; }
    .card-row { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }



</style>
