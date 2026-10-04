// The API token is supplied through an environment variable, never an argument.
const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) {
  throw new Error('Usage: node scripts/release.mjs staging|production');
}
const base = process.env.COOLIFY_URL;
const token = process.env.COOLIFY_TOKEN;
const apps = process.env[`COOLIFY_${environment.toUpperCase()}_APPS`];
if (!base || !token || !apps) {
  throw new Error(`Set COOLIFY_URL, COOLIFY_TOKEN and COOLIFY_${environment.toUpperCase()}_APPS`);
}
const url = new URL('/api/v1/deploy', base);
const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ uuid: apps }),
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Coolify refused deployment: HTTP ${response.status}`);
const body = await response.json();
console.log(JSON.stringify({ environment, deployments: body }, null, 2));
console.log('Deployment queued. Check deployment status and health before reporting success.');
