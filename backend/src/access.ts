import type { Access, PayloadRequest } from 'payload'

export type Role = 'client' | 'manager' | 'warehouse' | 'admin'
export type WHMUser = { id: string; role: Role; active?: boolean; phone?: string; firstName?: string; lastName?: string; contactEmail?: string; _sid?: string; collection: 'users' }
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
export const never: Access = () => false
