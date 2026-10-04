const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
export async function api(path, data, method = 'POST', key) {
  const response = await fetch(`${base}${path}`, {
    method: data === undefined ? 'GET' : method,
    credentials: 'include', signal: AbortSignal.timeout(20000),
    headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
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
export function download(path) { window.open(`${base}${path}`, '_blank', 'noopener'); }
export async function uploadSupport(file) {
  const form = new FormData(); form.set('_payload', JSON.stringify({ purpose:'support' })); form.set('file', file);
  const r = await fetch(`${base}/media`, { method:'POST', credentials:'include', body:form, signal:AbortSignal.timeout(60000) });
  const data = await r.json();
  if (!r.ok || !data.doc?.id) throw new ApiError('Не удалось сохранить вложение. Проверьте формат и размер файла (до 25 МБ).', r.status);
  return data.doc.id;
}
