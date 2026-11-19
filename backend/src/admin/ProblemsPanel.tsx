'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Gutter } from '@payloadcms/ui'
import { ArrowLeft, Plus, RefreshCw, TriangleAlert } from 'lucide-react'
import { api } from './warehouse-api'
import './warehouse.css'

const root = '/admin/warehouse/problems'
const date = (value: string) => new Date(value).toLocaleString('ru-RU')
type Summary = { id: string; number: string; orderNumber: string; itemLabel: string; createdAt: string }
type Report = Summary & { orderID: string; itemID: string; description: string; createdByName: string; ticketID: string; evidence: { id: string; filename: string; url: string }[] }
type Intake = { id: string; number: string; ownerID: string; items: { id: string; title: string; internalID: string }[] }

export function ProblemsPanel() {
  const params = useSearchParams(), router = useRouter(), id = params.get('report') || '', creating = params.get('new') === '1'
  const [reports, setReports] = useState<Summary[]>([]), [report, setReport] = useState<Report | null>(null)
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(1), [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setReport(null)
    if (creating) { setLoading(false); return }
    const timer = setTimeout(() => {
      void api(id ? `/v1/problems/${encodeURIComponent(id)}` : `/v1/problems?${new URLSearchParams({ search, page: String(page) })}`)
        .then(result => { if (!active) return; if (id) setReport(result.report); else { setReports(result.reports); setPages(result.totalPages); setTotal(result.total) } })
        .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    }, 150)
    return () => { active = false; clearTimeout(timer) }
  }, [id, creating, search, page, revision])
  return <Gutter><section className="whm-work whm-problems">
    <div className="inventory-toolbar"><h1>Проблемные заказы</h1>{!creating && !id && <Link className="problem-action" href={`${root}?new=1`}><Plus size={18} aria-hidden />Зафиксировать повреждение</Link>}{!creating && <button onClick={() => setRevision(v => v + 1)} disabled={loading}><RefreshCw size={18} aria-hidden />Обновить</button>}</div>
    <p>Повреждения, обнаруженные при поступлении. Запись сразу сохраняется в истории вещи и заказа; клиент видит сообщение в поддержке.</p>
    <p className="inventory-note">Операционная фиксация. Юридическая форма акта ещё не утверждена.</p>
    {(id || creating) && <Link className="inventory-back" href={root}><ArrowLeft size={18} aria-hidden />К списку</Link>}
    {error && <p role="alert" className="whm-error">{error}</p>}
    {!creating && !id && <label>Поиск по номеру акта, заказа или вещи<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>}
    {creating ? <ProblemForm key={`${params.get('orderID')}:${params.get('itemID')}:${revision}`} initialOrder={params.get('orderID') || ''} initialItem={params.get('itemID') || ''} onSaved={value => router.push(`${root}?report=${encodeURIComponent(value)}`)} /> : loading ? <p role="status">Загрузка…</p> : id ? report && <ReportDetail report={report} /> : <>
      <p>Найдено: {total}</p>{reports.map(r => <article className="whm-order" key={r.id}><h2><Link href={`${root}?report=${r.id}`}>{r.number}</Link></h2><p>{r.orderNumber} · {r.itemLabel}</p><p>{date(r.createdAt)} · Зафиксировано</p></article>)}
      {!reports.length && !error && <p className="whm-empty">Записей не найдено.</p>}
      <nav aria-label="Страницы проблемных заказов"><button disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Назад</button><span>{page} / {Math.max(1, pages)}</span><button disabled={page >= pages} onClick={() => setPage(v => v + 1)}>Далее</button></nav>
    </>}
  </section></Gutter>
}

function ReportDetail({ report }: { report: Report }) {
  return <article className="whm-order"><h2><TriangleAlert size={22} aria-hidden /> {report.number}</h2><p>Зафиксировано {date(report.createdAt)} · {report.createdByName}</p>
    <p><Link href={`/admin/collections/orders/${report.orderID}`}>{report.orderNumber}</Link> · <Link href={`/admin/collections/storage-items/${report.itemID}`}>{report.itemLabel}</Link></p>
    <p><strong>Обнаружено при поступлении</strong></p><p className="inventory-comment">{report.description}</p>
    {report.evidence.length > 0 && <><h3>Материалы</h3><ul>{report.evidence.map(file => <li key={file.id}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.filename}</a></li>)}</ul></>}
    <p>Уведомление сохранено в личном кабинете клиента. Реальные SMS и email не отправляются.</p><Link href={`/admin/collections/support-tickets/${report.ticketID}`}>Открыть обращение клиента</Link>
  </article>
}

