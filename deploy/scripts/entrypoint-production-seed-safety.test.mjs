import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entrypoint = readFileSync(resolve(root, 'deploy/scripts/entrypoint.sh'), 'utf8')
const permissionSeed = readFileSync(resolve(root, 'apps/api/prisma/seed-default-role-permissions.ts'), 'utf8')

test('full business seed is restricted to a genuinely fresh production database', () => {
  assert.match(entrypoint, /if \[ "\$admin_count" = "0" \]; then[\s\S]*run_seed[\s\S]*finalize_fresh_production_seed/)
  assert.match(entrypoint, /已有数据的生产库禁止 RUN_SEED=true/)
  assert.match(entrypoint, /跳过完整业务 seed，保留运营配置/)
})

test('existing production databases still receive safe permission normalization', () => {
  assert.match(entrypoint, /run_permission_seed\(\)/)
  assert.match(entrypoint, /prisma\/seed-default-role-permissions\.ts/)
  assert.match(entrypoint, /admin_count[\s\S]*else[\s\S]*run_permission_seed/)
})

test('safe permission seed does not mutate SystemConfig', () => {
  assert.doesNotMatch(permissionSeed, /systemConfig/i)
  assert.doesNotMatch(permissionSeed, /configValue/i)
  assert.match(permissionSeed, /ensureDefaultRolePermissions/)
  assert.match(permissionSeed, /ensurePickupPermissionStructure/)
})
