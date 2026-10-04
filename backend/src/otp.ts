import { createHmac, randomUUID, timingSafeEqual, randomBytes } from 'node:crypto'
import { jwtSign, type PayloadRequest } from 'payload'
import { addSessionToUser, generatePayloadCookie, generateExpiredPayloadCookie } from 'payload/shared'
import { normalizePhone, DomainError, text } from './domain'
import { endpoint, body, json, transaction, clientUser } from './http'
import { userOf } from './access'
import { simulationsEnabled } from './simulations'

export const digest = (value: string) => createHmac('sha256', process.env.PAYLOAD_SECRET!).update(value).digest('hex')
export const otpCode = (id: string) => String(parseInt(digest(`otp-code:${id}`).slice(0, 12), 16) % 1_000_000).padStart(6, '0')
export const stagingCode = (phone: string) => process.env.APP_ENV === 'staging' && process.env.STAGING_TEST_PHONE === phone && /^\d{6}$/.test(process.env.STAGING_TEST_OTP || '') ? process.env.STAGING_TEST_OTP! : null
const matches = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const cookieConfig = (req: PayloadRequest) => req.payload.collections.users.config
const simulatedPhone = (phone: string) => simulationsEnabled() && /^\+7999000\d{4}$/.test(phone)
async function requestCode(req: PayloadRequest, phone: string, phoneKey: string) {
  const ip = process.env.TRUST_PROXY === 'true' ? text(req.headers.get('x-forwarded-for')?.split(',').at(-1), 80) : 'shared-untrusted-ip'
  const ipKey = digest(`ip:${ip || 'unknown'}`), testCode = stagingCode(phone)
  if (simulationsEnabled() && !simulatedPhone(phone)) throw new DomainError(400, 'TEST_PHONE_ONLY', 'Для симуляции используйте тестовый номер +7 999 000 XX XX.')
  if (!testCode && !simulatedPhone(phone) && !process.env.SMS_RU_API_ID) throw new DomainError(503, 'SMS_NOT_CONFIGURED', 'Вход по SMS пока не подключён.')
  return transaction(req, [`otp:${phoneKey}`, `otp-ip:${ipKey}`], async () => {
    const recent = await req.payload.find({ collection: 'otp-challenges', req, overrideAccess: true, limit: 30, depth: 0, where: { and: [{ createdAt: { greater_than: new Date(Date.now() - 15 * 60_000).toISOString() } }, { or: [{ phoneKey: { equals: phoneKey } }, { ipKey: { equals: ipKey } }] }] } })
    const samePhone = recent.docs.filter(doc => doc.phoneKey === phoneKey)
    if (samePhone.some(doc => doc.attempts >= 3 && new Date(doc.expiresAt).getTime() > Date.now())) throw new DomainError(429, 'OTP_LOCKED', 'После трёх неверных кодов вход заблокирован на 10 минут.')
    if (samePhone.length >= 3 || recent.totalDocs >= 20 || samePhone.some(doc => new Date(doc.createdAt).getTime() > Date.now() - 60_000)) throw new DomainError(429, 'OTP_RATE_LIMIT', 'Подождите перед повторным запросом кода.')
    await req.payload.update({ collection: 'otp-challenges', req, overrideAccess: true, where: { phoneKey: { equals: phoneKey } }, data: { consumed: true } })
    const id = randomUUID(), code = testCode || otpCode(id)
    await req.payload.create({ collection: 'otp-challenges', req, overrideAccess: true, data: { id, phoneKey, ipKey, hash: digest(`${id}:${code}`), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), attempts: 0, consumed: false } })
    if (!testCode || simulationsEnabled()) await req.payload.jobs.queue({ task: 'send-otp', input: { challengeID: id, phone }, req })
    // A test SMS inbox, exposed only for the explicitly reserved staging phone range.
    return { ok: true, retryAfter: 60, ...(simulatedPhone(phone) ? { simulationCode: code } : {}) }
  })
}

