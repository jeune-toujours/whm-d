import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import { WarehousePanel } from './WarehousePanel'

async function view(props: AdminViewServerProps, mode: 'receive' | 'place' | 'pick' | 'return' | 'support') {
  const { initPageResult, params, searchParams } = props
  const { req, locale, permissions, visibleEntities } = initPageResult
  const user = req.user
  if (!user || user.active === false) redirect('/admin/login')
  if (!['admin', 'manager', 'warehouse'].includes(user.role) || (mode === 'support' && user.role === 'warehouse')) redirect('/admin')
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={user} visibleEntities={visibleEntities}>
    <WarehousePanel mode={mode} />
  </DefaultTemplate>
}
export const ReceiveView = (props: AdminViewServerProps) => view(props, 'receive')
export const PlaceView = (props: AdminViewServerProps) => view(props, 'place')
export const PickView = (props: AdminViewServerProps) => view(props, 'pick')
export const ReturnView = (props: AdminViewServerProps) => view(props, 'return')
export const SupportView = (props: AdminViewServerProps) => view(props, 'support')
