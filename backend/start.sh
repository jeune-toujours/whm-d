#!/bin/sh
set -eu
node --import tsx src/deploy-migrate.ts
if [ "${SEED_STAGING:-false}" = "true" ]; then
  node --import tsx src/seed-staging.ts
fi
exec node server.js
