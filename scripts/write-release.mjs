import { readFileSync, writeFileSync } from 'node:fs';
const release = process.env.SOURCE_COMMIT || process.env.VITE_RELEASE_SHA || 'local';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../dist/release.json', import.meta.url), JSON.stringify({ service: 'whm-client', version, release }));