export const authEndpoints = [
  endpoint('/auth/request-otp', 'post', async req => {
    const data = await body(req), phone = normalizePhone(data.phone), phoneKey = digest(`phone:${phone}`)
    return json(await requestCode(req, phone, phoneKey))
  }),
  endpoint('/v1/profile/phone/request', 'post', async req => {
    const user = clientUser(req), phone = normalizePhone((await body(req)).phone)
    const existing = await req.payload.count({ collection: 'users', req, overrideAccess: true, where: { phone: { equals: phone } } })
    if (existing.totalDocs) throw new DomainError(409, 'PHONE_IN_USE', 'Этот номер уже используется.')
    return json(await requestCode(req, phone, digest(`phone-change:${user.id}:${phone}`)))
  }),
  endpoint('/v1/profile/phone/confirm', 'post', async req => {
    const user = clientUser(req), data = await body(req), phone = normalizePhone(data.phone), code = text(data.code, 8), phoneKey = digest(`phone-change:${user.id}:${phone}`)
    if (!/^\d{6}$/.test(code)) throw new DomainError(400, 'INVALID_OTP', 'Введите шестизначный код.')
    const result = await transaction(req, [`otp:${phoneKey}`, `phone-claim:${digest(`phone:${phone}`)}`], async () => {
      const challenge = (await req.payload.find({ collection: 'otp-challenges', req, overrideAccess: true, limit: 1, sort: '-createdAt', where: { and: [{ phoneKey: { equals: phoneKey } }, { consumed: { equals: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] } })).docs[0]
      if (challenge?.attempts >= 3) return new DomainError(429, 'OTP_LOCKED', 'Подождите 10 минут перед повторной попыткой.')
      if (!challenge) return new DomainError(400, 'INVALID_OTP', 'Код истёк. Запросите новый.')
      if (!matches(challenge.hash, digest(`${challenge.id}:${code}`))) {
        await req.payload.update({ collection: 'otp-challenges', id: challenge.id, req, overrideAccess: true, data: { attempts: challenge.attempts + 1, ...(challenge.attempts === 2 ? { expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } : {}) } })
        return new DomainError(400, 'INVALID_OTP', 'Неверный код.')
      }
      if ((await req.payload.count({ collection: 'users', req, overrideAccess: true, where: { phone: { equals: phone } } })).totalDocs) return new DomainError(409, 'PHONE_IN_USE', 'Этот номер уже используется.')
      await req.payload.update({ collection: 'otp-challenges', id: challenge.id, req, overrideAccess: true, data: { consumed: true } })
      await req.payload.update({ collection: 'users', id: user.id, req, overrideAccess: true, data: { phone } })
      return { ok: true, phone }
    })
    if (result instanceof DomainError) throw result
    return json(result)
  }),
  endpoint('/auth/verify-otp', 'post', async req => {
    const data = await body(req), phone = normalizePhone(data.phone), code = text(data.code, 8), phoneKey = digest(`phone:${phone}`)
    if (!/^\d{6}$/.test(code)) throw new DomainError(400, 'INVALID_OTP', 'Введите шестизначный код.')
    const result = await transaction(req, [`otp:${phoneKey}`, `phone-claim:${phoneKey}`], async () => {
      const challenge = (await req.payload.find({ collection: 'otp-challenges', req, overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: { and: [{ phoneKey: { equals: phoneKey } }, { consumed: { equals: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] } })).docs[0]
      if (challenge?.attempts >= 3) return new DomainError(429, 'OTP_LOCKED', 'Подождите 10 минут перед повторной попыткой.')
      if (!challenge) return new DomainError(400, 'INVALID_OTP', 'Код истёк. Запросите новый.')
      if (!matches(challenge.hash, digest(`${challenge.id}:${code}`))) {
        await req.payload.update({ collection: 'otp-challenges', id: challenge.id, req, overrideAccess: true, data: { attempts: challenge.attempts + 1, ...(challenge.attempts === 2 ? { expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } : {}) } })
        return new DomainError(400, 'INVALID_OTP', 'Неверный код.') // Commit failed-attempt count.
      }
      await req.payload.update({ collection: 'otp-challenges', id: challenge.id, req, overrideAccess: true, data: { consumed: true } })
      let user = (await req.payload.find({ collection: 'users', req, overrideAccess: true, showHiddenFields: true, depth: 0, limit: 1, where: { phone: { equals: phone } } })).docs[0]
      if (user && (user.role !== 'client' || user.active === false)) return new DomainError(403, 'CLIENT_LOGIN_DENIED', 'Вход для этого аккаунта недоступен.')
      if (!user) user = await req.payload.create({ collection: 'users', req, overrideAccess: true, context: { otpRegistration: true }, data: { email: `${randomUUID()}@client.whm.invalid`, password: randomBytes(48).toString('base64url'), phone, role: 'client', active: true } })
      const collectionConfig = cookieConfig(req)
      const { sid } = await addSessionToUser({ collectionConfig, payload: req.payload, req, user: { ...user, collection: 'users' } })
      const { token } = await jwtSign({ fieldsToSign: { id: user.id, collection: 'users', sid }, secret: req.payload.secret, tokenExpiration: collectionConfig.auth.tokenExpiration })
      return { cookie: generatePayloadCookie({ collectionAuthConfig: collectionConfig.auth, cookiePrefix: req.payload.config.cookiePrefix, token }), newUser: !user.firstName }
    })
    if (result instanceof DomainError) throw result
    return json({ ok: true, newUser: result.newUser }, 200, { 'Set-Cookie': result.cookie })
  }),
  endpoint('/auth/logout', 'post', async req => {
    const user = userOf(req)
    if (user) await transaction(req, [`user:${user.id}`], async () => {
      const record = await req.payload.findByID({ collection: 'users', id: user.id, req, overrideAccess: true, showHiddenFields: true })
      await req.payload.db.updateOne({ collection: 'users', id: user.id, req, data: { sessions: (record.sessions || []).filter(session => session.id !== user._sid) } })
    })
    return json({ ok: true }, 200, { 'Set-Cookie': generateExpiredPayloadCookie({ collectionAuthConfig: cookieConfig(req).auth, cookiePrefix: req.payload.config.cookiePrefix }) })
  }),
]
