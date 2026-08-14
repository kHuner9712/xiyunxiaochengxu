#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const dockerignore = readFileSync(resolve(root, '.dockerignore'), 'utf8');
const entries = new Set(
  dockerignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

for (const required of [
  '.git',
  '**/node_modules',
  '**/dist',
  '**/uploads',
  '**/logs',
  'deploy/backups',
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  'deploy/certs',
  'deploy/nginx/ssl',
  'apps/api/certs',
]) {
  assert.ok(entries.has(required), `.dockerignore missing required exclusion: ${required}`);
}

for (const entry of entries) {
  assert.ok(
    !entry.startsWith('!.env') && !entry.startsWith('!**/.env'),
    `environment files must not be re-included in Docker build context: ${entry}`,
  );
}

console.log('[audit-docker-build-context] PASS');
