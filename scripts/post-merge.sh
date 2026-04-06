#!/bin/bash
set -e
pnpm install --frozen-lockfile
timeout 15 pnpm --filter db push < /dev/null 2>&1 || echo "DB push requires manual review (run: cd lib/db && pnpm run push)"
