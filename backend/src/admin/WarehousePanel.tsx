'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Gutter } from '@payloadcms/ui'
import './warehouse.css'

type Mode = 'receive' | 'place' | 'pick' | 'return' | 'support'
const titles: Record<Mode, string> = { receive: 'Приёмка', place: 'Размещение', pick: 'Подбор', return: 'Выдача', support: 'Обращения клиентов' }
async function api(path: string, data?: unknown, method = 'POST') {
  const r = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : method, credentials: 'same-origin', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) })
  const result = await r.json()
  if (!r.ok || result.ok === false) throw new Error(result.message || result.errors?.[0]?.message || 'Не удалось выполнить операцию.')
  return result
}
async function upload(file: File, owner: string, purpose: string) {
  const form = new FormData(); form.set('_payload', JSON.stringify({ owner, purpose })); form.set('file', file)
  const r = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body: form })
  const result = await r.json()
  if (!r.ok || !result.doc?.id) throw new Error('Не удалось сохранить файл. Повторите загрузку.')
  return result.doc.id as string
}

export function WarehousePanel({ mode }: { mode: Mode }) {
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const load = useCallback(async () => { try { const d = await api('/v1/warehouse'); setData(d); setError('') } catch (e) { setError((e as Error).message) } }, [])
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 10_000); return () => clearInterval(timer) }, [load])
  const perform = async (fn: () => Promise<unknown>) => { setLoading(true); setError(''); try { await fn(); await load() } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  const orders = (data?.orders || []).filter((o: any) => mode === 'receive' ? o.type === 'intake' && o.backendStatus === 'created' : mode === 'place' ? o.type === 'intake' && o.backendStatus === 'received' : mode === 'pick' ? o.type === 'return' && ['created', 'picking'].includes(o.backendStatus) : o.type === 'return' && o.backendStatus === 'ready')
  return <Gutter><section className="whm-work"><h1>{titles[mode]}</h1><p>Изменения сохраняются на сервере. Для каждой операции проверяются права, штрихкоды и текущий статус.</p>
    <button onClick={() => void load()} disabled={loading}>Обновить очередь</button>
    {error && <p className="whm-error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Загрузка…</p>}
    {mode === 'support' ? (data?.tickets || []).map((ticket: any) => <Ticket key={ticket.id} ticket={ticket} busy={loading} perform={perform} />) : orders.map((order: any) => <section key={order.id} className="whm-order"><h2>{order.number} · {order.statusLabel}</h2><p>{order.clientName || 'Клиент'} · {order.fulfillment === 'courier' ? 'Курьер' : 'Самостоятельная передача'} · {order.slot || 'Время не согласовано'}</p><p>{order.address}</p>
      {mode === 'return' ? <Handover order={order} busy={loading} perform={perform} /> : order.items.map((item: any) => {
        const actual = data.items.find((i: any) => i.id === item.id)
        if (!actual || (mode === 'receive' && actual.status !== 'expected') || (mode === 'place' && actual.status !== 'received') || (mode === 'pick' && actual.status !== 'reserved')) return null
        return <ItemOperation key={item.id} mode={mode} order={order} item={actual} cells={data.cells} busy={loading} perform={perform} />
      })}
    </section>)}
    {data && (mode === 'support' ? !data.tickets.length : !orders.length) && <p className="whm-empty">Очередь пуста.</p>}
  </section></Gutter>
}
type Perform = (fn: () => Promise<unknown>) => Promise<void>
function ItemOperation({ mode, order, item, cells, busy, perform }: { mode: Mode; order: any; item: any; cells: any[]; busy: boolean; perform: Perform }) {
  const [barcode, setBarcode] = useState(''), [seal, setSeal] = useState(''), [contents, setContents] = useState(''), [cell, setCell] = useState(''), [cellBarcode, setCellBarcode] = useState(''), [file, setFile] = useState<File | null>(null)
  const submit = () => perform(async () => {
    if (mode === 'receive') {
      if (!file) throw new Error('Добавьте фото или видео приёмки.')
      const media = await upload(file, order.ownerID, 'intake')
      await api(`/v1/warehouse/orders/${order.id}/receive`, { itemID: item.id, barcode, seal, contents, evidence: [media] })
    } else if (mode === 'place') await api('/v1/warehouse/place', { orderID: order.id, itemID: item.id, barcode, cellID: cell, cellBarcode })
    else await api(`/v1/warehouse/orders/${order.id}/pick`, { itemID: item.id, barcode })
  })
  return <form className="whm-operation" onSubmit={e => { e.preventDefault(); void submit() }}><h3>{item.title} · {item.internalID}</h3><p>{item.description} {item.cellName ? `· Ячейка ${item.cellName}` : ''}</p>
    {mode !== 'receive' && <p>Ожидаемый штрихкод: <code>{item.barcode}</code></p>}
    <label>Скан вещи<input required autoComplete="off" value={barcode} onChange={e => setBarcode(e.target.value)} /></label>
    {mode === 'receive' && <><label>Пломба{item.type === 'box' ? ' (обязательно)' : ''}<input required={item.type === 'box'} value={seal} onChange={e => setSeal(e.target.value)} /></label><label>Опись<textarea value={contents} onChange={e => setContents(e.target.value)} placeholder="Каждая позиция с новой строки" /></label><label>Фото или видео<input required type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e => setFile(e.target.files?.[0] || null)} /></label></>}
    {mode === 'place' && <><label>Ячейка<select required value={cell} onChange={e => setCell(e.target.value)}><option value="">Выберите ячейку</option>{cells.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name} · {c.occupied}/{c.capacity} · {c.barcode}</option>)}</select></label><label>Скан ячейки<input required value={cellBarcode} onChange={e => setCellBarcode(e.target.value)} /></label></>}
    <button type="submit" disabled={busy}>{busy ? 'Сохранение…' : mode === 'receive' ? 'Принять' : mode === 'place' ? 'Разместить' : 'Подобрать'}</button>
  </form>
}
function Handover({ order, busy, perform }: { order: any; busy: boolean; perform: Perform }) {
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), [signed, setSigned] = useState(false), [confirmed, setConfirmed] = useState(false), [file, setFile] = useState<File | null>(null)
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [(e.clientX - r.left) * 600 / r.width, (e.clientY - r.top) * 180 / r.height] }
  return <form className="whm-operation" onSubmit={e => { e.preventDefault(); void perform(async () => {
    if (!file || !signed || !confirmed) throw new Error('Нужны фото, подпись и подтверждение передачи.')
    const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(b => b ? resolve(b) : reject(new Error('Не удалось сохранить подпись.')), 'image/png'))
    const evidence = await upload(file, order.ownerID, 'return'), signature = await upload(new File([blob], `signature-${order.number}.png`, { type: 'image/png' }), order.ownerID, 'signature')
    await api(`/v1/warehouse/orders/${order.id}/complete`, { signature, evidence: [evidence] })
  }) }}>
    <ul>{order.items.map((i: any) => <li key={i.id}>{i.name} · {i.internalID}</li>)}</ul>
    <label>Фото или видео выдачи<input required type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
    <label>Подпись получателя<canvas ref={canvas} width={600} height={180} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const ctx = e.currentTarget.getContext('2d')!; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...point(e) as [number, number]); drawing.current = true }} onPointerMove={e => { if (!drawing.current) return; const ctx = e.currentTarget.getContext('2d')!; ctx.lineTo(...point(e) as [number, number]); ctx.stroke(); setSigned(true) }} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} /></label>
    <button type="button" onClick={() => { canvas.current?.getContext('2d')?.clearRect(0, 0, 600, 180); setSigned(false) }}>Очистить подпись</button>
    <label className="whm-checkbox"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Все вещи переданы получателю</label>
    <p>Подпись фиксирует тестовую операцию. Юридический шаблон акта ещё не утверждён.</p><button type="submit" disabled={busy}>Завершить выдачу</button>
  </form>
}
function Ticket({ ticket, busy, perform }: { ticket: any; busy: boolean; perform: Perform }) {
  const [message, setMessage] = useState('')
  return <section className="whm-order"><h2>{ticket.subject}</h2><p>{ticket.type} · {ticket.status}</p>{ticket.messages.map((m: any, i: number) => <p key={i}><strong>{m.author === 'client' ? 'Клиент' : 'Сотрудник'}</strong> · {m.date}<br />{m.text}</p>)}
    {ticket.attachments?.map((file: any, i: number) => <p key={i}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.filename}</a></p>)}
    {ticket.status !== 'resolved' && <form onSubmit={e => { e.preventDefault(); void perform(async () => { await api(`/v1/support/${ticket.id}/reply`, { text: message }); setMessage('') }) }}><label>Ответ клиенту<textarea required value={message} onChange={e => setMessage(e.target.value)} /></label><button disabled={busy} type="submit">Ответить</button><button disabled={busy} type="button" onClick={() => void perform(() => api(`/support-tickets/${ticket.id}`, { status: 'resolved' }, 'PATCH'))}>Закрыть обращение</button></form>}
  </section>
}
