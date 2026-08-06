import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const detail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/aftersale-detail.vue'), 'utf8')
const refundApi = readFileSync(resolve(root, 'apps/admin-web/src/api/refund.ts'), 'utf8')
const service = readFileSync(resolve(root, 'apps/api/src/aftersale/aftersale.service.ts'), 'utf8')
const refundMethod = service.slice(service.indexOf('  async refund('), service.indexOf('  private serializeAftersale('))

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

test('refund initiation uses atomic state claims without session locks', () => {
  assert.match(refundMethod, /await prisma\.aftersaleOrder\.updateMany\(\{[\s\S]*status: aftersale\.status[\s\S]*status: AftersaleStatus\.pending_refund/)
  assert.match(refundMethod, /await prisma\.orderRefund\.updateMany\(\{[\s\S]*id: latestRefundBefore\.id[\s\S]*status: latestRefundBefore\.status[\s\S]*status: REFUND_STATUS\.FAILED/)
  assert.match(refundMethod, /claim\.count !== 1/)
  assert.match(refundMethod, /退款操作正在处理中，请勿重复提交/)
  assert.match(refundMethod, /await this\.paymentService\.createRefund\(/)
  assert.match(refundMethod, /const createdNewRefund = !!latestRefundAfter/)
  assert.match(refundMethod, /REFUND_STATUS\.INITIATING/)
  assert.match(refundMethod, /REFUND_STATUS\.PENDING/)
  assert.match(refundMethod, /REFUND_STATUS\.PROCESSING/)
  assert.match(refundMethod, /data: \{ status: aftersale\.status \}/)
  assert.match(refundMethod, /data: \{ status: originalRetryStatus \}/)
  assert.match(refundMethod, /退款请求结果待核实:[\s\S]*请先同步微信退款状态/)

  assert.doesNotMatch(refundMethod, /GET_LOCK/)
  assert.doesNotMatch(refundMethod, /RELEASE_LOCK/)
  assert.doesNotMatch(refundMethod, /runWithRefundLock/)
  assert.doesNotMatch(refundMethod, /\$transaction/)
})

test('admin can sync an uncertain refund before retrying', () => {
  assert.match(refundApi, /sync\(outRefundNo: string\)/)
  assert.match(refundApi, /request\.post\(`\/admin\/refund\/sync\/\$\{encodeURIComponent\(outRefundNo\)\}`\)/)
  assert.match(detail, /import \{ refundApi \} from '@\/api\/refund'/)
  assert.match(detail, /v-if="needsRefundSync"/)
  assert.match(detail, /:disabled="!detail\.latestOutRefundNo"/)
  assert.match(detail, /@click="handleSyncRefund"/)
  assert.match(detail, /async function handleSyncRefund\(\)/)
  assert.match(detail, /await refundApi\.sync\(outRefundNo\)/)
  assert.match(detail, /result\.synced === false/)
  assert.match(detail, /await fetchDetail\(\)/)
  assert.match(detail, /请求错误由全局拦截器统一提示/)
})
