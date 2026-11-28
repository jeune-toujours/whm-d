'use client'
import { Archive, RefreshCw } from 'lucide-react'
import { ArchiveIntakeItem } from './ArchiveIntakeItem'
import { Button } from './ui/Button'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { BarcodeField } from './BarcodeField'
import { api, createSupportReply } from './warehouse-api'

type Mode = 'receive' | 'place' | 'pick' | 'return' | 'support'
const titles: Record<Mode, string> = { receive: 'Приёмка', place: 'Размещение', pick: 'Подбор', return: 'Выдача', support: 'Обращения клиентов' }
async function upload(file: File, owner: string, purpose: string) {
  const form = new FormData(); form.set('_payload', JSON.stringify({ owner, purpose })); form.set('file', file)
  const r = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body: form })
  const result = await r.json()
  if (!r.ok || !result.doc?.id) throw new Error('Не удалось сохранить файл. Повторите загрузку.')
  return result.doc.id as string
}

export function WarehousePanel({ mode }: { mode: Mode }) {
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const revision = useRef(0)
  const load = useCallback(async () => {
    const request = ++revision.current
    try {
      const next = await api('/v1/warehouse')
      if (request !== revision.current) return
      setData(next)
      setError('')
    } catch (failure) {
      if (request === revision.current) setError((failure as Error).message)
    }
  }, [])
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 10_000)
    return () => { clearInterval(timer); revision.current++ }
  }, [load])
  const perform = async (fn: () => Promise<unknown>) => { setLoading(true); setError(''); try { await fn(); await load() } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  const itemsById = new Map<string, any>((data?.items || []).map((item: any) => [item.id, item]))
  const itemStage: Partial<Record<Mode, string>> = { receive: 'expected', place: 'received', pick: 'reserved' }
  const orders = (data?.orders || []).filter((order: any) => {
    if (mode === 'return') return order.type === 'return' && order.backendStatus === 'ready'
    const queue = mode === 'receive' ? order.type === 'intake' && order.backendStatus === 'created'
      : mode === 'place' ? order.type === 'intake' && order.backendStatus === 'received'
      : mode === 'pick' && order.type === 'return' && ['created', 'picking'].includes(order.backendStatus)
    return queue && order.items.some((item: any) => itemsById.get(item.id)?.status === itemStage[mode])
  })
  return <Gutter><section className="whm-work">
    <div className="inventory-toolbar">
      <h1>{titles[mode]}</h1>
      <div className="whm-toolbar-actions">
        {mode === 'receive' && <Link className="problem-action" href="/admin/collections/storage-items?where%5Bstatus%5D%5Bequals%5D=archived"><Archive size={17} aria-hidden="true" />Архив приёмки</Link>}
        <Button onClick={() => void load()} disabled={loading}><RefreshCw size={17} aria-hidden="true" />Обновить очередь</Button>
      </div>
    </div>
    {error && <p className="whm-error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Загрузка…</p>}
    {mode === 'support' ? (data?.tickets || []).map((ticket: any) => <Ticket key={ticket.id} ticket={ticket} busy={loading} perform={perform} />) : orders.map((order: any) => <section key={order.id} className="whm-order"><h2>{order.number} · {order.statusLabel}</h2><p>{order.clientName || 'Клиент'} · {order.fulfillment === 'courier' ? 'Курьер' : 'Самостоятельная передача'} · {order.slot || 'Время не согласовано'}</p><p>{order.address}</p>
      {mode === 'return' ? <Handover order={order} busy={loading} perform={perform} /> : order.items.map((item: any) => {
        const actual = itemsById.get(item.id)
        if (!actual || actual.status !== itemStage[mode]) return null
        return <ItemOperation key={item.id} mode={mode} order={order} item={actual} cells={data.cells} busy={loading} perform={perform} refresh={load} />
      })}
    </section>)}
    {data && (mode === 'support' ? !data.tickets.length : !orders.length) && <p className="whm-empty">Очередь пуста.</p>}
  </section></Gutter>
}
type Perform = (fn: () => Promise<unknown>) => Promise<void>
function ItemOperation({ mode, order, item, cells, busy, perform, refresh }: { mode: Mode; order: any; item: any; cells: any[]; busy: boolean; perform: Perform; refresh: () => Promise<void> }) {
  const [barcode, setBarcode] = useState(''), [seal, setSeal] = useState(''), [sealFile, setSealFile] = useState<File | null>(null), [contents, setContents] = useState(''), [cell, setCell] = useState(''), [cellBarcode, setCellBarcode] = useState(''), [file, setFile] = useState<File | null>(null)
  const submit = () => perform(async () => {
    if (mode === 'receive') {
      if (!file) throw new Error('Добавьте фото или видео приёмки.')
      if ((item.type === 'box' || seal.trim()) && !sealFile) throw new Error('Добавьте фото пломбы с читаемым номером.')
      if (sealFile && !seal.trim()) throw new Error('Укажите номер сфотографированной пломбы.')
      const media = await upload(file, order.ownerID, 'intake')
      const sealPhoto = sealFile ? await upload(sealFile, order.ownerID, 'intake') : undefined
      await api(`/v1/warehouse/orders/${order.id}/receive`, { itemID: item.id, barcode, seal, sealPhoto, contents, evidence: [media] })
    } else if (mode === 'place') await api('/v1/warehouse/place', { orderID: order.id, itemID: item.id, barcode, cellID: cell, cellBarcode })
    else await api(`/v1/warehouse/orders/${order.id}/pick`, { itemID: item.id, barcode })
  })
  return <div className="whm-operation"><form onSubmit={e => { e.preventDefault(); void submit() }}><h3>{item.title} · {item.internalID}</h3><p>{item.description} {item.cellName ? `· Ячейка ${item.cellName}` : ''}</p>
    {mode === 'receive' && <p><Link href={`/admin/warehouse/problems?new=1&orderID=${order.id}&itemID=${item.id}`}>Зафиксировать повреждение при поступлении</Link></p>}
    {mode !== 'receive' && <p>Ожидаемый штрихкод: <code>{item.barcode}</code></p>}
    {mode !== 'receive' && item.sealPhoto?.url && <p>Пломба: {item.seal} · <a href={item.sealPhoto.url} target="_blank" rel="noopener noreferrer">Открыть фото пломбы</a></p>}
    <BarcodeField label="Скан вещи" value={barcode} onChange={setBarcode} disabled={busy} />
    {mode === 'receive' && <><label>Номер пломбы{item.type === 'box' ? ' (обязательно)' : ''}<input required={item.type === 'box' || Boolean(sealFile)} disabled={busy} value={seal} onChange={e => setSeal(e.target.value)} /></label>
      <label>Фото пломбы{item.type === 'box' ? ' (обязательно)' : ''}<input required={item.type === 'box' || Boolean(seal.trim())} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => setSealFile(e.target.files?.[0] || null)} /></label>
      <p>Сфотографируйте пломбу крупно, чтобы её номер был читаемым. Это отдельный снимок от общего фото приёмки.</p>
      <label>Опись<textarea value={contents} onChange={e => setContents(e.target.value)} placeholder="Каждая позиция с новой строки" /></label><label>Фото или видео<input required type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e => setFile(e.target.files?.[0] || null)} /></label></>}
    {mode === 'place' && <><label htmlFor={`cell-${item.id}`}>Ячейка</label><select id={`cell-${item.id}`} required value={cell} onChange={e => setCell(e.target.value)}><option value="">Выберите ячейку</option>{cells.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name} · {c.occupied}/{c.capacity} · {c.barcode}</option>)}</select><BarcodeField label="Скан ячейки" value={cellBarcode} onChange={setCellBarcode} disabled={busy} /></>}
    <Button type="submit" variant="default" disabled={busy}>{busy ? 'Сохранение…' : mode === 'receive' ? 'Принять' : mode === 'place' ? 'Разместить' : 'Подобрать'}</Button>
  </form>
    {mode === 'receive' && <div className="whm-operation-secondary">
      <ArchiveIntakeItem orderID={order.id} item={item} busy={busy} refresh={refresh} />
    </div>}
  </div>
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
    <Button type="button" onClick={() => { canvas.current?.getContext('2d')?.clearRect(0, 0, 600, 180); setSigned(false) }}>Очистить подпись</Button>
    <label className="whm-checkbox"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Все вещи переданы получателю</label>
    <p>Подпись фиксирует тестовую операцию. Юридический шаблон акта ещё не утверждён.</p><Button type="submit" variant="default" disabled={busy}>Завершить выдачу</Button>
  </form>
}
function Ticket({ ticket, busy, perform }: { ticket: any; busy: boolean; perform: Perform }) {
  const [message, setMessage] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [reply] = useState(() => createSupportReply(ticket.id))
  const closed = ['resolved', 'rejected'].includes(ticket.status)
  return <section className="whm-order"><h2>{ticket.subject}</h2><p>{ticket.type} · {ticket.status}</p>{ticket.messages.map((m: any, i: number) => <p key={i}><strong>{m.author === 'client' ? 'Клиент' : 'Сотрудник'}</strong> · {m.date}<br />{m.text}</p>)}
    {ticket.attachments?.map((file: any, i: number) => <p key={i}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.filename}</a></p>)}
    {closed ? <p className="whm-close-reason"><strong>Причина закрытия:</strong> {ticket.closeReason || 'Не указана'}</p> : <>
      <form className="whm-support-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await reply(message); setMessage('') }) }}>
        <label htmlFor={`reply-${ticket.id}`}>Ответ клиенту</label>
        <textarea id={`reply-${ticket.id}`} required disabled={busy} value={message} onChange={e => setMessage(e.target.value)} />
        <Button disabled={busy || !message.trim()} type="submit" variant="default">Ответить</Button>
      </form>
      <form className="whm-support-form" onSubmit={e => { e.preventDefault(); if (!closeReason.trim()) return; void perform(() => api(`/support-tickets/${ticket.id}`, { status: 'resolved', closeReason: closeReason.trim() }, 'PATCH')) }}>
        <label htmlFor={`close-reason-${ticket.id}`}>Причина закрытия обращения</label>
        <textarea id={`close-reason-${ticket.id}`} required disabled={busy} value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder="Опишите, почему обращение закрыто" />
        <Button disabled={busy || !closeReason.trim()} type="submit" variant="default">Закрыть обращение</Button>
      </form>
    </>}
  </section>
}
