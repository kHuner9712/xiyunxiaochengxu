import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const detail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/aftersale-detail.vue'), 'utf8')
const service = readFileSync(resolve(root, 'apps/api/src/aftersale/aftersale.service.ts'), 'utf8')

test('failed terminal refunds can be retried without exposing active refunds', () => {
  assert.match(detail, /const latestAftersaleAction = computed\(\(\) => asArray\(detail\.value\.aftersaleLogs\)\[0\]\?\.action \|\| ''\)/)
  assert.match(detail, /detail\.value\.status === 'pending_refund'/)
  assert.match(detail, /\['refund_failed', 'sync_refund_failed'\]\.includes\(latestAftersaleAction\.value\)/)
  assert.match(detail, /isRefundRetry\.value/)
  assert.match(detail, /重新发起退款/)

  assert.match(service, /where: \{ aftersaleId: BigInt\(id\) \}/)
  assert.match(service, /orderBy: \{ createdAt: 'desc' \}/)
  assert.match(service, /REFUND_STATUS\.FAILED/)
  assert.match(service, /REFUND_STATUS\.CLOSED/)
  assert.match(service, /REFUND_STATUS\.ABNORMAL/)
  assert.match(service, /if \(!latestRefund \|\| !retryableStatuses\.includes\(latestRefund\.status\)\)/)
  assert.doesNotMatch(service, /aftersale\.status === AftersaleStatus\.pending_refund \|\| aftersale\.status === AftersaleStatus\.refunded/)
})
