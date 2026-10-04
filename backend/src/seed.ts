import { getPayload } from 'payload'
import config from './payload.config'
const email = process.env.BOOTSTRAP_ADMIN_EMAIL
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
if (!email || !password || password.length < 16) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a unique BOOTSTRAP_ADMIN_PASSWORD of at least 16 characters')
const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
if (!existing.totalDocs) {
  await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrapAdmin: true }, data: { email, password, role: 'admin', active: true, firstName: 'Администратор' } })
  console.log('Administrator created. Remove bootstrap password from runtime environment.')
} else console.log('User already exists. Credentials were not changed.')
await payload.destroy()
process.exit(0)
