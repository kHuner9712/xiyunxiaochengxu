import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const detail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/aftersale-detail.vue'), 'utf8')
const aftersaleList = readFileSync(resolve(root, 'apps/admin-web/src/views/order/aftersale.vue'), 'utf8')
const refundList = readFileSync(resolve(root, 'apps/admin-web/src/views/order/refund-list.vue'), 'utf8')
const refundDetail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/refund-detail.vue'), 'utf8')
const userDetail = readFileSync(resolve(root, 'apps/admin-web/src/views/user/detail.vue'), 'utf8')
const refundApi = readFileSync(resolve(root, 'apps/admin-web/src/api/refund.ts'), 'utf8')
const service = readFileSync(resolve(root, 'apps/api/src/aftersale/aftersale.service.ts'), 'utf8')
const paymentConstants = readFileSync(resolve(root, 'apps/api/src/common/constants/payment.ts'), 'utf8')
const refundMethod = service.slice(service.indexOf('  async refund('), service.indexOf('  private serializeAftersale('))
const adminAuditMethod = detail.slice(detail.indexOf('async function handleAudit()'), detail.indexOf('async function handleSyncRefund()'))
const adminSyncMethod = detail.slice(detail.indexOf('async function handleSyncRefund()'), detail.indexOf('async function handleRefund()'))
const adminRefundMethod = detail.slice(detail.indexOf('async function handleRefund()'), detail.indexOf('watch('))

test('refund retry, sync and manual eligibility come from backend status rules', () => {
  assert.match(detail, /detail\.value\.refundRetryable === true/)
  assert.match(detail, /detail\.value\.refundSyncRequired === true/)
  assert.match(detail, /detail\.value\.refundManualRequired === true/)
  assert.match(detail, /微信退款异常，不能重新发起普通退款/)
  assert.match(detail, /微信支付商户平台的交易中心处理此笔异常退款/)
  assert.match(detail, /确认已关闭后才能重新发起普通退款/)
  assert.match(detail, /isRefundRetry\.value/)
  assert.match(detail, /重新发起退款/)
  assert.doesNotMatch(detail, /latestAftersaleAction/)
  assert.doesNotMatch(detail, /detail\.value\.latestRefundStatus === 'failed'/)
  assert.doesNotMatch(detail, /\['refund_failed', 'sync_refund_failed'\]/)

  assert.match(paymentConstants, /RETRYING: 'retrying'/)
  assert.match(service, /latestRefundStatus: latestRefund\?\.status \|\| null/)
  assert.match(service, /refundRetryable: !!latestRefund && retryableStatuses\.includes\(latestRefund\.status\)/)
  assert.match(service, /refundSyncRequired: !!latestRefund && syncRequiredStatuses\.includes\(latestRefund\.status\)/)
  assert.match(service, /refundManualRequired: !!latestRefund && manualRequiredStatuses\.includes\(latestRefund\.status\)/)
  assert.match(service, /retryableStatuses = \[REFUND_STATUS\.CLOSED\]/)
  assert.match(service, /syncRequiredStatuses = \[REFUND_STATUS\.INITIATING, REFUND_STATUS\.FAILED, REFUND_STATUS\.RETRYING\]/)
  assert.match(service, /manualRequiredStatuses = \[REFUND_STATUS\.ABNORMAL\]/)
  assert.match(service, /latestRefundBefore\?\.status === REFUND_STATUS\.FAILED/)
  assert.match(service, /latestRefundBefore\?\.status === REFUND_STATUS\.ABNORMAL/)
  assert.match(service, /微信退款异常，请前往微信支付商户平台处理异常退款，不能重新发起普通退款/)
  assert.doesNotMatch(service, /retryableStatuses = \[REFUND_STATUS\.CLOSED, REFUND_STATUS\.ABNORMAL\]/)
})

