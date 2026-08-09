import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

const homeDecorPage = read('apps/admin-web/src/views/marketing/home-decor.vue')
const homeDecorController = read('apps/api/src/home/admin-home-decor.controller.ts')
const customerPage = read('apps/admin-web/src/views/system/customer-service.vue')
const customerController = read('apps/api/src/system-config/system-config.controller.ts')
const customerService = read('apps/api/src/system-config/system-config.service.ts')

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
