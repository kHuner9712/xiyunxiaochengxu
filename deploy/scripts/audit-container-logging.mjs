#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const [file, serviceCount] of [
  ['deploy/docker-compose.yml', 4],
  ['deploy/docker-compose.bt.yml', 3],
]) {
  const source = read(file);
  const count = (needle) => source.split(needle).length - 1;

  assert.equal(count('driver: json-file'), serviceCount, `${file}: every service must use the bounded json-file logging driver`);
  assert.equal(count('max-size: "20m"'), serviceCount, `${file}: every service must cap each Docker log file at 20m`);
  assert.equal(count('max-file: "5"'), serviceCount, `${file}: every service must retain at most five Docker log files`);
}

console.log('[container-logging-audit] PASS');
