#!/bin/sh
set -e

echo "Syncing database schema..."
npx prisma db push --accept-data-loss

echo "Running database seed..."
npx prisma db seed

echo "Starting application..."
node dist/main.js
