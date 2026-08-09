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
const homeDecorPage = read('apps/admin-web/src/views/marketing/home-decor.vue')
const homeDecorController = read('apps/api/src/home/admin-home-decor.controller.ts')
const customerPage = read('apps/admin-web/src/views/system/customer-service.vue')
const customerController = read('apps/api/src/system-config/system-config.controller.ts')
const customerService = read('apps/api/src/system-config/system-config.service.ts')

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

test('home decor uses explicit business validation and visible failure feedback', () => {
  assert.match(homeDecorController, /class HomeDecorNavIconDto/)
  assert.match(homeDecorController, /@ValidateNested\(\{ each: true \}\)/)
  assert.match(homeDecorController, /HOME_ENTRY_LINK/)
  assert.doesNotMatch(homeDecorController, /navIcons\?: any\[\]/)

  assert.match(homeDecorPage, /HOME_ENTRY_LINK/)
  assert.match(homeDecorPage, /导航图标上传失败/)
  assert.match(homeDecorPage, /首页装修配置加载失败/)
  assert.match(homeDecorPage, /首页装修配置保存失败/)
  assert.doesNotMatch(homeDecorPage, /catch \{\}/)
})

test('customer service config cannot silently save unusable or malformed public data', () => {
  assert.match(customerController, /@IsIn\(\['true', 'false'\]\)/)
  assert.match(customerController, /@IsIn\(\['phone', 'wechat', 'both'\]\)/)
  assert.match(customerService, /启用电话客服时必须填写有效客服电话/)
  assert.match(customerService, /normalizeCustomerFaq\(dto\.faqContent, true\)/)
  assert.match(customerService, /faqContent: this\.normalizeCustomerFaq\(configMap\.faqContent, false\)/)

  assert.match(customerPage, /客服配置加载失败/)
  assert.match(customerPage, /客服二维码上传失败/)
  assert.match(customerPage, /客服配置保存失败/)
  assert.doesNotMatch(customerPage, /catch \{\}/)
})
