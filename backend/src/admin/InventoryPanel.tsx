'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Gutter, useAuth } from '@payloadcms/ui'
import { ArrowLeft, Plus, RefreshCw, CheckCircle, TriangleAlert } from 'lucide-react'
import { api } from './warehouse-api'
import { BarcodeField } from './BarcodeField'
import type { InventoryCellOption, InventoryCheck, InventoryDetail, InventoryOperation } from '../inventory-types'
import './warehouse.css'

const root = '/admin/warehouse/inventory'
const date = (value?: string | null) => value ? new Date(value).toLocaleString('ru-RU') : '—'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос.'
const discrepancyNames = { missing: 'Отсутствует', extra: 'Лишняя вещь', wrong_cell: 'Не в ожидаемой ячейке' }

export function InventoryPanel() {
  const { user } = useAuth()
  const router = useRouter(), params = useSearchParams(), sessionID = params.get('session') || ''
  const [detail, setDetail] = useState<InventoryDetail | null>(null), [operations, setOperations] = useState<InventoryOperation[]>([])
  const [state, setState] = useState('open'), [page, setPage] = useState(1), [pages, setPages] = useState(1)
  const [canCreate, setCanCreate] = useState(false), [creating, setCreating] = useState(false)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true, inFlight = false
    setLoading(true); setError(''); setDetail(null)
    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const result = await api(sessionID ? `/v1/inventory/${encodeURIComponent(sessionID)}` : `/v1/inventory?state=${state}&page=${page}`)
        if (!active) return
        if (sessionID) setDetail(result as InventoryDetail)
        else { setOperations(result.operations); setCanCreate(result.canCreate); setPages(result.totalPages) }
        setError('')
      } catch (e) { if (active) setError(errorMessage(e)) }
      finally { inFlight = false; if (active) setLoading(false) }
    }
    void load()
    const timer = setInterval(() => { if (!document.hidden) void load() }, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [sessionID, state, page, revision])
  return <Gutter><section className="whm-work whm-inventory">
    <div className="inventory-toolbar"><h1>Инвентаризация</h1><button type="button" onClick={() => setRevision(n => n + 1)} aria-label="Обновить инвентаризации"><RefreshCw size={18} aria-hidden="true" /> Обновить</button></div>
    <p>Ручная сверка выбранных ячеек. Результат сохраняется отдельно и не изменяет размещение вещей.</p>
    {error && <p role="alert" className="whm-error">{error}</p>}
    {loading && <p role="status">Загрузка…</p>}
    {sessionID ? <>
      <Link href={root} className="inventory-back"><ArrowLeft size={18} aria-hidden="true" /> К списку инвентаризаций</Link>
      {detail && <>
        <section className="whm-order" aria-label="Прогресс инвентаризации">
          <h2>{detail.operation.number}</h2><p><strong>{detail.operation.statusLabel}</strong> · {detail.operation.warehouseNames}</p>
          <p role="status">Проверено {detail.operation.checkedCount}/{detail.operation.cellCount} · Ячеек с расхождениями: {detail.operation.discrepancyCount}</p>
          <progress value={detail.operation.checkedCount} max={detail.operation.cellCount} aria-label="Проверено ячеек" />
          <p>Инициатор: {detail.operation.initiatorName} · Снимок: {date(detail.operation.startedAt)}</p>
          {detail.operation.completedAt && <p>Завершена: {date(detail.operation.completedAt)}</p>}
          <p className="inventory-note">Сверяем с учётом на момент запуска. Размещение, подбор и выдача продолжают работать.</p>
        </section>
        {detail.cells.map(check => <section className="whm-order inventory-check" key={check.id} aria-label={`Ячейка ${check.cellLabel}`}>
          <h2>{check.cellLabel}</h2><p>{check.warehouseName}{check.zone ? ` · Зона ${check.zone}` : ''} · {check.cellBarcode}</p>
          <p><strong>{check.statusLabel}</strong> · Ожидалось вещей: {check.expectedItems.length}</p>
          {check.status === 'pending' ? <CellCheck key={`${check.id}:pending`} sessionID={sessionID} check={check} onSaved={setDetail} /> : <>
            <p>Проверил: {check.checkedByID && ['admin', 'manager'].includes(user?.role) ? <Link href={`/admin/collections/users/${check.checkedByID}`}>{check.checkedByName}</Link> : check.checkedByName} · {date(check.checkedAt)}</p>
            {check.accountingChanged && <p className="inventory-note"><TriangleAlert size={18} aria-hidden="true" /> Учёт изменился после запуска. Результат относится к сохранённому снимку; перемещения не исправлялись автоматически.</p>}
            {check.discrepancies.length ? <ul className="inventory-discrepancies">{check.discrepancies.map((d, i) => <li key={`${d.type}:${d.code}:${i}`}><strong>{discrepancyNames[d.type]}</strong>: {d.title} · {d.code}{d.expectedCellID && d.expectedCellID !== check.cellID ? <> · <Link href={`/admin/collections/cells/${d.expectedCellID}`}>Учётная ячейка</Link></> : null}</li>)}</ul> : <p className="inventory-matched"><CheckCircle size={18} aria-hidden="true" /> Содержимое соответствует снимку</p>}
            {check.comment && <p className="inventory-comment">{check.comment}</p>}
            <details><summary>Ожидаемое и фактическое содержимое</summary>
              <h3>Снимок запуска</h3>{check.expectedItems.length ? <ul>{check.expectedItems.map(item => <li key={item.id}>{item.title} · {item.internalID} · {item.barcode || 'Без штрихкода'}</li>)}</ul> : <p>Ячейка ожидалась пустой.</p>}
              <h3>Фактически отмечено</h3>{check.observedItems.length ? <ul>{check.observedItems.map((item, i) => <li key={i}>{item.title} · {item.code}</li>)}</ul> : <p>Ничего не отмечено.</p>}
            </details>
          </>}
        </section>)}
      </>}
    </> : <>
      <div className="inventory-toolbar"><label>Показать<select value={state} onChange={e => { setState(e.target.value); setPage(1) }}><option value="open">В работе</option><option value="closed">История</option><option value="all">Все операции</option></select></label>
        {canCreate && <button type="button" onClick={() => setCreating(value => !value)}><Plus size={18} aria-hidden="true" /> {creating ? 'Скрыть создание' : 'Создать инвентаризацию'}</button>}
      </div>
      {creating && canCreate && <InventoryCreate onCreated={id => { setCreating(false); router.push(`${root}?session=${id}`) }} />}
      {!loading && !operations.length && <p className="whm-empty">Инвентаризаций в этом списке пока нет.</p>}
      {operations.map(operation => <article className="whm-order" key={operation.id}>
        <h2><Link href={`${root}?session=${operation.id}`}>{operation.number}</Link></h2>
        <p><strong>{operation.statusLabel}</strong> · {operation.warehouseNames}</p>
        <p>Проверено {operation.checkedCount}/{operation.cellCount} · Расхождения: {operation.discrepancyCount}</p>
        <p>Инициатор: {operation.initiatorName} · {date(operation.startedAt)}</p>
      </article>)}
      <Pagination page={page} pages={pages} onChange={setPage} />
    </>}
  </section></Gutter>
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return pages > 1 ? <nav aria-label="Страницы" className="inventory-toolbar"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Назад</button><span>{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Далее</button></nav> : null
}

