import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

const seed = read('apps/api/prisma/seed.ts')
const knownPermissions = new Set(
  [...seed.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1]),
)

function assertPermissionExists(permission) {
  assert.ok(knownPermissions.has(permission), `permission ${permission} must exist in seed data`)
}

test('core admin operation buttons use defined permission codes', () => {
  const productList = read('apps/admin-web/src/views/product/list.vue')
  const orderList = read('apps/admin-web/src/views/order/list.vue')
  const orderDetail = read('apps/admin-web/src/views/order/detail.vue')
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')
  const pickupList = read('apps/admin-web/src/views/pickup-store/list.vue')

  for (const permission of [
    'product:create',
    'product:edit',
    'product:publish',
    'product:delete',
    'order:detail',
    'order:remark',
    'order:deliver',
    'order:cancel',
    'order:aftersale:review',
    'order:aftersale:refund',
    'pickup:store',
    'pickup:verify',
  ]) {
    assertPermissionExists(permission)
  }

  assert.match(productList, /v-permission="'product:create'"[^>]*>新增商品/)
  assert.match(productList, /v-permission="'product:publish'"/)
  assert.match(productList, /v-permission="'product:delete'"[^>]*>删除/)

  assert.match(orderList, /v-permission="'order:detail'"[^>]*>查看/)
  assert.match(orderList, /v-permission="'order:cancel'"[^>]*>取消/)
  assert.match(orderDetail, /v-permission="'order:remark'"/)
  assert.match(orderDetail, /v-permission="'order:deliver'"/)
  assert.match(orderDetail, /v-permission="'order:cancel'"/)
  assert.match(orderDetail, /v-permission="'pickup:verify'"/)
  assert.doesNotMatch(orderDetail, /order:delivery/)

  assert.equal((delivery.match(/v-permission="'order:deliver'"/g) || []).length, 2)
  assert.doesNotMatch(delivery, /order:delivery/)

  assert.match(aftersaleDetail, /v-permission="'order:aftersale:review'"/)
  assert.match(aftersaleDetail, /v-permission="'order:aftersale:refund'"/)

  assert.equal((pickupList.match(/v-permission="'pickup:store'"/g) || []).length, 4)
})

