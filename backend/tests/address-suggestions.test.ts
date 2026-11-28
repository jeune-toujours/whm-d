import test from 'node:test'
import assert from 'node:assert/strict'
import { addressSearchQuery, searchAddresses } from '../src/address-suggestions'

test('address queries omit apartment and access details', () => {
  assert.equal(addressSearchQuery('  Москва,  Тверская, 18  '), 'Москва, Тверская, 18')
  assert.equal(addressSearchQuery('Москва, Тверская, д 18, кв. 21, домофон 21'), 'Москва, Тверская, д 18')
  assert.equal(addressSearchQuery('Квартал 7, д 12 к 2'), 'Квартал 7, д 12 к 2')
  assert.equal(addressSearchQuery(null), '')
})

test('address lookup limits the provider request to Russia and returns unique display labels', async () => {
  const addresses = await searchAddresses('Москва Тверская 18', 'fixture-key', async (url, options) => {
    assert.equal(new URL(String(url)).hostname, 'suggestions.dadata.ru')
    assert.equal(options?.method, 'POST')
    assert.deepEqual(JSON.parse(String(options?.body)), {
      query: 'Москва Тверская 18', count: 7, locations: [{ country: 'Россия' }], to_bound: { value: 'house' },
    })
    const value = 'г Москва, ул Тверская, д 18'
    return Response.json({ suggestions: [{ value, data: { house: '18' } }, { value }, { value: '' }, {}] })
  })
  assert.deepEqual(addresses, ['г Москва, ул Тверская, д 18'])
  await assert.rejects(searchAddresses('Москва', 'fixture-key', async () => new Response(null, { status: 429 })),
    /Address service unavailable/)
})
