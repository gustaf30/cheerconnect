#!/bin/sh
set -e
npx --no-install prisma migrate deploy --config ./prisma.config.ts
exec "$@"