test('refund initiation uses isolated atomic state claims without session locks', () => {
  assert.match(refundMethod, /await prisma\.aftersaleOrder\.updateMany\(\{[\s\S]*status: aftersale\.status[\s\S]*status: AftersaleStatus\.pending_refund/)
  assert.match(refundMethod, /await prisma\.orderRefund\.updateMany\(\{[\s\S]*id: latestRefundBefore\.id[\s\S]*status: latestRefundBefore\.status[\s\S]*status: REFUND_STATUS\.RETRYING/)
  assert.match(refundMethod, /claim\.count !== 1/)
  assert.match(refundMethod, /退款操作正在处理中，请勿重复提交/)
  assert.match(refundMethod, /await this\.paymentService\.createRefund\(/)
  assert.match(refundMethod, /const createdNewRefund = !!latestRefundAfter/)
  assert.match(refundMethod, /REFUND_STATUS\.INITIATING/)
  assert.match(refundMethod, /REFUND_STATUS\.PENDING/)
  assert.match(refundMethod, /REFUND_STATUS\.PROCESSING/)
  assert.match(refundMethod, /data: \{ status: aftersale\.status \}/)
  assert.match(refundMethod, /status: REFUND_STATUS\.RETRYING[\s\S]*data: \{ status: originalRetryStatus \}/)
  assert.match(refundMethod, /退款请求结果待核实:[\s\S]*请先同步微信退款状态/)
  assert.doesNotMatch(refundMethod, /data: \{ status: REFUND_STATUS\.FAILED \}[\s\S]*已原子占位重试/)

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
  assert.match(detail, /detail\.value\.refundSyncRequired === true/)
  assert.match(detail, /:disabled="syncingRefund \|\| !detail\.latestOutRefundNo"/)
  assert.match(detail, /@click="handleSyncRefund"/)
  assert.match(detail, /async function handleSyncRefund\(\)/)
  assert.match(detail, /await refundApi\.sync\(outRefundNo\)/)
  assert.match(detail, /result\.synced === false/)
  assert.match(detail, /await refreshDetailAfterWrite\(aftersaleId\)/)
  assert.match(detail, /请求错误由全局拦截器统一提示/)
})

test('admin aftersale actions take their lock before confirmation or network work', () => {
  assert.match(adminAuditMethod, /if \(submitting\.value\) return/)
  assert.match(adminAuditMethod, /submitting\.value = true[\s\S]*ElMessageBox\.confirm[\s\S]*aftersaleApi\.(approve|reject)/)
  assert.match(adminAuditMethod, /finally \{[\s\S]*submitting\.value = false/)

  assert.match(adminRefundMethod, /if \(submitting\.value\) return/)
  assert.match(adminRefundMethod, /submitting\.value = true[\s\S]*ElMessageBox\.confirm[\s\S]*aftersaleApi\.refund/)
  assert.match(adminRefundMethod, /finally \{[\s\S]*submitting\.value = false/)

  assert.match(adminSyncMethod, /if \(syncingRefund\.value\) return/)
  assert.match(adminSyncMethod, /syncingRefund\.value = true[\s\S]*refundApi\.sync/)
  assert.match(adminSyncMethod, /finally \{[\s\S]*syncingRefund\.value = false/)
})

test('admin detail views ignore stale route responses and bind writes to the visible record', () => {
  for (const source of [detail, refundDetail, userDetail]) {
    assert.match(source, /let detailRequestVersion = 0/)
    assert.match(source, /const requestVersion = \+\+detailRequestVersion/)
    assert.match(source, /requestVersion !== detailRequestVersion/)
    assert.match(source, /watch\(/)
    assert.match(source, /immediate: true/)
  }

  assert.match(detail, /currentRouteAftersaleId\(\)/)
  assert.match(detail, /String\(nextDetail\.id \|\| ''\) !== aftersaleId/)
  assert.match(detail, /requestVersion !== detailRequestVersion \|\| !isCurrentRouteAftersale\(aftersaleId\)/)
  assert.match(detail, /revokePrivateObjectUrls\(resolvedImages\)/)
  assert.match(adminAuditMethod, /const aftersaleId = String\(detail\.value\.id \|\| ''\)[\s\S]*!isCurrentRouteAftersale\(aftersaleId\)[\s\S]*aftersaleApi\.(approve|reject)\(aftersaleId/)
  assert.match(adminRefundMethod, /const aftersaleId = String\(detail\.value\.id \|\| ''\)[\s\S]*!isCurrentRouteAftersale\(aftersaleId\)[\s\S]*aftersaleApi\.refund\(aftersaleId\)/)

  assert.match(refundDetail, /currentRouteRefundId\(\)/)
  assert.match(refundDetail, /String\(nextDetail\.id \|\| ''\) !== refundId/)
  assert.match(refundDetail, /currentRouteRefundId\(\) !== refundId/)

  assert.match(userDetail, /currentRouteUserId\(\)/)
  assert.match(userDetail, /String\(nextUser\.id \|\| ''\) !== userId/)
  assert.match(userDetail, /currentRouteUserId\(\) !== userId/)
})

test('aftersale and refund lists ignore stale responses after filters or pages change', () => {
  for (const source of [aftersaleList, refundList]) {
    assert.match(source, /let listRequestVersion = 0/)
    assert.match(source, /const requestVersion = \+\+listRequestVersion/)
    assert.match(source, /if \(requestVersion !== listRequestVersion\) return/)
    assert.match(source, /if \(requestVersion === listRequestVersion\) loading\.value = false/)
  }
  assert.match(aftersaleList, /const querySnapshot = \{[\s\S]*page: pagination\.page[\s\S]*pageSize: pagination\.pageSize[\s\S]*status: searchForm\.status/)
  assert.match(refundList, /const querySnapshot: any = \{[\s\S]*page: pagination\.page[\s\S]*pageSize: pagination\.pageSize/)
})

test('refund list and detail label initiating and retrying states for operators', () => {
  for (const source of [refundList, refundDetail]) {
    assert.match(source, /initiating: '提交中'/)
    assert.match(source, /retrying: '重试核实中'/)
    assert.match(source, /initiating: 'warning'/)
    assert.match(source, /retrying: 'warning'/)
  }

  assert.match(refundList, /v-for="\(label, key\) in REFUND_STATUS_MAP"/)
})
