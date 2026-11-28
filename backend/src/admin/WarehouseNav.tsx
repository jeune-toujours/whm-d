'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Archive, ClipboardList, Headphones, PackageCheck, PackageMinus, ScanBarcode, TriangleAlert } from 'lucide-react'
import { useAuth } from '@payloadcms/ui'

const destinations = [
  { path: 'receive', label: 'Приёмка', icon: PackageCheck },
  { path: 'place', label: 'Размещение', icon: Archive },
  { path: 'pick', label: 'Подбор', icon: ScanBarcode },
  { path: 'return', label: 'Выдача', icon: PackageMinus },
  { path: 'inventory', label: 'Инвентаризация', icon: ClipboardList },
  { path: 'problems', label: 'Проблемные заказы', icon: TriangleAlert },
  { path: 'support', label: 'Обращения клиентов', icon: Headphones }
]

export function WarehouseNav() {
  const { user } = useAuth()
  const pathname = usePathname()
  if (!user || !['admin', 'manager', 'warehouse'].includes(user.role)) return null
  return <nav className="whm-navigation" aria-label="Складские процессы">
    <strong>Операции WHM</strong>
    {destinations.filter(item => item.path !== 'support' || user.role !== 'warehouse').map(({ path, label, icon: Icon }) => {
      const href = `/admin/warehouse/${path}`
      return <Link key={path} href={href} aria-current={pathname === href ? 'page' : undefined}>
        <Icon size={17} aria-hidden="true" />{label}
      </Link>
    })}
  </nav>
}
