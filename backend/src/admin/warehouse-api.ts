export async function api(path: string, data?: unknown, method = 'POST', key?: string) {
  const r = await fetch(`/api${path}`, {
    method: data === undefined ? 'GET' : method,
    credentials: 'same-origin',
    headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const result = await r.json()
  if (!r.ok || result.ok === false) throw new Error(result.message || result.errors?.[0]?.message || 'Не удалось выполнить операцию.')
  return result
}

// One sender per ticket. A lost response must retry the same server operation.
export function createSupportReply(ticketID: string) {
  let pending: { text: string; key: string } | undefined
  let inFlight: Promise<unknown> | undefined
  return (message: string): Promise<unknown> => {
    if (inFlight) return inFlight
    const text = message.trim()
    if (!text) return Promise.reject(new Error('Введите ответ клиенту.'))
    if (!pending || pending.text !== text) pending = { text, key: crypto.randomUUID() }
    inFlight = api(`/v1/support/${ticketID}/reply`, { text }, 'POST', pending.key)
      .then(result => { pending = undefined; return result })
      .finally(() => { inFlight = undefined })
    return inFlight
  }
}
