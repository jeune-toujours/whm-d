import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true, select: { firstName: true } })
    return Response.json({ status: 'ready', service: 'whm-api', release: process.env.RELEASE_SHA || 'local' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ status: 'unavailable', service: 'whm-api' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
