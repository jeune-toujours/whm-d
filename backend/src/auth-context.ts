// Both interfaces share an origin and a users collection, but must not share
// the browser cookie slot. Payload still verifies every JWT and database SID.
export const CLIENT_AUTH_HEADER = 'X-WHM-Client'
export const CLIENT_COOKIE_PREFIX = 'whm-client'
export const CLIENT_AUTH_QUERY = 'whm-client'

export function isClientRequest(request: Request, apiRoute = '/api') {
  const url = new URL(request.url)
  return request.headers.get(CLIENT_AUTH_HEADER) === '1'
    || url.searchParams.get(CLIENT_AUTH_QUERY) === '1'
    || url.pathname === `${apiRoute}/me`
    || url.pathname.startsWith(`${apiRoute}/auth/`)
}

type RESTHandler = (request: Request, args: { params: Promise<{ slug?: string[] }> }) => Promise<Response>

export function withAuthContext(handler: RESTHandler, settings: Promise<{ cookiePrefix: string; routes: { api: string } }>) {
  return async (request: Request, args: Parameters<RESTHandler>[1]) => {
    const { cookiePrefix, routes } = await settings
    if (!isClientRequest(request, routes.api)) return handler(request, args)

    const staffName = `${cookiePrefix}-token`, clientName = `${CLIENT_COOKIE_PREFIX}-token`
    const cookies = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(Boolean)
    const name = (value: string) => value.slice(0, value.indexOf('='))
    const client = cookies.find(value => name(value) === clientName)
    // Never fall back to an employee's cookie when the client logs out, has an
    // expired session, or has not signed in yet. Keep non-auth cookies intact.
    const selected = cookies.filter(value => ![staffName, clientName].includes(name(value)))
    if (client) selected.push(`${staffName}=${client.slice(client.indexOf('=') + 1)}`)
    const headers = new Headers(request.headers)
    headers.set('cookie', selected.join('; '))
    const response = await handler(new Request(request, { headers }), args)
    const outgoing = response.headers.getSetCookie()
    if (!outgoing.some(cookie => cookie.startsWith(`${staffName}=`))) return response

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('set-cookie')
    for (const cookie of outgoing) {
      responseHeaders.append('set-cookie', cookie.startsWith(`${staffName}=`) ? `${clientName}${cookie.slice(staffName.length)}` : cookie)
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders })
  }
}
