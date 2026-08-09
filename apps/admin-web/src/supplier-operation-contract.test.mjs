import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

const seed = read('apps/api/prisma/seed.ts')
const page = read('apps/admin-web/src/views/supplier/list.vue')
const controller = read('apps/api/src/supplier/supplier.controller.ts')
const createDto = read('apps/api/src/supplier/dto/create-supplier.dto.ts')
const updateDto = read('apps/api/src/supplier/dto/update-supplier.dto.ts')
const schema = read('apps/api/prisma/schema.prisma')
const migration = read('apps/api/prisma/migrations/20260809144500_align_supplier_admin_contract/migration.sql')

const permissionCodes = new Set([...seed.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1]))

for (const permission of ['supplier:list', 'supplier:create', 'supplier:edit', 'supplier:delete']) {
  assert.ok(permissionCodes.has(permission), `seed must define ${permission}`)
}

test('supplier admin page submits the same fields accepted by the API', () => {
  assert.match(page, /prop="contactName"/)
  assert.match(page, /v-model="form\.contactName"/)
  assert.match(page, /email:\s*form\.email\.trim\(\) \|\| undefined/)
  assert.match(page, /status:\s*form\.status/)
  assert.doesNotMatch(page, /contactPerson/)

  assert.match(createDto, /contactName\?: string/)
  assert.match(createDto, /email\?: string/)
  assert.match(createDto, /status\?: number/)
  assert.match(updateDto, /contactName\?: string/)
  assert.match(updateDto, /email\?: string/)
  assert.match(updateDto, /status\?: number/)
})

test('supplier buttons and API routes use the same seeded granular permissions', () => {
  assert.match(page, /v-permission="'supplier:create'"[^>]*>新增供应商/)
  assert.match(page, /v-permission="'supplier:edit'"[^>]*>编辑/)
  assert.match(page, /v-permission="'supplier:delete'"[^>]*>删除/)

  assert.match(controller, /@RequirePermission\('supplier:list'\)/)
  assert.match(controller, /@RequirePermission\('supplier:create'\)/)
  assert.match(controller, /@RequirePermission\('supplier:edit'\)/)
  assert.match(controller, /@RequirePermission\('supplier:delete'\)/)
  assert.doesNotMatch(controller, /product:supplier/)
})

test('supplier email exists in both Prisma schema and migration', () => {
  assert.match(schema, /model Supplier \{[\s\S]*email\s+String\?\s+@db\.VarChar\(100\) @map\("email"\)/)
  assert.match(migration, /ADD COLUMN `email` VARCHAR\(100\) NULL/)
})
