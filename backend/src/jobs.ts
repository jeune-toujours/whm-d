import type { TaskConfig } from 'payload'
import { digest, otpCode, stagingCode } from './otp'

export const sendOTP: TaskConfig<'send-otp'> = {
  slug: 'send-otp', retries: 2,
  inputSchema: [{ name: 'challengeID', type: 'text', required: true }, { name: 'phone', type: 'text', required: true }],
  outputSchema: [{ name: 'sent', type: 'checkbox', required: true }],
  handler: async ({ input, req }) => {
    const challenge = await req.payload.findByID({ collection: 'otp-challenges', id: input.challengeID, req, overrideAccess: true })
    if (challenge.consumed || new Date(challenge.expiresAt).getTime() <= Date.now()) return { output: { sent: false } }
    const code = stagingCode(input.phone) || otpCode(challenge.id)
    if (digest(`${challenge.id}:${code}`) !== challenge.hash) throw new Error('OTP configuration changed')
    // Code is derived in the worker. Neither queue payload nor challenge stores plaintext OTP.
    const response = await fetch('https://sms.ru/sms/send', { method: 'POST', body: new URLSearchParams({ api_id: process.env.SMS_RU_API_ID!, to: input.phone.replace(/\D/g, ''), msg: `Код входа WHM: ${code}`, json: '1' }), signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`SMS provider HTTP ${response.status}`)
    const result = await response.json()
    const delivery = Object.values(result.sms || {}) as { status_code: number }[]
    if (result.status_code !== 100 || delivery.length !== 1 || delivery[0].status_code !== 100) throw new Error('SMS provider refused delivery')
    return { output: { sent: true } }
  },
}
