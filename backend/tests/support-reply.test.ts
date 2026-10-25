import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api, createSupportReply } from '../src/admin/warehouse-api'

test('staff reply sends its operation key and retries a lost response without duplicating the message', async t => {
  const requests: RequestInit[] = []
  let savedKey: string | null = null, savedMessages = 0
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/v1/support/ticket-1/reply')
    requests.push(options)
    const key = new Headers(options.headers).get('Idempotency-Key')
    assert.ok(key)
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body as string), { text: 'Ответ сотрудника' })
    if (savedKey !== key) { savedMessages++; savedKey = key }
    if (requests.length === 1) throw new TypeError('Response lost after saving')
    return Response.json({ ok: true })
  })
  const reply = createSupportReply('ticket-1')
  await assert.rejects(reply('Ответ сотрудника'), /Response lost/)
  assert.deepEqual(await reply('Ответ сотрудника'), { ok: true })
  assert.equal(savedMessages, 1)
  assert.equal(new Headers(requests[0].headers).get('Idempotency-Key'), new Headers(requests[1].headers).get('Idempotency-Key'))
  await reply('Ответ сотрудника')
  assert.equal(savedMessages, 2, 'A new reply gets a new key even if its text is identical')
})

test('edited replies and different tickets do not reuse a failed operation key', async t => {
  const keys: string[] = []
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    keys.push(new Headers(options.headers).get('Idempotency-Key')!)
    return Response.json({ ok: false, message: 'Временная ошибка' }, { status: 503 })
  })
  const reply = createSupportReply('ticket-1')
  await assert.rejects(reply('Первый ответ'), /Временная ошибка/)
  await assert.rejects(reply('Изменённый ответ'))
  await assert.rejects(createSupportReply('ticket-2')('Изменённый ответ'))
  assert.equal(new Set(keys).size, 3)
})

test('double submit shares one request and blank replies never reach the server', async t => {
  let calls = 0
  let finish!: (response: Response) => void
  t.mock.method(globalThis, 'fetch', () => { calls++; return new Promise<Response>(resolve => { finish = resolve }) })
  const reply = createSupportReply('ticket-1')
  await assert.rejects(reply('   '), /Введите ответ/)
  assert.equal(calls, 0)
  const first = reply('Ответ'), second = reply('Ответ')
  assert.equal(first, second)
  assert.equal(calls, 1)
  finish(Response.json({ ok: true }))
  await Promise.all([first, second])
})

test('warehouse reads keep staff authentication without a client marker or operation key', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(options.method, 'GET')
    assert.equal(options.credentials, 'same-origin')
    assert.equal(new Headers(options.headers).has('X-WHM-Client'), false)
    assert.equal(new Headers(options.headers).has('Idempotency-Key'), false)
    return Response.json({ tickets: [] })
  })
  assert.deepEqual(await api('/v1/warehouse'), { tickets: [] })
})
