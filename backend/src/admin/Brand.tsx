import { Package } from 'lucide-react'
import './warehouse.css'

export function Icon() {
  return <span className="whm-brand-mark" aria-label="WHM D" role="img"><Package size={20} aria-hidden="true" /></span>
}

export function Logo() {
  return <span className="whm-wordmark" translate="no"><span aria-hidden="true"><Icon /></span>WHM D</span>
}
