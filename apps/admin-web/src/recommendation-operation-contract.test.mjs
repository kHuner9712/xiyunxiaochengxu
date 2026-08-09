import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

const page = read('apps/admin-web/src/views/marketing/recommendation.vue')
const controller = read('apps/api/src/recommendation/recommendation.controller.ts')
const service = read('apps/api/src/recommendation/recommendation.service.ts')
const itemDto = read('apps/api/src/recommendation/dto/save-recommendation-items.dto.ts')
const homeService = read('apps/api/src/home/home.service.ts')
const miniHome = read('apps/miniprogram/src/pages/home/index.vue')
const miniHomeApi = read('apps/miniprogram/src/api/home.ts')

test('recommendation item management has a real candidate selection flow', () => {
  assert.match(page, /v-model="addItemVisible"/)
  assert.match(page, /openCandidateDialog/)
  assert.match(page, /\/admin\/recommendation\/candidates\/\$\{currentId\.value\}/)
  assert.match(page, /targetId:\s*item\.targetId/)
  assert.match(page, /const currentId = ref\(''\)/)
  assert.doesNotMatch(page, /const currentId = ref<number>/)
})

test('recommendation API validates and resolves targets instead of storing arbitrary JSON', () => {
  assert.match(controller, /@Get\('candidates\/:id'\)/)
  assert.match(itemDto, /class SaveRecommendationItemDto/)
  assert.match(itemDto, /@ValidateNested\(\{ each: true \}\)/)
  assert.match(itemDto, /@ArrayUnique/)
  assert.doesNotMatch(itemDto, /items!:\s*any\[\]/)
  assert.match(service, /resolveItems\(recommendationType, items\)/)
  assert.match(service, /推荐目标不存在、已下线或已失效/)
  assert.match(service, /targetName:\s*targetMap\.get/)
})

test('managed recommendation sections are consumed by the real home response and miniprogram', () => {
  assert.match(homeService, /recommendations,\s*hotProducts/)
  assert.match(homeService, /where:\s*\{ type: 'recommendation', status: 1 \}/)
  assert.match(homeService, /recommendations,/)
  assert.match(miniHomeApi, /recommendations:\s*RecommendationSection\[\]/)
  assert.match(miniHome, /homeData\.recommendations/)
  assert.match(miniHome, /goContentDetail\(item\.id\)/)
})
