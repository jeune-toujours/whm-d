export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ status: 'ok', service: 'whm-api', release: process.env.RELEASE_SHA || 'local' }, { headers: { 'Cache-Control': 'no-store' } });
}
