#!/bin/sh
set -eu
node --import tsx src/deploy-migrate.ts
exec node server.js
