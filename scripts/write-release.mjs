import { writeFileSync } from 'node:fs';
const release = process.env.SOURCE_COMMIT || process.env.VITE_RELEASE_SHA || 'local';
writeFileSync(new URL('../dist/release.json', import.meta.url), JSON.stringify({ service: 'whm-client', release }));
