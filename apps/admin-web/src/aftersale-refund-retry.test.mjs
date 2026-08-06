import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const detail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/aftersale-detail.vue'), 'utf8')
const service = readFileSync(resolve(root, 'apps/api/src/aftersale/aftersale.service.ts'), 'utf8')

test('refund retry requires confirmed WeChat terminal status', () => {
  assert.match(detail, /detail\.value\.refundRetryable === true/)
  assert.match(detail, /detail\.value\.latestRefundStatus === 'failed'/)
  assert.match(detail, /退款请求结果待核实，请先同步微信退款状态/)
  assert.match(detail, /isRefundRetry\.value/)
  assert.match(detail, /重新发起退款/)
  assert.doesNotMatch(detail, /latestAftersaleAction/)
  assert.doesNotMatch(detail, /\['refund_failed', 'sync_refund_failed'\]/)

  assert.match(service, /latestRefundStatus: latestRefund\?\.status \|\| null/)
  assert.match(service, /refundRetryable: !!latestRefund && retryableStatuses\.includes\(latestRefund\.status\)/)
  assert.match(service, /REFUND_STATUS\.CLOSED/)
  assert.match(service, /REFUND_STATUS\.ABNORMAL/)
  assert.match(service, /latestRefundBefore\?\.status === REFUND_STATUS\.FAILED/)
  assert.match(service, /退款请求结果待核实，请先同步微信退款状态/)
  assert.doesNotMatch(service, /\[REFUND_STATUS\.FAILED, REFUND_STATUS\.CLOSED, REFUND_STATUS\.ABNORMAL\]/)
})

test('refund initiation is serialized and uncertain requests require sync', () => {
  assert.match(service, /SELECT GET_LOCK\(\?, 0\) AS acquired/)
  assert.match(service, /SELECT RELEASE_LOCK\(\?\) AS released/)
  assert.match(service, /aftersale_refund:\$\{id\}/)
  assert.match(service, /退款操作正在处理中，请勿重复提交/)
  assert.match(service, /await this\.runWithRefundLock\(id, \(\) => this\.paymentService\.createRefund/)
  assert.match(service, /const createdNewRefund = !!latestRefundAfter/)
  assert.match(service, /REFUND_STATUS\.INITIATING/)
  assert.match(service, /REFUND_STATUS\.PENDING/)
  assert.match(service, /REFUND_STATUS\.PROCESSING/)
  assert.match(service, /data: \{ status: AftersaleStatus\.pending_refund \}/)
  assert.match(service, /退款请求结果待核实:[\s\S]*请先同步微信退款状态/)
})
