import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

test('group buy admin create keeps a durable request identity across ambiguous failures', () => {
  const api = read('apps/admin-web/src/api/group-buy.ts')
  const dto = read('apps/api/src/group-buy/dto/group-buy.dto.ts')
  const controller = read('apps/api/src/group-buy/group-buy.controller.ts')

  assert.match(api, /PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY/)
  assert.match(api, /sessionStorage\.getItem\(PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY\)/)
  assert.match(api, /clientRequestId,\s*\n\s*\}\)/)
  assert.match(api, /status >= 400 && status < 500/)
  assert.match(dto, /export class CreateGroupBuyActivityDto extends GroupBuyActivityDto/)
  assert.match(controller, /activityCreate\(@Body\(\) dto: CreateGroupBuyActivityDto\)/)
})

test('group buy mutations reuse only the same operation and reject cross-operation aliasing', () => {
  const api = read('apps/admin-web/src/api/group-buy.ts')
  assert.match(api, /activeActivityMutations = new Map/)
  assert.match(api, /existing\.operation === operation/)
  assert.match(api, /该拼团活动正在执行其他操作，请稍后重试/)
  assert.equal((api.match(/runActivityMutation\(id, '(?:update|status|delete)'/g) || []).length, 3)
})

test('group buy admin page freezes writes and ignores stale list responses', () => {
  const page = read('apps/admin-web/src/views/marketing/group-buy-activity.vue')
  assert.match(page, /const actionBusyIds = reactive\(new Set<string>\(\)\)/)
  assert.match(page, /let listLoadSeq = 0/)
  assert.match(page, /const requestSeq = \+\+listLoadSeq/)
  assert.match(page, /if \(requestSeq !== listLoadSeq\) return/)
  assert.match(page, /:close-on-click-modal="!submitting"/)
  assert.match(page, /:close-on-press-escape="!submitting"/)
  assert.match(page, /:show-close="!submitting"/)
  assert.match(page, /<el-form ref="formRef" :model="editing" label-width="120px" :disabled="submitting">/)
  assert.match(page, /editing\.status === 1 && endDate\.getTime\(\) <= Date\.now\(\)/)
})

test('runtime GroupBuyService token resolves to the durable admin final provider', () => {
  const moduleSource = read('apps/api/src/group-buy/group-buy.module.ts')
  const provider = read('apps/api/src/group-buy/durable-admin-idempotent-bigint-safe-production-group-buy.service.ts')
  assert.match(moduleSource, /DurableAdminIdempotentBigintSafeProductionGroupBuyService/)
  assert.match(moduleSource, /provide: GroupBuyService,[\s\S]*useExisting: DurableAdminIdempotentBigintSafeProductionGroupBuyService/)
  assert.match(provider, /extends IdempotentBigintSafeProductionGroupBuyService/)
  assert.match(provider, /group_buy_activity_create/)
})
