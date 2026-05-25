#!/bin/sh
set -e

if [ "$SEED_DB" = "true" ]; then
  echo "🌱 SEED_DB=true — running database seed..."
  node src/config/seed.js || echo "⚠️  Seed failed or already seeded, continuing..."
fi

exec node src/server.js
