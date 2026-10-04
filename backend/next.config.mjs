import { withPayload } from '@payloadcms/next/withPayload';
import { fileURLToPath } from 'node:url';
export default withPayload({
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  poweredByHeader: false,
});
