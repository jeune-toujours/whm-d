'use client'

import { useId, useRef, useState } from 'react'
import { Archive } from 'lucide-react'
import { Button } from './ui/Button'
import { api } from './warehouse-api'

type Props = {
  orderID: string
  item: { id: string; title: string; internalID: string }
  busy: boolean
  refresh: () => Promise<void>
}

export function ArchiveIntakeItem({ orderID, item, busy, refresh }: Props) {
  const title = useId()
  const modal = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return <>
    <Button disabled={busy} onClick={() => { setError(''); modal.current?.showModal() }}>
      <Archive size={17} aria-hidden="true" /> В архив
    </Button>
    <dialog ref={modal} className="whm-archive-dialog" aria-labelledby={title}
      onCancel={event => { if (submitting.current) event.preventDefault() }}>
      <form onSubmit={async event => {
        event.preventDefault()
        if (submitting.current) return
        const reason = String(new FormData(event.currentTarget).get('reason') || '').trim()
        if (!reason) { setError('Укажите причину архивации.'); return }
        submitting.current = true
        setSaving(true)
        setError('')
        try {
          await api(`/v1/warehouse/orders/${orderID}/archive-item`, { itemID: item.id, reason })
          modal.current?.close()
          await refresh()
        } catch (failure) {
          setError((failure as Error).message)
        } finally {
          submitting.current = false
          setSaving(false)
        }
      }}>
        <h2 id={title}>Отправить вещь в архив?</h2>
        <p><strong>{item.title}</strong> · <span translate="no">{item.internalID}</span></p>
        <p>Склад перестанет ждать эту вещь. Если в заявке не останется вещей для приёмки или размещения, заявка закроется.</p>
        <label>Причина архивации
          <textarea name="reason" required maxLength={500} placeholder="Например, клиент не привёз вещь…" />
        </label>
        {error && <p className="whm-error" role="alert">{error}</p>}
        <div className="whm-toolbar-actions">
          <Button disabled={saving} onClick={() => modal.current?.close()}>Оставить в очереди</Button>
          <Button variant="default" type="submit" disabled={saving}>{saving ? 'Архивируем…' : 'Подтвердить архивацию'}</Button>
        </div>
      </form>
    </dialog>
  </>
}
