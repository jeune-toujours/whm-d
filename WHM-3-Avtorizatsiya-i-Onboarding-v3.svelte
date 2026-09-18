<script>
  /*
   * WHM-3 — Авторизация и Онбординг
   *
   * Автономный Svelte 5 demo component.
   * Splash -> Welcome -> Регистрация (телефон -> OTP -> имя) или Вход (телефон -> OTP)
   * -> Онбординг (3 слайда, только для новых) -> WHM-4. Отдельный экран биометрии
   * для повторного входа с активной сессией.
   *
   * API hooks:
   * - onCheckSession()                -> { active, biometricEnabled }
   * - onRequestOtp(phone, mode)       -> { ok, alreadyRegistered?, message? }
   * - onVerifyOtp(code, phone, mode)  -> { ok, message? }
   * - onSaveProfile(data)             -> { ok, message? }
   * - onBiometricAuth()               -> { ok, message? }
   * - onOpenTerms() / onOpenPrivacy()
   * - onComplete()                    -> WHM-4
   */

  const onboardingSlides = [
    {
      title: 'Мы заберём ваши вещи',
      description: 'Команда приедет, упакует и маркирует — вам ничего не нужно делать.',
      glyph: 'courier'
    },
    {
      title: 'Храним в безопасности',
      description: 'Адресное хранение на охраняемом складе. Каждая вещь — с QR-кодом и фото.',
      glyph: 'warehouse'
    },
    {
      title: 'Возврат в 1 клик',
      description: 'Выберите нужные коробки в приложении — доставим на следующий день.',
      glyph: 'delivery'
    }
  ];

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function defaultCheckSession() {
    await delay(900);
    return { active: false, biometricEnabled: false };
  }

  async function defaultRequestOtp(phone, mode) {
    await delay(600);
    if (mode === 'register' && phone === '9991234567') {
      return { ok: true, alreadyRegistered: true };
    }
    return { ok: true };
  }

  async function defaultVerifyOtp(code) {
    await delay(500);
    if (code === '0000') {
      return { ok: false, message: 'Неверный код' };
    }
    return { ok: true };
  }

  async function defaultSaveProfile() {
    await delay(400);
    return { ok: true };
  }

  async function defaultBiometricAuth() {
    await delay(500);
    return { ok: true };
  }

  let {
    initialTheme = 'bumblebee',
    onCheckSession = defaultCheckSession,
    onRequestOtp = defaultRequestOtp,
    onVerifyOtp = defaultVerifyOtp,
    onSaveProfile = defaultSaveProfile,
    onBiometricAuth = defaultBiometricAuth,
    onOpenTerms = () => {},
    onOpenPrivacy = () => {},
    onComplete = () => {}
  } = $props();

  let theme = $state('bumblebee');
  let initialized = $state(false);
  let screen = $state('splash');
  let mode = $state('register');

  let phoneDigits = $state('');
  let phoneError = $state('');
  let phoneAttempted = $state(false);
  let requestingOtp = $state(false);
  let alreadyRegisteredNotice = $state(false);

  let otpDigits = $state(['', '', '', '']);
  let otpError = $state('');
  let otpAttempts = $state(0);
  let otpLockedUntil = $state(0);
  let otpBusy = $state(false);
  let resendCooldown = $state(0);
  let showCallOption = $state(false);
  let resendTimer = null;
  let now = $state(Date.now());
  let clockTimer = null;

  let firstName = $state('');
  let lastName = $state('');
  let profileAttempted = $state(false);
  let profileBusy = $state(false);

  let slideIndex = $state(0);

  let biometricBusy = $state(false);
  let biometricError = $state('');

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    initialized = true;
  });

  $effect(() => {
    runSessionCheck();
    clockTimer = setInterval(() => { now = Date.now(); }, 1000);
    return () => { if (clockTimer) clearInterval(clockTimer); };
  });

  async function runSessionCheck() {
    await delay(300);
    try {
      const result = await onCheckSession();
      if (result?.active) {
        onComplete();
        return;
      }
      screen = result?.biometricEnabled ? 'biometric' : 'welcome';
    } catch (error) {
      screen = 'welcome';
    }
  }

  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function formatPhoneDigits(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean);
    return parts.join(' ');
  }

  function startRegister() {
    mode = 'register';
    resetPhoneStep();
    screen = 'phone';
  }

  function startLogin() {
    mode = 'login';
    resetPhoneStep();
    screen = 'phone';
  }

  function resetPhoneStep() {
    phoneDigits = '';
    phoneError = '';
    phoneAttempted = false;
    alreadyRegisteredNotice = false;
  }

  function handlePhoneInput(event) {
    phoneDigits = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
    phoneError = '';
    alreadyRegisteredNotice = false;
  }

  async function submitPhone() {
    phoneAttempted = true;
    if (phoneDigits.length !== 10) {
      phoneError = 'Введите корректный номер телефона.';
      return;
    }

    requestingOtp = true;
    phoneError = '';
    try {
      const result = await onRequestOtp('+7' + phoneDigits, mode);
      if (result?.alreadyRegistered) {
        alreadyRegisteredNotice = true;
        return;
      }
      if (result?.ok === false) {
        phoneError = result.message || 'Не удалось отправить код. Попробуйте ещё раз.';
        return;
      }
      resetOtpStep();
      screen = 'otp';
    } catch (error) {
      phoneError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      requestingOtp = false;
    }
  }

  function resetOtpStep() {
    otpDigits = ['', '', '', ''];
    otpError = '';
    otpAttempts = 0;
    otpLockedUntil = 0;
    showCallOption = false;
    startResendCountdown();
  }

  function startResendCountdown() {
    resendCooldown = 60;
    stopResendCountdown();
    resendTimer = setInterval(() => {
      resendCooldown = Math.max(0, resendCooldown - 1);
      if (resendCooldown === 0) {
        stopResendCountdown();
        showCallOption = true;
      }
    }, 1000);
  }

  function stopResendCountdown() {
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
  }

  function handleOtpInput(index, event) {
    const digit = event.currentTarget.value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    otpDigits = next;
    otpError = '';

    if (digit && index < otpDigits.length - 1) {
      const nextInput = document.getElementById(`otp-cell-${index + 1}`);
      nextInput?.focus();
    }
    if (next.every((value) => value.length === 1)) {
      verifyOtp();
    }
  }

  function handleOtpKeydown(index, event) {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-cell-${index - 1}`);
      prevInput?.focus();
    }
  }

  async function verifyOtp() {
    if (isOtpLocked) return;
    const code = otpDigits.join('');
    if (code.length !== otpDigits.length) {
      otpError = 'Введите полный код.';
      return;
    }

    otpBusy = true;
    otpError = '';
    try {
      const result = await onVerifyOtp(code, '+7' + phoneDigits, mode);
      if (result?.ok === false) {
        otpAttempts += 1;
        otpDigits = otpDigits.map(() => '');
        document.getElementById('otp-cell-0')?.focus();
        if (otpAttempts >= 3) {
          otpLockedUntil = Date.now() + 10 * 60 * 1000;
          otpError = 'Слишком много попыток. Попробуйте через 10 минут.';
        } else {
          otpError = result.message || 'Неверный код.';
        }
        return;
      }
      stopResendCountdown();
      if (mode === 'register') {
        screen = 'profile';
      } else {
        onComplete();
      }
    } catch (error) {
      otpError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      otpBusy = false;
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0 || otpBusy) return;
    otpBusy = true;
    otpError = '';
    try {
      const result = await onRequestOtp('+7' + phoneDigits, mode);
      if (result?.ok === false) {
        otpError = result.message || 'Не удалось выслать код повторно.';
        return;
      }
      startResendCountdown();
    } catch (error) {
      otpError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      otpBusy = false;
    }
  }

  function changePhoneNumber() {
    stopResendCountdown();
    screen = 'phone';
  }

  async function submitProfile() {
    profileAttempted = true;
    if (!firstName.trim() || !lastName.trim()) return;

    profileBusy = true;
    try {
      await onSaveProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      slideIndex = 0;
      screen = 'onboarding';
    } finally {
      profileBusy = false;
    }
  }

  function nextSlide() {
    if (slideIndex < onboardingSlides.length - 1) {
      slideIndex += 1;
    } else {
      onComplete();
    }
  }

  function skipOnboarding() {
    onComplete();
  }

  async function tryBiometric() {
    biometricBusy = true;
    biometricError = '';
    try {
      const result = await onBiometricAuth();
      if (result?.ok === false) {
        biometricError = result.message || 'Не удалось подтвердить биометрию.';
        return;
      }
      onComplete();
    } catch (error) {
      biometricError = 'Ошибка биометрии. Попробуйте ещё раз.';
    } finally {
      biometricBusy = false;
    }
  }

  function fallbackToOtp() {
    mode = 'login';
    resetPhoneStep();
    screen = 'phone';
  }

  let isDark = $derived(theme === 'halloween');
  let formattedPhone = $derived(formatPhoneDigits(phoneDigits));
  let phoneValid = $derived(phoneDigits.length === 10);
  let missingPhone = $derived(phoneAttempted && !phoneValid);
  let isOtpLocked = $derived(otpLockedUntil > now);
  let otpLockRemaining = $derived(Math.max(0, Math.ceil((otpLockedUntil - now) / 1000)));
  let profileFirstNameMissing = $derived(profileAttempted && !firstName.trim());
  let profileLastNameMissing = $derived(profileAttempted && !lastName.trim());
  let profileValid = $derived(firstName.trim() && lastName.trim());
</script>

<svelte:head>
  <title>WHM — Вход и регистрация</title>
  <meta name="description" content="Авторизация и онбординг клиента WHM" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  {#if screen !== 'splash'}
    <button
      class="theme-toggle"
      type="button"
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onclick={toggleTheme}
    >
      {#if isDark}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.4"></circle>
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.1A8.4 8.4 0 0 1 8.9 3.5 8.6 8.6 0 1 0 20.5 15.1Z"></path></svg>
      {/if}
    </button>
  {/if}

  <main class="page-shell">
    {#if screen === 'splash'}
      <div class="splash">
        <span class="brand-mark large" aria-hidden="true"><img src="/bee.svg" alt="" /></span>
        <strong class="brand-name">WHM</strong>
        <span class="tagline">Хранение вещей — просто и удобно</span>
        <span class="splash-spinner" aria-hidden="true"></span>
      </div>

    {:else if screen === 'welcome'}
      <div class="welcome">
        <div class="hero-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 10 12 4l8 6v10H4ZM8 20v-6h8v6"></path></svg>
        </div>
        <h1>Хранение личных вещей — просто и удобно</h1>
        <div class="welcome-actions">
          <button class="primary-button" type="button" onclick={startRegister}>Начать хранение</button>
          <button class="link-button standalone" type="button" onclick={startLogin}>Войти</button>
        </div>
        <p class="legal-links">
          <button class="link-button" type="button" onclick={onOpenPrivacy}>Политика конфиденциальности</button>
          ·
          <button class="link-button" type="button" onclick={onOpenTerms}>Условия использования</button>
        </p>
      </div>

    {:else if screen === 'phone'}
      <button class="back-button" type="button" aria-label="Назад" onclick={() => (screen = 'welcome')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <div class="page-heading">
        <h1>Введите ваш номер телефона</h1>
        <p>Мы отправим вам SMS с кодом подтверждения.</p>
      </div>

      <label class="text-field" class:invalid={missingPhone}>
        <span>Номер телефона</span>
        <span class="phone-field">
          <span class="country-code">+7</span>
          <input
            type="tel"
            inputmode="numeric"
            placeholder="999 123 45 67"
            value={formattedPhone}
            oninput={handlePhoneInput}
          />
        </span>
        {#if missingPhone}<small class="field-error">Введите корректный номер телефона.</small>{/if}
      </label>

      {#if alreadyRegisteredNotice}
        <div class="inline-note warning">
          <p>Этот номер уже используется.</p>
          <button class="link-button" type="button" onclick={startLogin}>Войти</button>
        </div>
      {/if}
      {#if phoneError}
        <p class="inline-note warning" role="alert">{phoneError}</p>
      {/if}

      <div class="form-actions">
        <button class="primary-button" type="button" disabled={requestingOtp} onclick={submitPhone}>
          {requestingOtp ? 'Отправляем…' : 'Получить код'}
        </button>
      </div>

      {#if mode === 'register'}
        <button class="link-button standalone center" type="button" onclick={startLogin}>Уже есть аккаунт? Войти</button>
      {/if}

    {:else if screen === 'otp'}
      <button class="back-button" type="button" aria-label="Назад" onclick={changePhoneNumber}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <div class="page-heading">
        <h1>Введите код из SMS</h1>
        <p>Код отправлен на +7 {formattedPhone}</p>
      </div>

      <div class="otp-row" class:locked={isOtpLocked}>
        {#each otpDigits as digit, index}
          <input
            id={`otp-cell-${index}`}
            class="otp-cell"
            type="tel"
            inputmode="numeric"
            maxlength="1"
            value={digit}
            disabled={isOtpLocked || otpBusy}
            oninput={(event) => handleOtpInput(index, event)}
            onkeydown={(event) => handleOtpKeydown(index, event)}
          />
        {/each}
      </div>

      {#if isOtpLocked}
        <p class="inline-note warning" role="alert">Слишком много попыток. Повторите через {Math.ceil(otpLockRemaining / 60)} мин.</p>
      {:else if otpError}
        <p class="inline-note warning" role="alert">{otpError}</p>
      {/if}

      <div class="otp-actions">
        <button class="link-button" type="button" disabled={resendCooldown > 0 || otpBusy || isOtpLocked} onclick={resendOtp}>
          {resendCooldown > 0 ? `Выслать код повторно через 0:${String(resendCooldown).padStart(2, '0')}` : 'Выслать код повторно'}
        </button>
        {#if showCallOption}
          <span class="field-caption">Не получили код? Позвоним с кодом на ваш номер.</span>
        {/if}
        <button class="link-button standalone" type="button" onclick={changePhoneNumber}>Изменить номер</button>
      </div>

    {:else if screen === 'profile'}
      <div class="page-heading">
        <h1>Как вас зовут?</h1>
        <p>Это нужно для оформления документов и чека.</p>
      </div>

      <label class="text-field" class:invalid={profileFirstNameMissing}>
        <span>Имя</span>
        <input type="text" bind:value={firstName} />
        {#if profileFirstNameMissing}<small class="field-error">Укажите имя.</small>{/if}
      </label>
      <label class="text-field" class:invalid={profileLastNameMissing}>
        <span>Фамилия</span>
        <input type="text" bind:value={lastName} />
        {#if profileLastNameMissing}<small class="field-error">Укажите фамилию.</small>{/if}
      </label>

      <div class="form-actions">
        <button class="primary-button" type="button" disabled={profileBusy} onclick={submitProfile}>
          {profileBusy ? 'Сохраняем…' : 'Продолжить'}
        </button>
      </div>

    {:else if screen === 'onboarding'}
      <div class="onboarding-slide">
        <div class="slide-glyph" aria-hidden="true">
          {#if onboardingSlides[slideIndex].glyph === 'courier'}
            <svg viewBox="0 0 24 24"><path d="M3 7h11v10H3ZM14 10h4l3 3v4h-7ZM6 17a2 2 0 1 0 4 0M16 17a2 2 0 1 0 4 0"></path></svg>
          {:else if onboardingSlides[slideIndex].glyph === 'warehouse'}
            <svg viewBox="0 0 24 24"><path d="M4 10 12 4l8 6v10H4ZM8 20v-6h8v6"></path></svg>
          {:else}
            <svg viewBox="0 0 24 24"><path d="M4 5h16v11H4Z"></path><path d="M9 20h6M12 16v4"></path></svg>
          {/if}
        </div>
        <h1>{onboardingSlides[slideIndex].title}</h1>
        <p>{onboardingSlides[slideIndex].description}</p>

        <div class="dots" aria-label="Прогресс онбординга">
          {#each onboardingSlides as _, index}
            <span class="dot" class:active={index === slideIndex}></span>
          {/each}
        </div>

        <div class="form-actions">
          <button class="primary-button" type="button" onclick={nextSlide}>
            {slideIndex === onboardingSlides.length - 1 ? 'Начать' : 'Далее'}
          </button>
        </div>

        {#if slideIndex < onboardingSlides.length - 1}
          <button class="link-button standalone center" type="button" onclick={skipOnboarding}>Пропустить</button>
        {/if}
      </div>

    {:else if screen === 'biometric'}
      <div class="welcome">
        <div class="hero-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z"></path><path d="M6 11v2a6 6 0 0 0 12 0v-2"></path><path d="M12 17v3"></path></svg>
        </div>
        <h1>Разблокируйте приложение</h1>
        <p class="field-caption">Используйте Face ID или Touch ID, чтобы продолжить.</p>

        {#if biometricError}
          <p class="inline-note warning" role="alert">{biometricError}</p>
        {/if}

        <div class="welcome-actions">
          <button class="primary-button" type="button" disabled={biometricBusy} onclick={tryBiometric}>
            {biometricBusy ? 'Проверяем…' : 'Использовать Face ID'}
          </button>
          <button class="link-button standalone" type="button" onclick={fallbackToOtp}>Войти по коду из SMS</button>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html) { min-width: 320px; background: var(--color-base-100, white); }
  :global(body) { margin: 0; font-family: "Open Sans", sans-serif; }
  :global(button), :global(input) { font: inherit; font-family: "Open Sans", sans-serif; }
  :global(button) { -webkit-tap-highlight-color: transparent; }

  .whm-app {
    --page-gutter: clamp(1.25rem, 4vw, 2.5rem);
    --content-max: 30rem;
    --type-h1: clamp(1.7rem, 5vw, 2.3rem);
    --type-body: 1rem;
    --type-caption: 0.8rem;
    --soft-border: color-mix(in oklab, var(--color-base-content) 12%, transparent);
    --soft-content: color-mix(in oklab, var(--color-base-content) 62%, transparent);
    --faint-content: color-mix(in oklab, var(--color-base-content) 42%, transparent);
    --primary-faint: color-mix(in oklab, var(--color-primary) 9%, var(--color-base-100));

    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-family: "Open Sans", sans-serif;
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
    --color-secondary: oklch(75% 0.183 55.934);
    --color-error: oklch(70% 0.191 22.216);
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
    --color-secondary: oklch(45.98% 0.248 305.03);
    --color-error: oklch(65.72% 0.199 27.33);
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --border: 1px;
  }

  .ambient { position: fixed; z-index: -1; border-radius: 999px; pointer-events: none; opacity: 0.5; }
  .ambient-one { top: -14rem; right: -12rem; width: 30rem; height: 30rem; background: radial-gradient(circle, var(--primary-faint), transparent 68%); }
  .ambient-two { bottom: -16rem; left: -14rem; width: 34rem; height: 34rem; background: radial-gradient(circle, color-mix(in oklab, var(--color-secondary) 10%, transparent), transparent 67%); }

  .theme-toggle {
    position: absolute; top: 1.1rem; right: 1.1rem; z-index: 10;
    width: 2.6rem; height: 2.6rem; display: grid; place-items: center;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
    color: var(--color-base-content); cursor: pointer;
  }
  .theme-toggle svg { width: 1.1rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .page-shell {
    width: min(calc(100% - (var(--page-gutter) * 2)), var(--content-max));
    margin: 0 auto;
    min-height: 100dvh;
    padding: clamp(2rem, 8vh, 4rem) 0 2.5rem;
    display: flex;
    flex-direction: column;
  }

  .back-button {
    width: 2.6rem; height: 2.6rem; margin-bottom: 1rem; display: grid; place-items: center;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    background: var(--color-base-100); color: var(--color-base-content); cursor: pointer;
  }
  .back-button svg { width: 1.1rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .splash {
    flex: 1; display: grid; place-items: center; justify-items: center; gap: 0.75rem; text-align: center;
  }
  .brand-mark { position: relative; width: 1.9rem; height: 1.9rem; display: inline-grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 0.18rem; transform: rotate(-8deg); }
  .brand-mark.large { width: 3.2rem; height: 3.2rem; gap: 0.3rem; }
  .brand-mark span { display: block; border-radius: 0.18rem; background: var(--color-primary); }
  .brand-mark span:nth-child(3) { grid-column: 1 / 3; }
  .brand-mark span:nth-child(2) { background: var(--color-secondary); }
  .brand-name { font-size: 1.6rem; font-weight: 800; letter-spacing: 0.16em; }
  .tagline { color: var(--soft-content); font-size: var(--type-caption); }
  .splash-spinner {
    width: 1.6rem; height: 1.6rem; margin-top: 0.5rem; border: 3px solid color-mix(in oklab, var(--color-primary) 30%, transparent);
    border-top-color: var(--color-primary); border-radius: 999px; animation: spin 800ms linear infinite;
  }

  .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; }
  .hero-glyph {
    width: 4.5rem; height: 4.5rem; display: grid; place-items: center; border-radius: 50%;
    background: var(--primary-faint); color: var(--color-base-content);
  }
  .hero-glyph svg { width: 2.1rem; fill: none; stroke: currentColor; stroke-width: 1.6; }
  .welcome h1 { margin: 0; font-size: var(--type-h1); font-weight: 810; letter-spacing: -0.02em; text-wrap: balance; }
  .welcome-actions { width: 100%; margin-top: 0.5rem; display: grid; gap: 0.75rem; }
  .legal-links { margin-top: auto; padding-top: 1.5rem; color: var(--faint-content); font-size: var(--type-caption); display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap; }

  .page-heading h1 { margin: 0; font-size: var(--type-h1); font-weight: 800; letter-spacing: -0.02em; }
  .page-heading p { margin: 0.5rem 0 1.75rem; color: var(--soft-content); }

  .text-field { display: grid; gap: 0.4rem; margin-top: 0.5rem; color: var(--soft-content); font-size: var(--type-caption); font-weight: 700; }
  .text-field input {
    min-height: 3.2rem; padding: 0 0.9rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    outline: 0; background: var(--color-base-100); color: var(--color-base-content);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .text-field input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .text-field.invalid input, .text-field.invalid .phone-field {
    border-color: var(--color-error); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-error) 16%, transparent);
  }
  .field-error { color: var(--color-error); font-weight: 700; }
  .field-caption { color: var(--faint-content); font-size: var(--type-caption); }

  .phone-field {
    min-height: 3.2rem; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field); background: var(--color-base-100);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .phone-field:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .country-code { padding: 0 0.75rem 0 0.9rem; border-right: var(--border) solid var(--soft-border); color: var(--color-base-content); font-weight: 700; }
  .phone-field input { border: 0; height: 3.1rem; padding: 0 0.9rem; background: transparent; color: var(--color-base-content); }
  .phone-field input:focus { border: 0; box-shadow: none; }

  .inline-note { margin-top: 0.85rem; color: var(--soft-content); font-size: var(--type-caption); }
  .inline-note.warning { color: var(--color-error); font-weight: 700; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .inline-note.warning p { margin: 0; }

  .form-actions { margin-top: 1.5rem; }

  .primary-button, .secondary-button {
    min-height: 3.25rem; width: 100%; padding: 0 1.1rem; border-radius: var(--radius-field); font-weight: 750; cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
  }
  .primary-button {
    border: 0; background: var(--color-primary); color: #171717;
    box-shadow: 0 8px 20px color-mix(in oklab, var(--color-primary) 22%, transparent);
  }
  .primary-button:hover:not(:disabled) { transform: translateY(-1px); }
  .primary-button:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

  .link-button {
    padding: 0; border: 0; background: transparent; color: var(--color-base-content);
    font-weight: 700; font-size: var(--type-caption); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer;
  }
  .link-button:hover { color: var(--color-primary); }
  .link-button:disabled { color: var(--faint-content); cursor: not-allowed; text-decoration: none; }
  .link-button.standalone { display: block; margin-top: 1rem; }
  .link-button.standalone.center { text-align: center; width: 100%; }

  .otp-row { margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.6rem; }
  .otp-row.locked { opacity: 0.5; }
  .otp-cell {
    width: 3.1rem; height: 3.4rem; flex: 0 0 auto; text-align: center; font-size: 1.2rem; font-weight: 800;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    background: var(--color-base-100); color: var(--color-base-content); outline: 0;
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .otp-cell:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }

  @media (max-width: 380px) {
    .otp-row { gap: 0.45rem; }
    .otp-cell { width: 2.7rem; height: 3.1rem; font-size: 1.1rem; }
  }

  .otp-actions { margin-top: 1.25rem; display: grid; gap: 0.5rem; justify-items: start; }

  .onboarding-slide { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.9rem; }
  .slide-glyph {
    width: 5rem; height: 5rem; display: grid; place-items: center; border-radius: 50%;
    background: var(--primary-faint); color: var(--color-base-content);
  }
  .slide-glyph svg { width: 2.3rem; fill: none; stroke: currentColor; stroke-width: 1.6; }
  .onboarding-slide h1 { margin: 0; font-size: var(--type-h1); font-weight: 800; }
  .onboarding-slide p { margin: 0; max-width: 24rem; color: var(--soft-content); }

  .dots { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
  .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--soft-border); }
  .dot.active { background: var(--color-primary); width: 1.4rem; border-radius: 999px; transition: width 200ms ease; }

  .onboarding-slide .form-actions { width: 100%; margin-top: 1.5rem; }

  @keyframes spin { to { transform: rotate(360deg); } }

  :global(button:focus-visible), :global(input:focus-visible) {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent); outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }

  .brand-mark { display: inline-flex !important; align-items: center; justify-content: center; transform: none !important; font-size: 1.5rem; line-height: 1; }
  .brand-mark.large { font-size: 2.4rem; }
  .brand-mark.tiny { font-size: 1rem; }
</style>