function InventoryCreate({ onCreated }: { onCreated: (id: string) => void }) {
  const [search, setSearch] = useState(''), [warehouse, setWarehouse] = useState(''), [zone, setZone] = useState(''), [page, setPage] = useState(1)
  const [catalog, setCatalog] = useState<{ cells: InventoryCellOption[]; warehouses: Array<{ id: string; name: string }>; totalPages: number }>({ cells: [], warehouses: [], totalPages: 1 })
  const [selected, setSelected] = useState<Record<string, InventoryCellOption>>({}), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const pending = useRef<{ signature: string; key: string } | null>(null), inFlight = useRef(false)
  useEffect(() => {
    let active = true; setLoading(true)
    const timer = setTimeout(() => { void api(`/v1/inventory/cells?${new URLSearchParams({ search, warehouseID: warehouse, zone, page: String(page) })}`).then(result => { if (active) setCatalog(result) }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) }) }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [search, warehouse, zone, page, revision])
  const chosen = Object.values(selected)
  const toggle = (cell: InventoryCellOption) => {
    setError('')
    if (!selected[cell.id] && chosen.length >= 200) { setError('За один запуск можно выбрать до 200 ячеек.'); return }
    setSelected(current => { const next = { ...current }; if (next[cell.id]) delete next[cell.id]; else next[cell.id] = cell; return next })
  }
  return <form className="whm-order" aria-label="Создание инвентаризации" onSubmit={async event => {
    event.preventDefault(); if (inFlight.current || !chosen.length) return
    const cellIDs = chosen.map(cell => cell.id).sort(), signature = JSON.stringify(cellIDs)
    if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() }
    inFlight.current = true; setBusy(true); setError('')
    try { const result = await api('/v1/inventory', { cellIDs }, 'POST', pending.current!.key); pending.current = null; onCreated(result.operation.id) }
    catch (e) { setError(errorMessage(e)); setRevision(n => n + 1) }
    finally { inFlight.current = false; setBusy(false) }
  }}>
    <h2>Выбор ячеек</h2>
    <div className="inventory-filters"><label>Поиск ячейки<input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Адрес, штрихкод или зона" /></label>
      <label>Склад<select value={warehouse} onChange={e => { setWarehouse(e.target.value); setPage(1) }}><option value="">Все склады</option>{catalog.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label>Зона<input value={zone} onChange={e => { setZone(e.target.value); setPage(1) }} placeholder="Точное название зоны" /></label>
    </div>
    {loading && <p role="status">Загрузка каталога…</p>}
    <div className="inventory-catalog">{catalog.cells.map(cell => <div className="inventory-cell-option" key={cell.id}>
      <label className="whm-checkbox"><input type="checkbox" aria-label={`Выбрать ячейку ${cell.name}`} checked={Boolean(selected[cell.id])} disabled={busy || Boolean(cell.inventoryID && !selected[cell.id])} onChange={() => toggle(cell)} /><span><strong>{cell.name}</strong><br />{cell.warehouseName}{cell.zone ? ` · ${cell.zone}` : ''}<br /><small>{cell.barcode}{!cell.active ? ' · Неактивная ячейка' : ''}</small></span></label>
      {cell.inventoryID && <Link href={`${root}?session=${cell.inventoryID}`}>Открытая инвентаризация {cell.inventoryNumber}</Link>}
    </div>)}</div>
    {!loading && !catalog.cells.length && <p>Ячейки не найдены. Измените фильтры.</p>}
    <Pagination page={page} pages={catalog.totalPages} onChange={setPage} />
    <div className="inventory-selection"><h3 role="status">Выбрано ячеек: {chosen.length}</h3>{chosen.length > 0 && <ul>{chosen.map(cell => <li key={cell.id}>{cell.warehouseName} / {cell.zone || 'Без зоны'} / {cell.name}<button type="button" disabled={busy} aria-label={`Убрать ячейку ${cell.name}`} onClick={() => toggle(cell)}>Убрать</button></li>)}</ul>}</div>
    {error && <p role="alert" className="whm-error">{error}</p>}
    <button type="submit" disabled={busy || !chosen.length}>{busy ? 'Создаём…' : 'Запустить инвентаризацию'}</button>
    <p className="inventory-note">Одна операция по выбранным ячейкам. Содержимое сохраняется снимком; автоматических исправлений учёта нет.</p>
  </form>
}

