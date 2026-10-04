'use client'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
export function WarehouseNav() {
  const { user } = useAuth()
  if (!user || !['admin', 'manager', 'warehouse'].includes(user.role)) return null
  return <nav aria-label="Складские процессы" style={{ display: 'grid', gap: 12, padding: '24px 0' }}>
    <strong>Операции WHM</strong>
    <Link href="/admin/warehouse/receive">Приёмка</Link>
    <Link href="/admin/warehouse/place">Размещение</Link>
    <Link href="/admin/warehouse/pick">Подбор</Link>
    <Link href="/admin/warehouse/return">Выдача</Link>
    {user.role !== 'warehouse' && <Link href="/admin/warehouse/support">Обращения клиентов</Link>}
  </nav>
}
