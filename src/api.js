const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
export async function api(path, data, method = 'POST', key, signal) {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(`${base}${path}`, {
    method: data === undefined ? 'GET' : method,
    credentials: 'include', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { 'X-WHM-Client': '1', ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok === false) throw new ApiError(result?.message || 'Не удалось выполнить запрос. Повторите попытку.', response.status, result?.code);
  return result;
}
export async function safe(action) {
  try { return await action(); }
  catch (error) { return { ok: false, message: error instanceof ApiError ? error.message : 'Нет соединения. Повторите попытку.', code: error.code }; }
}
export function download(path) {
  const url = new URL(`${base}${path}`, window.location.origin);
  url.searchParams.set('whm-client', '1');
  window.open(url.href, '_blank', 'noopener');
}
export function clientMediaURL(value) {
  const apiURL = new URL(base, window.location.origin);
  const url = new URL(value, apiURL.origin);
  // File links cannot send X-WHM-Client. Select the client's cookie explicitly,
  // without changing signed URLs served directly by external object storage.
  if (url.origin === apiURL.origin && url.pathname.startsWith(`${apiURL.pathname}/media/`)) url.searchParams.set('whm-client', '1');
  return url.href;
}
export async function uploadSupport(file, supportType = 'incident') {
  const form = new FormData(); form.set('_payload', JSON.stringify({ purpose:'support', supportType })); form.set('file', file);
  const r = await fetch(`${base}/media`, { method:'POST', credentials:'include', headers:{ 'X-WHM-Client':'1' }, body:form, signal:AbortSignal.timeout(60000) });
  const data = await r.json();
  if (!r.ok || !data.doc?.id) throw new ApiError('Не удалось сохранить вложение. Проверьте формат и размер файла (до 25 МБ).', r.status);
  return data.doc.id;
}
