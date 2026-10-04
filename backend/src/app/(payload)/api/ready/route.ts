import { getPayload } from 'payload'
import config from '@payload-config'
import { migrations } from '../../../../migrations'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true, select: { firstName: true } })
    const applied = await payload.find({ collection: 'payload-migrations', limit: 100, depth: 0, overrideAccess: true })
    if (!migrations.every(migration => applied.docs.some(doc => doc.name === migration.name))) throw new Error('Pending migrations')
    return Response.json({ status: 'ready', service: 'whm-api', release: process.env.RELEASE_SHA || 'local' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ status: 'unavailable', service: 'whm-api' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
