import { endpoint, body, clientUser, json } from './http'
import { DomainError, text } from './domain'

const suggestURL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
const limit = 7

export function addressSuggestionsEnabled() {
  return Boolean(process.env.DADATA_API_KEY?.trim())
}

export function addressSearchQuery(value: unknown) {
  return text(value, 300)
    .replace(/(?:^|[\s,;]+)(?:кв(?:артира)?|оф(?:ис)?|помещение|подъезд|этаж|домофон)\.?(?=\s|\d|$).*$/isu, '')
    .replace(/\s+/g, ' ').trim()
}

export async function searchAddresses(query: string, key: string, fetcher = fetch) {
  const response = await fetcher(suggestURL, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, count: limit, locations: [{ country: 'Россия' }], to_bound: { value: 'house' } }),
    signal: AbortSignal.timeout(3500),
    redirect: 'error',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Address service unavailable')
  const { suggestions } = await response.json()
  if (!Array.isArray(suggestions)) throw new Error('Invalid address service response')
  const addresses = new Set<string>()
  for (const suggestion of suggestions.slice(0, limit)) {
    const address = text(suggestion?.value, 500)
    if (address) addresses.add(address)
  }
  return [...addresses]
}

export const addressSuggestionsEndpoint = endpoint('/v1/address-suggestions', 'post', async req => {
  clientUser(req)
  const key = process.env.DADATA_API_KEY?.trim()
  const query = addressSearchQuery((await body(req)).query)
  if (!key || query.length < 3) return json({ ok: true, addresses: [] })
  try {
    return json({ ok: true, addresses: await searchAddresses(query, key) })
  } catch {
    throw new DomainError(503, 'ADDRESS_SUGGESTIONS_UNAVAILABLE', 'Подсказки пока недоступны. Введите адрес вручную.')
  }
})