test('core order identifiers remain bigint-safe in delivery and aftersale operations', () => {
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')
  const orderDetail = read('apps/admin-web/src/views/order/detail.vue')
  const orderApi = read('apps/admin-web/src/api/order.ts')
  const deliverDto = read('apps/api/src/order/dto/deliver.dto.ts')
  const aftersaleApi = read('apps/admin-web/src/api/aftersale.ts')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')

  assert.match(delivery, /orderId:\s*undefined as string \| undefined/)
  assert.match(delivery, /deliverForm\.orderId\s*=\s*String\(row\.id\)/)
  assert.match(delivery, /orderId:\s*String\(o\.id\)/)
  assert.match(orderApi, /orderId: string; logisticsCompany: string; logisticsNo: string/)
  assert.match(orderApi, /getDetail\(id: string\)/)
  assert.match(orderApi, /remark\(id: string, remark: string\)/)
  assert.doesNotMatch(orderApi, /id:\s*string \| number/)

  assert.match(orderDetail, /orderId:\s*undefined as string \| undefined/)
  assert.match(orderDetail, /orderApi\.getDetail\(String\(route\.params\.id\)\)/)
  assert.match(orderDetail, /deliverForm\.orderId\s*=\s*orderId/)
  assert.match(orderDetail, /orderApi\.deliver\(\{ orderId, logisticsCompany, logisticsNo \}\)/)
  assert.doesNotMatch(orderDetail, /orderId:\s*undefined as number \| undefined/)

  assert.match(deliverDto, /type DeliveryOrderId = string \| number/)
  assert.equal((deliverDto.match(/orderId!:\s*DeliveryOrderId/g) || []).length, 2)
  assert.equal((deliverDto.match(/@IsString\(\)/g) || []).length, 6)
  assert.equal((deliverDto.match(/@Matches\(\/\^\\d\+\$\//g) || []).length, 2)
  assert.doesNotMatch(deliverDto, /@Type\(\(\) => Number\)/)

  assert.match(aftersaleApi, /getDetail\(id: string\)/)
  assert.match(aftersaleApi, /encodeURIComponent\(id\)/)
  assert.doesNotMatch(aftersaleApi, /type Id = string \| number/)
  assert.match(aftersaleDetail, /getDetail\(String\(route\.params\.id\)\)/)
  assert.doesNotMatch(aftersaleDetail, /Number\(route\.params\.id\)/)
})

test('admin aftersale UI matches the structured review API and string status model', () => {
  const aftersaleApi = read('apps/admin-web/src/api/aftersale.ts')
  const aftersaleList = read('apps/admin-web/src/views/order/aftersale.vue')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')
  const format = read('apps/admin-web/src/utils/format.ts')

  assert.match(aftersaleApi, /export interface AftersaleApprovalInput/)
  assert.match(aftersaleApi, /refundAmount: number/)
  assert.match(aftersaleApi, /returnReceiverName\?: string/)
  assert.match(aftersaleApi, /returnReceiverPhone\?: string/)
  assert.match(aftersaleApi, /returnAddress\?: string/)
  assert.match(aftersaleApi, /approve\(id: string, input: AftersaleApprovalInput\)/)
  assert.match(aftersaleApi, /encodeURIComponent\(id\)\}\/approve`, input\)/)
  assert.match(aftersaleApi, /reject\(id: string, rejectReason: string\)/)
  assert.match(aftersaleApi, /encodeURIComponent\(id\)\}\/reject`, \{ rejectReason \}\)/)
  assert.match(aftersaleApi, /refund\(id: string\)[\s\S]*encodeURIComponent\(id\)\}\/refund`\)/)

  assert.match(aftersaleList, /:value="key"/)
  assert.doesNotMatch(aftersaleList, /Number\(key\)/)
  assert.match(aftersaleList, /row\.order\?\.orderNo/)
  assert.match(aftersaleList, /row\.createdAt/)

  assert.match(aftersaleDetail, /detail\.status === 'pending_review'/)
  assert.match(aftersaleDetail, /detail\.value\.status === 'approved'/)
  assert.match(aftersaleDetail, /detail\.value\.status === 'returned'/)
  assert.match(aftersaleDetail, /auditResult === 'approve' && detail\.type === 2/)
  assert.match(aftersaleDetail, /returnReceiverName\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /returnReceiverPhone\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /returnAddress\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /aftersaleApi\.approve\(String\(detail\.value\.id\), \{/)
  assert.match(aftersaleDetail, /refundAmount,/)
  assert.match(aftersaleDetail, /returnReceiverName: returnReceiverName\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /returnReceiverPhone: returnReceiverPhone\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /returnAddress: returnAddress\.value\.trim\(\)/)
  assert.match(aftersaleDetail, /aftersaleApi\.reject\(String\(detail\.value\.id\), rejectReason\.value\.trim\(\)\)/)
  assert.match(aftersaleDetail, /aftersaleApi\.refund\(String\(detail\.value\.id\)\)/)

  assert.match(format, /pending_refund: '退款处理中'/)
})

test('stock adjustment and pickup verification keep the selected operation target stable', () => {
  const stockPage = read('apps/admin-web/src/views/product/stock.vue')
  const stockDto = read('apps/api/src/stock/dto/stock-adjust.dto.ts')
  const pickupVerify = read('apps/admin-web/src/views/pickup-store/verify.vue')
  const orderDetail = read('apps/admin-web/src/views/order/detail.vue')
  const pickupController = read('apps/api/src/pickup-store/pickup-store.controller.ts')
  const pickupCodeDto = read('apps/api/src/pickup-store/dto/pickup-code.dto.ts')

  assert.match(stockPage, /productId:\s*undefined as string \| undefined/)
  assert.match(stockPage, /skuId:\s*undefined as string \| undefined/)
  assert.match(stockPage, /adjustForm\.productId\s*=\s*String\(row\.productId\)/)
  assert.match(stockPage, /adjustForm\.skuId\s*=\s*String\(row\.skuId\)/)
  assert.match(stockDto, /productId\?: string/)
  assert.match(stockDto, /skuId!:\s*string/)
  assert.match(stockDto, /const POSITIVE_ID = \/\^\[1-9\]\\d\*\$\//)
  assert.equal((stockDto.match(/@Matches\(POSITIVE_ID/g) || []).length, 2)
  assert.doesNotMatch(stockDto, /@Type\(\(\) => Number\)[\s\S]{0,80}(?:productId|skuId)/)

  assert.match(pickupVerify, /const previewedPickupCode = ref\(''\)/)
  assert.match(pickupVerify, /@input="handleCodeInput"/)
  assert.match(pickupVerify, /pickupStoreApi\.verifyPickupCode\(code\)/)
  assert.doesNotMatch(pickupVerify, /verifyPickupCode\(pickupCode\.value\)/)
  assert.match(pickupVerify, /pickupCode\.value !== code/)
  assert.match(pickupVerify, /ElMessageBox\.confirm/)

  assert.match(orderDetail, /const verifyPickupCode = ref\(''\)/)
  assert.match(orderDetail, /:model-value="verifyPickupCode" disabled/)
  assert.match(orderDetail, /pickupStoreApi\.verifyPickupCode\(code\)/)
  assert.match(orderDetail, /code !== currentCode/)
  assert.doesNotMatch(orderDetail, /v-model="verifyPickupForm\.pickupCode"/)

  assert.match(pickupController, /@Query\(\) dto: PickupCodeDto/)
  assert.match(pickupController, /@Body\(\) dto: PickupCodeDto/)
  assert.match(pickupCodeDto, /@Matches\(\/\^\\d\{8\}\$\//)
})

test('pickup store editing submits only supported fields and preserves ids', () => {
  const pickupApi = read('apps/admin-web/src/api/pickup-store.ts')
  const pickupList = read('apps/admin-web/src/views/pickup-store/list.vue')
  const pickupDto = read('apps/api/src/pickup-store/dto/pickup-store.dto.ts')

  assert.match(pickupApi, /update\(id: string, data: any\)/)
  assert.match(pickupApi, /delete\(id: string\)/)
  assert.match(pickupApi, /updateStatus\(id: string, status: number\)/)
  assert.match(pickupApi, /encodeURIComponent\(id\)/)
  assert.doesNotMatch(pickupApi, /type Id = string \| number/)

  assert.match(pickupList, /id:\s*undefined as string \| undefined/)
  assert.match(pickupList, /id:\s*String\(row\.id\)/)
  assert.match(pickupList, /function buildPayload\(\)/)
  assert.match(pickupList, /pickupStoreApi\.update\(form\.id as string, payload\)/)
  assert.match(pickupList, /pickupStoreApi\.create\(payload\)/)
  assert.match(pickupList, /const id = String\(row\.id\)/)
  assert.match(pickupList, /pickupStoreApi\.updateStatus\(id, newStatus\)/)
  assert.match(pickupList, /pickupStoreApi\.delete\(id\)/)
  assert.match(pickupList, /<el-option label="停用" :value="0"/)
  assert.match(pickupList, /<el-radio :value="0">停用<\/el-radio>/)
  assert.doesNotMatch(pickupList, /:value="2"/)
  assert.match(pickupDto, /@IsIn\(\[0, 1\]\)/)
  assert.doesNotMatch(pickupList, /Object\.assign\(form, row\)/)
  assert.doesNotMatch(pickupList, /pickupStoreApi\.update\(form\.id, form\)/)
  assert.doesNotMatch(pickupList, /pickupStoreApi\.create\(form\)/)
})

test('product editing and filtering preserve bigint identifiers', () => {
  const productApi = read('apps/admin-web/src/api/product.ts')
  const productEdit = read('apps/admin-web/src/views/product/edit.vue')
  const createProductDto = read('apps/api/src/product/dto/create-product.dto.ts')
  const productQueryDto = read('apps/api/src/product/dto/product-query.dto.ts')

  assert.match(productApi, /getDetail\(id: string\)/)
  assert.match(productApi, /categoryId\?: string/)
  assert.match(productApi, /brandId\?: string/)
  assert.match(productApi, /encodeURIComponent\(id\)/)
  assert.doesNotMatch(productApi, /type Id = string \| number/)
  assert.match(productEdit, /id:\s*undefined as string \| undefined/)
  assert.match(productEdit, /categoryId:\s*undefined as string \| undefined/)
  assert.match(productEdit, /brandId:\s*undefined as string \| undefined/)
  assert.match(productEdit, /supplierId:\s*undefined as string \| undefined/)
  assert.match(productEdit, /fetchDetail\(String\(route\.params\.id\)\)/)
  assert.match(productEdit, /id:\s*String\(d\.id\)/)
  assert.match(productEdit, /categoryId:\s*d\.categoryId \? String\(d\.categoryId\) : undefined/)
  assert.doesNotMatch(productEdit, /Number\(route\.params\.id\)/)
  assert.doesNotMatch(productEdit, /id:\s*Number\(d\.id\)/)

  assert.match(createProductDto, /type EntityId = string \| number/)
  assert.match(createProductDto, /categoryId!:\s*EntityId/)
  assert.match(createProductDto, /brandId\?:\s*EntityId/)
  assert.match(createProductDto, /supplierId\?:\s*EntityId/)
  assert.equal((createProductDto.match(/@Matches\(\/\^\\d\+\$\//g) || []).length, 3)

  assert.match(productQueryDto, /type EntityId = string \| number/)
  assert.match(productQueryDto, /categoryId\?:\s*EntityId/)
  assert.match(productQueryDto, /productId\?:\s*EntityId/)
  assert.match(productQueryDto, /brandId\?:\s*EntityId/)
  assert.match(productQueryDto, /supplierId\?:\s*EntityId/)
  assert.equal((productQueryDto.match(/@Matches\(\/\^\\d\+\$\//g) || []).length, 4)
})

test('order list and delivery views use real user fields and truthful operation results', () => {
  const orderList = read('apps/admin-web/src/views/order/list.vue')
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')

  assert.match(orderList, /row\.user\?\.nickname \|\| row\.user\?\.phone \|\| '-'/)
  assert.match(delivery, /row\.user\?\.nickname \|\| row\.user\?\.phone \|\| '-'/)
  assert.doesNotMatch(orderList, /prop="userName"/)
  assert.doesNotMatch(delivery, /prop="userName"/)

  assert.match(orderList, /function toLocalDayIso\(value: string, endOfDay: boolean\)/)
  assert.match(orderList, /endOfDay \? 23 : 0/)
  assert.match(orderList, /endOfDay \? 999 : 0/)
  assert.match(orderList, /params\.startDate = toLocalDayIso\(dateRange\.value\[0\], false\)/)
  assert.match(orderList, /params\.endDate = toLocalDayIso\(dateRange\.value\[1\], true\)/)

  assert.match(delivery, /const result = res\.data \|\| \{\}/)
  assert.match(delivery, /const successCount = Number\(result\.successCount \|\| 0\)/)
  assert.match(delivery, /const failCount = Number\(result\.failCount \|\| 0\)/)
  assert.match(delivery, /if \(failCount > 0\)/)
  assert.match(delivery, /批量发货完成：成功 \$\{successCount\} 单，失败 \$\{failCount\} 单/)
})

test('admin order remarks can be saved, cleared and reloaded', () => {
  const controller = read('apps/api/src/order/order.controller.ts')
  const service = read('apps/api/src/order/order.service.ts')
  const remarkDto = read('apps/api/src/order/dto/admin-remark.dto.ts')
  const orderApi = read('apps/admin-web/src/api/order.ts')
  const orderDetail = read('apps/admin-web/src/views/order/detail.vue')

  assert.match(controller, /@RequirePermission\('order:remark'\)/)
  assert.match(controller, /@Body\(\) dto: AdminRemarkDto/)
  assert.match(controller, /select: \{ adminRemark: true \}/)
  assert.match(controller, /adminRemark: order\?\.adminRemark \|\| ''/)
  assert.match(controller, /const adminRemark = dto\.remark\.trim\(\)/)

  assert.match(service, /data: \{ adminRemark: remark \}/)
  assert.match(remarkDto, /@IsString\(\)/)
  assert.match(remarkDto, /@MaxLength\(500/)

  assert.match(orderApi, /remark\(id: string, remark: string\)/)
  assert.match(orderApi, /request\.put\(`\/admin\/order\/remark\/\$\{encodeURIComponent\(id\)\}`, \{ remark \}\)/)

  assert.match(orderDetail, /label="运营备注"[^>]*>\{\{ order\.adminRemark \|\| '-' \}\}/)
  assert.match(orderDetail, /v-permission="'order:remark'"[^>]*@click="showRemarkDialog"/)
  assert.match(orderDetail, /maxlength="500"/)
  assert.match(orderDetail, /adminRemarkInput\.value = String\(order\.value\.adminRemark \|\| ''\)/)
  assert.match(orderDetail, /await orderApi\.remark\(orderId, remark\)/)
  assert.match(orderDetail, /await fetchDetail\(\)/)
})

test('order detail displays the complete discount and deduction breakdown', () => {
  const orderDetail = read('apps/admin-web/src/views/order/detail.vue')

  assert.match(orderDetail, /label="普通优惠">¥\{\{ formatPrice\(order\.discountAmount\) \}\}/)
  assert.match(orderDetail, /label="优惠券优惠">¥\{\{ formatPrice\(order\.couponAmount\) \}\}/)
  assert.match(orderDetail, /label="活动优惠">¥\{\{ formatPrice\(order\.activityDiscountAmount\) \}\}/)
  assert.match(orderDetail, /label="积分抵扣">¥\{\{ formatPrice\(order\.pointsAmount\) \}\}/)
  assert.match(orderDetail, /label="优惠及抵扣合计"/)
  assert.match(orderDetail, /Number\(order\.discountAmount \|\| 0\) \+ Number\(order\.couponAmount \|\| 0\) \+ Number\(order\.activityDiscountAmount \|\| 0\) \+ Number\(order\.pointsAmount \|\| 0\)/)
  assert.doesNotMatch(orderDetail, /label="优惠金额">¥\{\{ formatPrice\(order\.discountAmount\) \}\}/)
})