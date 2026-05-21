#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
  echo "Production mode: running prisma migrate deploy..."
  npx prisma migrate deploy
  if [ "$RUN_SEED" = "true" ]; then
    echo "RUN_SEED=true: running database seed..."
    npx prisma db seed
  fi
else
  echo "Development mode: running prisma db push..."
  npx prisma db push
  if [ "$RUN_SEED" = "true" ]; then
    echo "RUN_SEED=true: running database seed..."
    npx prisma db seed
  fi
fi

echo "Starting application..."
node dist/main.js
