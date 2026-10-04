<script>
  import { Check, ChevronLeft, Monitor, Moon, Sun, TriangleAlert, Warehouse, X } from '@lucide/svelte';
  /*
   * WHM-12 — Поддержка клиента
   *
   * Автономный Svelte 5 demo component.
   * Два типа обращений: операционный инцидент по хранению (маршрут — Backoffice,
   * «Рассмотрение инцидентов») и техническая проблема (маршрут — почтовый сервис
   * разработчика, минуя Backoffice). Список обращений и детализация с перепиской.
   *
   * API hooks:
   * - onLoadContextOptions()          -> [{ orderId, unitId, title, caption }]  (для привязки инцидента)
   * - onSubmitIncident(data)          -> { ok, ticketId?, expectedResponse?, message? }
   * - onSubmitTechnical(data)         -> { ok, ticketId?, expectedResponse?, message? }
   * - onLoadTickets()                 -> [{ id, type, shortDescription, status, updatedAt, relatedOrderId?, messages }]
   * - onOpenRelatedOrder(ticket)      -> WHM-11 / WHM-5
   * - onReplyTicket(ticketId, text)   -> { ok, message? }
   * - onGoHome()                      -> WHM-4
   *
   * Props initialType / initialContext позволяют открыть экран сразу в форме
   * с предзаполненным типом и контекстом (Сценарий C: обращение из ошибки
   * другого флоу — WHM-7/WHM-9).
   *
   * Обращения, созданные в текущей сессии (submitIncident/submitTechnical),
   * сразу попадают в локальный список и объединяются с результатом
   * onLoadTickets(), чтобы «Мои обращения» показывали свежесозданные заявки
   * даже если серверный onLoadTickets ещё не успел их вернуть.
   */

  const demoContextOptions = [
    { orderId: 'WHM-000512', unitId: 'BX-104', title: 'Коробка L · Зимняя одежда', caption: 'Заказ WHM-000512' },
    { orderId: 'WHM-000498', unitId: 'IT-031', title: 'Велосипед', caption: 'Заказ WHM-000498' },
    { orderId: 'WHM-000481', unitId: 'BX-118', title: 'Коробка M · Книги и документы', caption: 'Заказ WHM-000481' }
  ];

  const demoTickets = [
    {
      id: 'SUP-2041',
      type: 'incident',
      shortDescription: 'Повреждена коробка при доставке',
      status: 'in_progress',
      updatedAt: '27 августа 2026',
      relatedOrderId: 'WHM-000512',
      messages: [
        { author: 'client', text: 'При получении заметил, что угол коробки помят и вещи внутри влажные.', date: '25 августа 2026' },
        { author: 'support', text: 'Спасибо, передали инцидент кладовщику на проверку. Ожидайте ответ в течение 2 рабочих дней.', date: '26 августа 2026' }
      ]
    },
    {
      id: 'SUP-2038',
      type: 'technical',
      shortDescription: 'Не открывается экран возврата вещей',
      status: 'answered',
      updatedAt: '22 августа 2026',
      messages: [
        { author: 'client', text: 'При нажатии «Вернуть вещи» приложение зависает на белом экране.', date: '21 августа 2026' },
        { author: 'support', text: 'Проблема воспроизведена и исправлена в последнем обновлении. Обновите приложение.', date: '22 августа 2026' }
      ]
    },
    {
      id: 'SUP-2015',
      type: 'incident',
      shortDescription: 'Не досчитались одного предмета в коробке',
      status: 'resolved',
      updatedAt: '10 августа 2026',
      relatedOrderId: 'WHM-000481',
      messages: [
        { author: 'client', text: 'В описи было 5 предметов, а вернули 4.', date: '8 августа 2026' },
        { author: 'support', text: 'Нашли предмет на складе, организуем отдельную доставку без дополнительной оплаты.', date: '10 августа 2026' }
      ]
    }
  ];

  const ticketStatusLabel = {
    submitted: 'Отправлено',
    in_progress: 'В работе',
    answered: 'Получен ответ',
    resolved: 'Решено',
    answered: 'Получен ответ',
    rejected: 'Отклонено'
  };

  const appSections = [
    'Главный экран',
    'Сдача на хранение',
    'Возврат вещей',
    'История заказов',
    'Профиль и биллинг',
    'Другое'
  ];

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function shortenText(text, maxLength = 70) {
    const trimmed = text.trim();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
  }

  async function defaultLoadContextOptions() {
    await delay(400);
    return demoContextOptions;
  }

  async function defaultSubmitIncident() {
    await delay(700);
    return { ok: true, ticketId: `SUP-${Math.floor(2100 + Math.random() * 900)}`, expectedResponse: 'Ответим в течение 2 рабочих дней' };
  }

  async function defaultSubmitTechnical() {
    await delay(700);
    return { ok: true, ticketId: `SUP-${Math.floor(2100 + Math.random() * 900)}`, expectedResponse: 'Обычно отвечаем в течение 1 рабочего дня' };
  }

  async function defaultLoadTickets() {
    await delay(600);
    return demoTickets;
  }

  async function defaultReplyTicket() {
    await delay(500);
    return { ok: true };
  }

  let {
    initialTheme = 'bumblebee',
    live = false,
    liveTickets = null,
    initialType = null,
    initialContext = null,
    onLoadContextOptions = defaultLoadContextOptions,
    onSubmitIncident = defaultSubmitIncident,
    onSubmitTechnical = defaultSubmitTechnical,
    onLoadTickets = defaultLoadTickets,
    onOpenRelatedItem = () => {},
    onOpenRelatedOrder = () => {},
    onReplyTicket = defaultReplyTicket,
    onGoHome = () => {}
  } = $props();

  let theme = $state('bumblebee');
  let initialized = $state(false);

  let screen = $state('select');
  let ticketType = $state('');

  let contextOptions = $state([]);
  let contextOptionsLoading = $state(false);
  let selectedOrderId = $state('');
  let incidentDescription = $state('');
  let incidentAttachments = $state([]);
  let incidentFileInput;
  let technicalFileInput;
  let incidentAttempted = $state(false);

  let technicalSection = $state('');
  let technicalDescription = $state('');
  let technicalAttachments = $state([]);
  let technicalAttempted = $state(false);

  let formError = $state('');
  let submitting = $state(false);

  let lastTicketId = $state('');
  let submissionKey = $state(crypto.randomUUID());
  let lastExpectedResponse = $state('');
  let lastTicketType = $state('');

  let tickets = $state([]);
  let sessionTickets = $state([]);
  let ticketsFetched = $state(false);
  let ticketsLoading = $state(false);
  let ticketsError = $state(false);

  let selectedTicket = $state(null);
  $effect(() => {
    if (liveTickets) {
      tickets = liveTickets;
      if (selectedTicket) selectedTicket = liveTickets.find(t => t.id === selectedTicket.id) || selectedTicket;
    }
  });
  let replyMessage = $state('');
  let replyKey = $state(crypto.randomUUID());
  let replyBusy = $state(false);
  let replyError = $state('');

  $effect.pre(() => {
    if (initialized) return;
    theme = initialTheme;
    initialized = true;

    if (initialType === 'incident' || initialType === 'technical') {
      ticketType = initialType;
      screen = 'form';
      if (initialContext?.orderId) {
        selectedOrderId = initialContext.orderId;
      } else if (initialContext?.unitId) {
        selectedOrderId = `item:${initialContext.unitId}`;
      }
      if (initialType === 'incident' && initialContext?.note) {
        incidentDescription = initialContext.note;
      }
      if (initialType === 'technical' && initialContext?.note) {
        technicalDescription = initialContext.note;
      }
      if (initialType === 'incident') queueMicrotask(() => selectType('incident'));
    }
  });

  function toggleTheme() {
    theme = isDark ? 'bumblebee' : 'halloween';
    window.dispatchEvent(new CustomEvent('whm-theme-change', { detail: theme }));
  }

  function mergeTickets(fetched) {
    const fetchedIds = new Set(fetched.map((ticket) => ticket.id));
    const localOnly = sessionTickets.filter((ticket) => !fetchedIds.has(ticket.id));
    tickets = [...localOnly, ...fetched];
  }

  function addSessionTicket(ticket) {
    sessionTickets = [ticket, ...sessionTickets];
    const existingIds = new Set(tickets.map((item) => item.id));
    if (!existingIds.has(ticket.id)) {
      tickets = [ticket, ...tickets];
    }
  }

  async function selectType(type) {
    ticketType = type;
    formError = '';
    incidentAttempted = false;
    technicalAttempted = false;
    screen = 'form';

    if (type === 'incident' && contextOptions.length === 0) {
      contextOptionsLoading = true;
      try {
        contextOptions = await onLoadContextOptions();
        if (initialContext?.orderId && !contextOptions.some(o=>o.orderId===initialContext.orderId)) contextOptions = [{orderId:initialContext.orderId,title:initialContext.orderNumber || 'Выбранный заказ',caption:'Контекст обращения'},...contextOptions];
        if (!selectedOrderId && contextOptions.length > 0) {
          selectedOrderId = contextOptions[0].orderId;
        }
      } finally {
        contextOptionsLoading = false;
      }
    }
  }

  function attachIncidentFile() {
    if (live) { incidentFileInput?.click(); return; }
    incidentAttachments = [...incidentAttachments, { name: `Фото_${incidentAttachments.length + 1}.jpg` }];
  }

  function removeIncidentFile(index) {
    incidentAttachments = incidentAttachments.filter((_, i) => i !== index);
  }

  function attachTechnicalFile() {
    if (live) { technicalFileInput?.click(); return; }
    technicalAttachments = [...technicalAttachments, { name: `Скриншот_${technicalAttachments.length + 1}.png` }];
  }

  function removeTechnicalFile(index) {
    technicalAttachments = technicalAttachments.filter((_, i) => i !== index);
  }

  async function submitIncident() {
    incidentAttempted = true;

    if (!selectedOrderId) {
      formError = 'Выберите заказ или вещь, к которой относится обращение.';
      return;
    }
    if (!incidentDescription.trim()) {
      formError = 'Опишите проблему.';
      return;
    }

    submitting = true;
    formError = '';
    try {
      const trimmedDescription = incidentDescription.trim();
      const result = await onSubmitIncident({
        operationKey: submissionKey,
        orderId: initialContext?.orderId || (selectedOrderId.startsWith('item:') ? undefined : selectedOrderId),
        unitId: initialContext?.unitId || contextOptions.find(o=>o.orderId === selectedOrderId)?.unitId,
        description: trimmedDescription,
        attachments: incidentAttachments
      });
      if (result?.ok === false) {
        formError = result.message || 'Не удалось отправить обращение. Повторите попытку.';
        return;
      }
      const ticketId = result?.ticketId || 'SUP-0000';
      addSessionTicket({
        id: ticketId,
        type: 'incident',
        shortDescription: shortenText(trimmedDescription),
        status: 'submitted',
        updatedAt: 'Только что',
        relatedOrderId: selectedOrderId.startsWith('item:') ? null : selectedOrderId,
        messages: [{ author: 'client', text: trimmedDescription, date: 'Только что' }]
      });
      submissionKey = crypto.randomUUID();
      lastTicketId = ticketId;
      lastExpectedResponse = result?.expectedResponse || '';
      lastTicketType = 'incident';
      screen = 'confirmation';
    } catch (error) {
      formError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      submitting = false;
    }
  }

  async function submitTechnical() {
    technicalAttempted = true;

    if (!technicalDescription.trim()) {
      formError = 'Опишите проблему.';
      return;
    }

    submitting = true;
    formError = '';
    try {
      const trimmedDescription = technicalDescription.trim();
      const result = await onSubmitTechnical({
        operationKey: submissionKey,
        section: technicalSection,
        description: trimmedDescription,
        attachments: technicalAttachments
      });
      if (result?.ok === false) {
        formError = result.message || 'Не удалось отправить обращение. Повторите попытку.';
        return;
      }
      const ticketId = result?.ticketId || 'SUP-0000';
      addSessionTicket({
        id: ticketId,
        type: 'technical',
        shortDescription: shortenText(trimmedDescription),
        status: 'submitted',
        updatedAt: 'Только что',
        messages: [{ author: 'client', text: trimmedDescription, date: 'Только что' }]
      });
      submissionKey = crypto.randomUUID();
      lastTicketId = ticketId;
      lastExpectedResponse = result?.expectedResponse || '';
      lastTicketType = 'technical';
      screen = 'confirmation';
    } catch (error) {
      formError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      submitting = false;
    }
  }

  async function openList() {
    screen = 'list';

    if (ticketsFetched) return;

    ticketsLoading = true;
    ticketsError = false;
    try {
      const fetched = await onLoadTickets();
      mergeTickets(fetched);
      ticketsFetched = true;
    } catch (error) {
      ticketsError = true;
    } finally {
      ticketsLoading = false;
    }
  }

  function openTicket(ticket) {
    selectedTicket = ticket;
    replyMessage = '';
    replyError = '';
    screen = 'detail';
  }

  async function sendReply() {
    if (!replyMessage.trim()) {
      replyError = 'Введите текст сообщения.';
      return;
    }
    replyBusy = true;
    replyError = '';
    try {
      const result = await onReplyTicket(selectedTicket.id, replyMessage.trim(), replyKey);
      if (result?.ok === false) {
        replyError = result.message || 'Не удалось отправить сообщение.';
        return;
      }
      if (!live) selectedTicket.messages = [
        ...selectedTicket.messages,
        { author: 'client', text: replyMessage.trim(), date: 'Сейчас' }
      ];
      replyMessage = '';
      replyKey = crypto.randomUUID();
    } catch (error) {
      replyError = 'Нет соединения. Попробуйте ещё раз.';
    } finally {
      replyBusy = false;
    }
  }

  function goBack() {
    formError = '';
    if (screen === 'form') screen = 'select';
    else if (screen === 'confirmation') screen = 'select';
    else if (screen === 'detail') screen = 'list';
    else if (screen === 'list') screen = 'select';
  }

  function resetToSelect() {
    ticketType = '';
    submissionKey = crypto.randomUUID();
    selectedOrderId = initialContext?.orderId || '';
    incidentDescription = '';
    incidentAttachments = [];
    incidentAttempted = false;
    technicalSection = '';
    technicalDescription = '';
    technicalAttachments = [];
    technicalAttempted = false;
    formError = '';
    screen = 'select';
  }

  let isDark = $derived(theme === 'halloween');
  let canReplyToTicket = $derived(
    selectedTicket && selectedTicket.status !== 'resolved' && selectedTicket.status !== 'rejected'
  );
  let missingOrder = $derived(incidentAttempted && !selectedOrderId);
  let missingIncidentDescription = $derived(incidentAttempted && !incidentDescription.trim());
  let missingTechnicalDescription = $derived(technicalAttempted && !technicalDescription.trim());
