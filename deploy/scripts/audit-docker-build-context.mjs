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
  '.env.*',
  '**/*.pem',
  '**/*.key',
  'deploy/certs',
  'deploy/nginx/ssl',
  'apps/api/certs',
]) {
  assert.ok(entries.has(required), `.dockerignore missing required exclusion: ${required}`);
}

assert.ok(entries.has('!.env.production.example'), 'reviewed production env template must remain in build context');
console.log('[audit-docker-build-context] PASS');
