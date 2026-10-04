import type { Access, PayloadRequest } from 'payload'

export type Role = 'client' | 'manager' | 'warehouse' | 'admin'
export type WHMUser = { id: string; role: Role; active?: boolean; phone?: string; firstName?: string; lastName?: string; contactEmail?: string; paymentBrand?: string | null; paymentLast4?: string | null; _sid?: string; collection: 'users' }
export const userOf = (req: Pick<PayloadRequest, 'user'>) => req.user as WHMUser | null
export const hasRole = (req: Pick<PayloadRequest, 'user'>, roles: Role[]) => {
  const user = userOf(req)
  return Boolean(user && user.active !== false && roles.includes(user.role))
}
export const admin: Access = ({ req }) => hasRole(req, ['admin'])
export const staff: Access = ({ req }) => hasRole(req, ['admin', 'manager', 'warehouse'])
export const office: Access = ({ req }) => hasRole(req, ['admin', 'manager'])
export const owned: Access = ({ req }) => {
  if (hasRole(req, ['admin', 'manager', 'warehouse'])) return true
  const user = userOf(req)
  return user && user.active !== false ? { owner: { equals: user.id } } : false
}
export const self: Access = ({ req }) => {
  if (hasRole(req, ['admin', 'manager'])) return true
  const user = userOf(req)
  return user && user.active !== false ? { id: { equals: user.id } } : false
}
export const officeOwned: Access = args => hasRole(args.req, ['warehouse']) ? false : owned(args)
export const supportOwned: Access = ({ req }) => {
  if (hasRole(req, ['admin', 'manager'])) return { type: { equals: 'incident' } }
  if (hasRole(req, ['warehouse'])) return false
  return owned({ req })
}
export const supportOffice: Access = ({ req }) => hasRole(req, ['admin', 'manager']) ? { type: { equals: 'incident' } } : false
export const supportMessages: Access = ({ req }) => hasRole(req, ['admin', 'manager']) ? { 'ticket.type': { equals: 'incident' } } : officeOwned({ req })
export const never: Access = () => false