function CellCheck({ sessionID, check, onSaved }: { sessionID: string; check: InventoryCheck; onSaved: (result: InventoryDetail) => void }) {
  const [present, setPresent] = useState(() => new Set(check.expectedItems.map(item => item.barcode || item.internalID)))
  const [extras, setExtras] = useState(''), [scan, setScan] = useState(''), [comment, setComment] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef<{ signature: string; key: string } | null>(null), inFlight = useRef(false)
  const addCode = () => {
    const code = scan.trim(); if (!code) return
    const item = check.expectedItems.find(item => item.barcode === code || item.internalID === code)
    if (item) setPresent(current => new Set([...current, item.barcode || item.internalID]))
    else setExtras(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), code])].join('\n'))
    setScan('')
  }
  return <form className="whm-operation" onSubmit={async event => {
    event.preventDefault(); if (inFlight.current) return
    const codes = [...new Set([...present, ...extras.split(/\r?\n/).map(c => c.trim()).filter(Boolean), ...(scan.trim() ? [scan.trim()] : [])])].sort(), data = { observedCodes: codes, comment: comment.trim() }, signature = JSON.stringify(data)
    if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() }
    inFlight.current = true; setBusy(true); setError('')
    try { const result = await api(`/v1/inventory/${sessionID}/cells/${check.id}`, data, 'POST', pending.current!.key); pending.current = null; onSaved(result) }
    catch (e) { setError(errorMessage(e)) }
    finally { inFlight.current = false; setBusy(false) }
  }}>
    <fieldset disabled={busy}>
      <legend>Сверьте фактическое содержимое</legend>
      {check.expectedItems.length ? <><p>Снимите отметку с отсутствующих вещей:</p>{check.expectedItems.map(item => {
        const code = item.barcode || item.internalID
        return <label className="whm-checkbox" key={item.id}><input type="checkbox" checked={present.has(code)} onChange={() => setPresent(current => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next })} /><span>На месте: {item.title} · {item.internalID} · {code}</span></label>
      })}</> : <p>По снимку ячейка пустая. Подтвердите пустую ячейку или добавьте обнаруженные коды.</p>}
      <BarcodeField label="Добавить найденный код" value={scan} onChange={setScan} required={false} disabled={busy} onEnter={addCode} />
      <button type="button" disabled={!scan.trim()} onClick={addCode}>Добавить код</button>
      <label>Дополнительные коды — по одному в строке<textarea value={extras} onChange={e => setExtras(e.target.value)} placeholder="Штрихкод или внутренний номер найденной вещи" /></label>
      <label>Комментарий к проверке<textarea maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} placeholder="При расхождении укажите, что обнаружено" /></label>
      <p className="inventory-note">Без изменений и дополнительных кодов подтверждается соответствие. Неотмеченные вещи сохранятся как недостача. Для расхождения нужен комментарий.</p>
      {error && <p role="alert" className="whm-error">{error}</p>}
      <button type="submit">{busy ? 'Сохраняем…' : 'Сохранить проверку'}</button>
    </fieldset>
  </form>
}