</script>

<svelte:head>
  <title>Поддержка клиента · Клиентский интерфейс</title>
  <meta name="description" content="Обращения по вещам на хранении и техническим проблемам" />
</svelte:head>

{#if live}
  <input hidden type="file" bind:this={incidentFileInput} accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" onchange={e => { if (incidentAttachments.length < 5 && e.currentTarget.files?.[0]) incidentAttachments = [...incidentAttachments, { name:e.currentTarget.files[0].name, file:e.currentTarget.files[0] }]; e.currentTarget.value = ''; }} />
  <input hidden type="file" bind:this={technicalFileInput} accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" onchange={e => { if (technicalAttachments.length < 5 && e.currentTarget.files?.[0]) technicalAttachments = [...technicalAttachments, { name:e.currentTarget.files[0].name, file:e.currentTarget.files[0] }]; e.currentTarget.value = ''; }} />
{/if}

<div class="whm-app" data-theme={theme}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>

  <header class="app-header">
    <button class="back-button" type="button" aria-label="Назад" onclick={goBack}>
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
    {#if screen === 'select'}
      <div class="page-heading">
        <h1>Чем мы можем помочь?</h1>
        <p>Выберите тип обращения — мы направим его нужной команде.</p>
      </div>

      <div class="type-grid">
        <button class="type-card" type="button" onclick={() => selectType('incident')}>
          <span class="type-icon">
            <Warehouse aria-hidden="true" />
          </span>
          <strong>Проблема с вещью на хранении</strong>
          <span class="type-caption">Порча, брак или ошибка при сдаче/возврате</span>
        </button>
        <button class="type-card" type="button" onclick={() => selectType('technical')}>
          <span class="type-icon">
            <Monitor aria-hidden="true" />
          </span>
          <strong>Проблема с приложением</strong>
          <span class="type-caption">Баг, сбой или зависание в приложении</span>
        </button>
      </div>

      <button class="link-button standalone" type="button" onclick={openList}>Мои обращения</button>

    {:else if screen === 'form'}
      {#if ticketType === 'incident'}
        <div class="page-heading">
          <h1>Проблема с вещью на хранении</h1>
          <p>Расскажите, что произошло — мы передадим обращение на рассмотрение.</p>
        </div>

        <label class="text-field" class:invalid={missingOrder}>
          <span>Заказ или вещь</span>
          <select bind:value={selectedOrderId} disabled={contextOptionsLoading || Boolean(initialContext?.orderId || initialContext?.unitId)}>
            <option value="">{contextOptionsLoading ? 'Загружаем список…' : 'Выберите заказ или вещь'}</option>
            {#each contextOptions as option}
              <option value={option.orderId}>{option.title} · {option.caption}</option>
            {/each}
          </select>
          {#if missingOrder}<small class="field-error">Выберите заказ или вещь.</small>{/if}
        </label>

        <label class="text-field" class:invalid={missingIncidentDescription}>
          <span>Описание проблемы</span>
          <textarea rows="4" placeholder="Что случилось с вещью?" bind:value={incidentDescription}></textarea>
          {#if missingIncidentDescription}<small class="field-error">Опишите проблему.</small>{/if}
        </label>

        <div class="attachments">
          <span class="field-label">Фото или видео (необязательно)</span>
          <div class="attachment-list">
            {#each incidentAttachments as file, index}
              <span class="attachment-chip">
                {file.name}
                <button type="button" aria-label="Удалить файл" onclick={() => removeIncidentFile(index)}><X aria-hidden="true" /></button>
              </span>
            {/each}
          </div>
          <button class="secondary-button small" type="button" onclick={attachIncidentFile}>Приложить файл</button>
        </div>

        {#if formError}
          <p class="inline-note warning" role="alert">{formError}</p>
        {/if}

        <div class="form-actions">
          <button class="primary-button" type="button" disabled={submitting} onclick={submitIncident}>
            {submitting ? 'Отправляем…' : 'Отправить обращение'}
          </button>
        </div>
      {:else}
        <div class="page-heading">
          <h1>Проблема с приложением</h1>
          <p>Опишите, что пошло не так — мы передадим обращение разработчикам.</p>
        </div>

        <label class="text-field">
          <span>Раздел приложения (необязательно)</span>
          <select bind:value={technicalSection}>
            <option value="">Не выбрано</option>
            {#each appSections as section}
              <option value={section}>{section}</option>
            {/each}
          </select>
        </label>

        <label class="text-field" class:invalid={missingTechnicalDescription}>
          <span>Описание проблемы</span>
          <textarea rows="4" placeholder="Что произошло?" bind:value={technicalDescription}></textarea>
          {#if missingTechnicalDescription}<small class="field-error">Опишите проблему.</small>{/if}
        </label>

        <div class="attachments">
          <span class="field-label">Скриншот (необязательно)</span>
          <div class="attachment-list">
            {#each technicalAttachments as file, index}
              <span class="attachment-chip">
                {file.name}
                <button type="button" aria-label="Удалить файл" onclick={() => removeTechnicalFile(index)}><X aria-hidden="true" /></button>
              </span>
            {/each}
          </div>
          <button class="secondary-button small" type="button" onclick={attachTechnicalFile}>Приложить файл</button>
        </div>

        <p class="inline-note">Мы автоматически приложим техническую информацию об устройстве и версии приложения.</p>

        {#if formError}
          <p class="inline-note warning" role="alert">{formError}</p>
        {/if}

        <div class="form-actions">
          <button class="primary-button" type="button" disabled={submitting} onclick={submitTechnical}>
            {submitting ? 'Отправляем…' : 'Отправить обращение'}
          </button>
        </div>
      {/if}

    {:else if screen === 'confirmation'}
      <div class="confirmation-card">
        <div class="confirmation-icon" aria-hidden="true">
          <Check aria-hidden="true" />
        </div>
        <h1>Обращение отправлено</h1>
        <p>Номер обращения</p>
        <strong class="ticket-id">#{lastTicketId}</strong>
        {#if lastExpectedResponse}
          <p class="field-caption">{lastExpectedResponse}</p>
        {/if}
        <div class="confirmation-actions">
          <button class="primary-button" type="button" onclick={openList}>Мои обращения</button>
          <button class="secondary-button" type="button" onclick={() => { resetToSelect(); onGoHome(); }}>На главный экран</button>
        </div>
      </div>

    {:else if screen === 'list'}
      <div class="page-heading">
        <h1>Мои обращения</h1>
        <p>Статус и переписка по вашим обращениям.</p>
      </div>

      {#if ticketsError}
        <div class="error-banner" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>Не удалось загрузить обращения.</span>
          <button class="link-button" type="button" onclick={openList}>Повторить</button>
        </div>
      {:else if ticketsLoading}
        <div class="ticket-card skeleton" aria-hidden="true"></div>
        <div class="ticket-card skeleton" aria-hidden="true"></div>
      {:else if tickets.length === 0}
        <div class="empty-state">
          <p>У вас пока нет обращений.</p>
        </div>
      {:else}
        <div class="ticket-list">
          {#each tickets as ticket}
            <button class="ticket-card" type="button" onclick={() => openTicket(ticket)}>
              <span class="ticket-type">{ticket.type === 'incident' ? 'Вещь на хранении' : 'Приложение'}</span>
              <strong>{ticket.shortDescription}</strong>
              <span class="field-caption">#{ticket.id} · {ticket.updatedAt}</span>
              <span
                class="ticket-status"
                class:resolved={ticket.status === 'resolved'}
                class:rejected={ticket.status === 'rejected'}
              >
                {ticket.type === 'technical' && ticket.status === 'submitted' ? 'Отправлено' : ticketStatusLabel[ticket.status] ?? ticket.status}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <button class="link-button standalone" type="button" onclick={() => (screen = 'select')}>Новое обращение</button>

    {:else if screen === 'detail' && selectedTicket}
      {#if live && selectedTicket.attachments?.length}<div class="inline-note">Вложения: {#each selectedTicket.attachments as file}<a href={file.url} target="_blank" rel="noopener">{file.filename}</a> {/each}</div>{/if}
      <div class="page-heading">
        <h1>{selectedTicket.shortDescription}</h1>
        <p>Обращение #{selectedTicket.id} · {selectedTicket.type === 'technical' && selectedTicket.status === 'submitted' ? 'Отправлено' : ticketStatusLabel[selectedTicket.status] ?? selectedTicket.status}</p>
      </div>

      {#if selectedTicket.relatedOrderId}
        <button class="secondary-button small" type="button" onclick={() => onOpenRelatedOrder(selectedTicket)}>
          Открыть заказ {selectedTicket.relatedOrderId}
        </button>
      {/if}
      {#if selectedTicket.relatedItemId}<button class="secondary-button small" onclick={()=>onOpenRelatedItem(selectedTicket.relatedItemId)}>Открыть вещь</button>{/if}

      <div class="thread">
        {#each selectedTicket.messages as message}
          <div class="thread-message" class:from-support={message.author === 'support'}>
            <span class="thread-author">{message.author === 'support' ? 'Поддержка' : 'Вы'}</span>
            <p>{message.text}</p>
            <span class="field-caption">{message.date}</span>
          </div>
        {/each}
      </div>

      {#if selectedTicket.closeReason}<p class="inline-note">{selectedTicket.closeReason}</p>{/if}
      {#if canReplyToTicket}
        <label class="text-field">
          <span>Ваше сообщение</span>
          <textarea rows="3" placeholder="Дополните обращение…" bind:value={replyMessage}></textarea>
        </label>
        {#if replyError}
          <p class="inline-note warning" role="alert">{replyError}</p>
        {/if}
        <div class="form-actions">
          <button class="primary-button" type="button" disabled={replyBusy} onclick={sendReply}>
            {replyBusy ? 'Отправляем…' : 'Отправить сообщение'}
          </button>
        </div>
      {:else}
        <p class="inline-note">Обращение закрыто. Если проблема повторилась, создайте новое обращение.</p>
      {/if}
    {/if}
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html) { min-width: 320px; background: var(--color-base-100, white); }
  :global(body) { margin: 0; font-family: 'Open Sans', sans-serif; }
  :global(button), :global(input), :global(select), :global(textarea) { font: inherit; font-family: 'Open Sans', sans-serif; }
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
    --color-success: oklch(76% 0.177 163.223);
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
    --color-success: oklch(62.705% 0.169 149.213);
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

  .type-grid { margin-top: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .type-card {
    padding: 1.2rem; display: grid; gap: 0.5rem; justify-items: start; text-align: left;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: var(--color-base-100);
    color: inherit; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }
  .type-card:hover { border-color: var(--color-primary); background: var(--primary-faint); transform: translateY(-1px); }
  .type-icon {
    width: 2.6rem; height: 2.6rem; display: grid; place-items: center; border-radius: var(--radius-field);
    background: var(--primary-faint); color: var(--color-base-content);
  }
  .type-icon :global(svg) { width: 1.3rem; fill: none; stroke: currentColor; stroke-width: 1.7; }
  .type-card strong { font-size: var(--type-heading); }
  .type-caption { color: var(--soft-content); font-size: var(--type-caption); }

  .link-button {
    padding: 0; border: 0; background: transparent; color: var(--color-base-content);
    font-weight: 700; font-size: var(--type-caption); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer;
  }
  .link-button:hover { color: var(--color-primary); }
  .link-button.standalone { margin-top: 1.5rem; display: block; }

  .text-field { display: grid; gap: 0.4rem; margin-top: 1.1rem; color: var(--soft-content); font-size: var(--type-caption); font-weight: 700; }
  .text-field select, .text-field textarea {
    padding: 0.75rem 0.8rem; border: var(--border) solid var(--soft-border); border-radius: var(--radius-field);
    outline: 0; background: var(--color-base-100); color: var(--color-base-content); resize: vertical;
    transition: border-color 180ms ease, box-shadow 180ms ease; font-family: inherit;
  }
  .text-field select { min-height: 2.9rem; }
  .text-field select:focus, .text-field textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--primary-faint); }
  .text-field.invalid select, .text-field.invalid textarea {
    border-color: var(--color-error); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-error) 16%, transparent);
  }
  .field-error { color: var(--color-error); font-weight: 700; }

  .field-label { color: var(--soft-content); font-size: var(--type-caption); font-weight: 700; }
  .field-caption { color: var(--faint-content); font-size: var(--type-caption); }

  .attachments { margin-top: 1.1rem; display: grid; gap: 0.6rem; }
  .attachment-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .attachment-chip {
    display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.6rem;
    border-radius: 999px; background: var(--color-base-200); font-size: var(--type-caption);
    color: var(--color-base-content);
  }
  .attachment-chip button { border: 0; background: transparent; color: var(--soft-content); cursor: pointer; font-size: 1rem; line-height: 1; }

  .inline-note { margin-top: 0.75rem; color: var(--soft-content); font-size: var(--type-caption); }
  .inline-note.warning { color: var(--color-error); font-weight: 700; }

  .form-actions { margin-top: 1.5rem; }

  .primary-button, .secondary-button {
    min-height: 3rem; padding: 0 1.1rem; width: 100%; border-radius: var(--radius-field); font-weight: 750; cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease, background-color 180ms ease;
  }
  .primary-button {
    border: var(--border) solid color-mix(in oklab, var(--color-primary-content) 12%, transparent);
    background: var(--color-primary); color: #171717;
    box-shadow: 0 8px 20px color-mix(in oklab, var(--color-primary) 22%, transparent);
  }
  .primary-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 24px color-mix(in oklab, var(--color-primary) 28%, transparent); }
  .primary-button:disabled, .secondary-button:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .secondary-button {
    border: var(--border) solid var(--soft-border);
    background: var(--color-base-100);
    color: var(--color-base-content);
  }
  .secondary-button:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-base-200); }
  .secondary-button.small { width: auto; min-height: 2.6rem; padding: 0 0.9rem; margin-top: 0.4rem; font-size: var(--type-caption); }

  .error-banner {
    margin-top: 1.25rem; padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.65rem;
    border-radius: var(--radius-field); background: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
  }
  .error-banner :global(svg) { width: 1.1rem; fill: none; stroke: var(--color-error); stroke-width: 1.8; flex: 0 0 auto; }
  .error-banner span { font-size: var(--type-caption); }
  .error-banner .link-button { margin-left: auto; }

  .confirmation-card {
    margin-top: 2rem; padding: 2rem 1.5rem; display: grid; justify-items: center; text-align: center; gap: 0.5rem;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: var(--color-base-100);
  }
  .confirmation-icon {
    width: 3.5rem; height: 3.5rem; display: grid; place-items: center; border-radius: 50%;
    background: var(--color-success); color: white; margin-bottom: 0.5rem;
  }
  .confirmation-icon :global(svg) { width: 1.7rem; fill: none; stroke: currentColor; stroke-width: 2.4; }
  .confirmation-card h1 { margin: 0; font-size: var(--type-h1); }
  .confirmation-card p { margin: 0; color: var(--soft-content); font-size: var(--type-caption); }
  .ticket-id { font-size: var(--type-heading); font-weight: 800; }
  .confirmation-actions { margin-top: 1.25rem; width: 100%; display: grid; gap: 0.6rem; }

  .empty-state {
    margin-top: 1.5rem; padding: 2rem; text-align: center; color: var(--soft-content);
    border: var(--border) dashed var(--soft-border); border-radius: var(--radius-box);
  }

  .ticket-list { margin-top: 1.25rem; display: grid; gap: 0.75rem; }
  .ticket-card {
    padding: 1rem 1.1rem; display: grid; gap: 0.3rem; text-align: left;
    border: var(--border) solid var(--soft-border); border-radius: var(--radius-box); background: var(--color-base-100);
    color: inherit; cursor: pointer; transition: border-color 180ms ease, transform 180ms ease;
    position: relative;
  }
  .ticket-card:hover { border-color: var(--color-primary); transform: translateY(-1px); }
  .ticket-card.skeleton {
    height: 6rem; cursor: default;
    background: linear-gradient(90deg, var(--color-base-200) 25%, color-mix(in oklab, var(--color-base-200) 60%, transparent) 37%, var(--color-base-200) 63%);
    background-size: 400% 100%; animation: shimmer 1.4s ease infinite;
  }
  .ticket-type { color: var(--soft-content); font-size: var(--type-caption); font-weight: 700; }
  .ticket-status {
    position: absolute; top: 1rem; right: 1.1rem; padding: 0.2rem 0.55rem; border-radius: 999px;
    background: var(--primary-faint); font-size: var(--type-caption); font-weight: 700;
  }
  .ticket-status.resolved { background: color-mix(in oklab, var(--color-success) 22%, transparent); }
  .ticket-status.rejected { background: color-mix(in oklab, var(--color-error) 18%, transparent); color: var(--color-error); }

  .thread { margin-top: 1.25rem; display: grid; gap: 0.75rem; }
  .thread-message {
    padding: 0.85rem 1rem; border-radius: var(--radius-field); background: var(--color-base-200);
    justify-self: start; max-width: 90%;
  }
  .thread-message.from-support { justify-self: end; background: var(--primary-faint); }
  .thread-author { display: block; margin-bottom: 0.25rem; font-weight: 700; font-size: var(--type-caption); }
  .thread-message p { margin: 0 0 0.35rem; font-size: var(--type-caption); }

  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

  :global(button:focus-visible), :global(select:focus-visible), :global(textarea:focus-visible) {
    outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent); outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .app-header { padding: 0 1rem; }
    .page-shell { width: calc(100% - 2rem); }
    .type-grid { grid-template-columns: 1fr; }
    .thread-message { max-width: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }



</style>
