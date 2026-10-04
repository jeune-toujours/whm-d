import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import { databaseOptions } from './database-options'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { collections } from './collections'
import { endpoints } from './endpoints'
import { sendOTP } from './jobs'

const building = process.env.WHM_BUILD === '1'
const secret = process.env.PAYLOAD_SECRET || (building ? 'build-only-not-valid-for-runtime-00000000' : '')
if (secret.length < 32) throw new Error('PAYLOAD_SECRET must contain at least 32 characters')
const origin = process.env.APP_URL || 'http://localhost:3000'
const client = process.env.CLIENT_URL || 'http://localhost:5173'
const sourceDir = path.dirname(fileURLToPath(import.meta.url))
export default buildConfig({
  secret, serverURL: origin, cors: { origins: [client, origin], headers: ['Idempotency-Key'] }, csrf: [client, origin],
  admin: { user: 'users', importMap: { baseDir: sourceDir, importMapFile: path.resolve(sourceDir, 'app/(payload)/admin/importMap.ts') }, meta: { titleSuffix: ' · WHM' }, components: {
    afterNavLinks: ['/admin/WarehouseNav#WarehouseNav'],
    views: {
      receive: { Component: '/admin/WarehouseView#ReceiveView', path: '/warehouse/receive' },
      place: { Component: '/admin/WarehouseView#PlaceView', path: '/warehouse/place' },
      pick: { Component: '/admin/WarehouseView#PickView', path: '/warehouse/pick' },
      handover: { Component: '/admin/WarehouseView#ReturnView', path: '/warehouse/return' },
      support: { Component: '/admin/WarehouseView#SupportView', path: '/warehouse/support' },
    },
  } },
  collections, endpoints, sharp,
  upload: { limits: { fileSize: 25 * 1024 * 1024 } },
  db: postgresAdapter({
    idType: 'uuid', allowIDOnCreate: true, push: process.env.DATABASE_PUSH === 'true' && process.env.APP_ENV === 'development', disableCreateDatabase: true,
    pool: { ...databaseOptions(process.env), max: 10, connectionTimeoutMillis: 10_000 },
    migrationDir: path.resolve(sourceDir, 'migrations'),
  }),
  plugins: [s3Storage({
    enabled: Boolean(process.env.S3_BUCKET), alwaysInsertFields: true, bucket: process.env.S3_BUCKET || 'build-placeholder', acl: 'private',
    collections: { media: { prefix: process.env.S3_PREFIX || 'whm', signedDownloads: { expiresIn: 300 } } },
    config: { endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' } },
  })],
  jobs: { access: { run: ({ req }) => req.user?.role === 'admin', queue: ({ req }) => req.user?.role === 'admin', cancel: ({ req }) => req.user?.role === 'admin' }, jobsCollectionOverrides: ({ defaultJobsCollection }) => ({ ...defaultJobsCollection, access: { ...defaultJobsCollection.access, read: ({ req }) => req.user?.role === 'admin' } }), tasks: [sendOTP], autoRun: [{ cron: '* * * * * *', queue: 'default', limit: 20 }] },
  typescript: { outputFile: path.resolve(sourceDir, 'payload-types.ts') },
  email: () => ({ name: 'whm-disabled-email', defaultFromAddress: 'unconfigured@whm.invalid', defaultFromName: 'WHM', sendEmail: async () => { throw new Error('Email provider is not configured') } }),
  onInit: async () => {
    if (process.env.SIMULATE_INTEGRATIONS === 'true' && process.env.APP_ENV !== 'staging') throw new Error('Integration simulation is only allowed in staging')
    if (!building && (!process.env.DATABASE_URL || !process.env.S3_BUCKET || !process.env.S3_ENDPOINT || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)) throw new Error('Configure PostgreSQL and private Selectel S3 before starting WHM')
  },
})
