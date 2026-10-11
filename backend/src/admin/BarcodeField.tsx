'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'

function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Разрешите доступ к камере в настройках браузера и повторите попытку.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Камера не найдена. Подключите камеру или введите код вручную.'
  if (name === 'NotReadableError') return 'Камера занята другим приложением. Освободите её и повторите попытку.'
  return 'Не удалось запустить камеру. Повторите попытку или введите код вручную.'
}

function CameraScanner({ label, onCode, onClose }: { label: string; onCode: (code: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [starting, setStarting] = useState(true)
  const titleID = useId(), descriptionID = useId()
  // Callback refs avoid reopening the stream when the warehouse queue refreshes.
  const callbacks = useRef({ onCode, onClose }); callbacks.current = { onCode, onClose }
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  useEffect(() => {
    let cancelled = false, stream: MediaStream | undefined, controls: IScannerControls | undefined
    const preview = video.current!
    const stop = () => { controls?.stop(); stream?.getTracks().forEach(track => track.stop()); preview.srcObject = null }
    setError(''); setStarting(true)
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setError('Сканирование камерой доступно через HTTPS в браузере с поддержкой камеры. Можно ввести код вручную.'); return
        }
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (cancelled) { stop(); return }
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 250 })
        controls = await reader.decodeFromStream(stream, preview, (result, _error, activeControls) => {
          if (!result || cancelled) return
          const code = result.getText().trim()
          if (!code || code.length > 80) { setError('Код не подходит для этого поля: нужно от 1 до 80 символов. Наведите камеру на штрихкод.'); return }
          cancelled = true
          activeControls.stop(); stop()
          callbacks.current.onCode(code)
        })
        if (cancelled) stop()
      } catch (e) {
        stop()
        if (!cancelled) setError(cameraError(e))
      } finally { if (!cancelled) setStarting(false) }
    })()
    return () => { cancelled = true; stop() }
  }, [attempt])
  return createPortal(<dialog className="whm-scanner" ref={dialog} aria-labelledby={titleID} aria-describedby={descriptionID} onCancel={e => { e.preventDefault(); callbacks.current.onClose() }}>
    <div className="whm-scanner-heading"><h2 id={titleID}>Сканировать: {label.toLowerCase()}</h2><button type="button" className="whm-scanner-close" aria-label="Закрыть сканер" onClick={() => callbacks.current.onClose()}><X size={22} aria-hidden="true" /></button></div>
    <p id={descriptionID}>Наведите камеру на один штрихкод. После распознавания он появится в поле.</p>
    <div className="whm-scanner-preview"><video ref={video} autoPlay playsInline muted /><div className="whm-scanner-target" aria-hidden="true" /></div>
    {error ? <p role="alert" className="whm-scanner-error">{error}</p> : <p role="status">{starting ? 'Запуск камеры…' : 'Ищем штрихкод… Держите код целиком в кадре.'}</p>}
    <div className="whm-scanner-actions">{error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Повторить</button>}<button type="button" onClick={() => callbacks.current.onClose()}>Ввести вручную</button></div>
  </dialog>, document.body)
}

export function BarcodeField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId(), input = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false), [scanned, setScanned] = useState('')
  return <div className="whm-barcode-field">
    <label htmlFor={id}>{label}</label>
    <div className="whm-barcode-input"><input id={id} ref={input} required maxLength={80} autoComplete="off" value={value} disabled={disabled} onChange={e => { onChange(e.target.value); setScanned('') }} /><button type="button" className="whm-camera-button" disabled={disabled} aria-label={`Сканировать камерой: ${label.toLowerCase()}`} title="Сканировать камерой" onClick={() => { setScanned(''); setScanning(true) }}><Camera size={22} aria-hidden="true" /></button></div>
    {scanned && <p className="whm-barcode-result" role="status">Считан код: {scanned}</p>}
    {scanning && <CameraScanner label={label} onClose={() => setScanning(false)} onCode={code => { onChange(code); setScanned(code); setScanning(false); requestAnimationFrame(() => input.current?.focus()) }} />}
  </div>
}