function ProblemForm({ initialOrder, initialItem, onSaved }: { initialOrder: string; initialItem: string; onSaved: (id: string) => void }) {
  const [orders, setOrders] = useState<Intake[]>([]), [orderID, setOrderID] = useState(initialOrder), [itemID, setItemID] = useState(initialItem)
  const [description, setDescription] = useState(''), [files, setFiles] = useState<File[]>([]), [discovered, setDiscovered] = useState(false)
  const [evidenceEnabled, setEvidenceEnabled] = useState(false)
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(1), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const uploaded = useRef(new Map<File, { owner: string; id: string }>()), pending = useRef<{ hash: string; key: string } | null>(null), saving = useRef(false)
  const order = orders.find(o => o.id === orderID)
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    const timer = setTimeout(() => {
      void api(`/v1/problems/context?${new URLSearchParams({ ...(initialOrder ? { orderID: initialOrder } : {}), search, page: String(page) })}`)
        .then(result => { if (active) { setOrders(result.orders); setPages(result.totalPages); setEvidenceEnabled(result.evidenceEnabled) } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [initialOrder, search, page])
  const save = async () => {
    if (saving.current) return
    saving.current = true; setBusy(true); setError('')
    try {
      if (!order || !order.items.some(i => i.id === itemID)) throw new Error('Выберите приёмку и вещь из её состава.')
      if (!description.trim() || !discovered) throw new Error('Опишите повреждение и отметьте, что оно обнаружено при поступлении.')
      const evidence: string[] = []
      for (const file of evidenceEnabled ? files : []) {
        let media = uploaded.current.get(file)
        if (!media || media.owner !== order.ownerID) {
          const form = new FormData(); form.set('_payload', JSON.stringify({ owner: order.ownerID, purpose: 'intake' })); form.set('file', file)
          const response = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body: form }), result = await response.json()
          if (!response.ok || !result.doc?.id) throw new Error('Не удалось загрузить материал. Повторите сохранение; уже загруженные файлы сохранятся.')
          media = { owner: order.ownerID, id: result.doc.id }; uploaded.current.set(file, media)
        }
        evidence.push(media.id)
      }
      const data = { orderID, itemID, description, discoveredAtIntake: discovered, evidence }, hash = JSON.stringify(data)
      if (pending.current?.hash !== hash) pending.current = { hash, key: crypto.randomUUID() }
      const result = await api('/v1/problems', data, 'POST', pending.current!.key)
      onSaved(result.report.id)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false); saving.current = false }
  }
  return <form className="whm-order" onSubmit={e => { e.preventDefault(); void save() }}><h2>Зафиксировать повреждение</h2>
    <fieldset disabled={busy}>
      {!initialOrder && <><label>Найти приёмку по номеру<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setOrderID(''); setItemID('') }} /></label><div><button type="button" disabled={page <= 1 || loading} onClick={() => { setPage(v => v - 1); setOrderID(''); setItemID('') }}>Назад</button><span>{page} / {Math.max(1, pages)}</span><button type="button" disabled={page >= pages || loading} onClick={() => { setPage(v => v + 1); setOrderID(''); setItemID('') }}>Далее</button></div></>}
      {loading && <p role="status">Загрузка приёмок…</p>}
      <label>Приёмка<select required disabled={loading} value={orderID} onChange={e => { setOrderID(e.target.value); setItemID('') }}><option value="">Выберите приёмку</option>{orders.map(o => <option key={o.id} value={o.id}>{o.number}</option>)}</select></label>
      {!loading && !orders.length && <p>Подходящих приёмок нет. Фиксация доступна до размещения вещи на хранение.</p>}
      <label>Вещь<select required disabled={loading || !order} value={itemID} onChange={e => setItemID(e.target.value)}><option value="">Выберите вещь</option>{order?.items.map(i => <option key={i.id} value={i.id}>{i.title} · {i.internalID}</option>)}</select></label>
      <label>Опись повреждения<textarea required maxLength={5000} rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Что повреждено, где и как это обнаружили" /></label>
      {evidenceEnabled ? <label>Фото, видео или документы — до 5 файлов, каждый до 25 МБ<input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" onChange={e => { const next = Array.from(e.target.files || []); if (next.length > 5 || next.some(f => f.size > 25 * 1024 * 1024)) { setError('Допускается до 5 файлов, каждый не больше 25 МБ.'); e.target.value = ''; setFiles([]) } else { setFiles(next); setError('') } }} /></label> : !loading && <p className="inventory-note">Материалы временно недоступны. Можно сохранить описание повреждения без файлов.</p>}
      <label className="whm-checkbox"><input type="checkbox" required checked={discovered} onChange={e => setDiscovered(e.target.checked)} />Повреждение обнаружено при поступлении</label>
      {error && <p role="alert" className="whm-error">{error}</p>}<p>Описание и материалы сохранятся без согласования. Клиент получит сообщение в поддержке.</p>
      <button type="submit" disabled={loading || !order}>{busy ? 'Сохранение…' : 'Сохранить и уведомить клиента'}</button>
    </fieldset>
  </form>
}
