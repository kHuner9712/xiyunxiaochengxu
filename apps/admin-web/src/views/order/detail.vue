<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="订单详情" style="margin-bottom: 20px" />

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card style="margin-bottom: 20px">
          <template #header><span>订单信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="getOrderStatusTagType(order.status) as any">{{ formatOrderStatus(order.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ formatDate(order.createTime) }}</el-descriptions-item>
            <el-descriptions-item label="付款时间">{{ formatDate(order.payTime) }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{ formatDate(order.deliveryTime) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatDate(order.finishTime) }}</el-descriptions-item>
            <el-descriptions-item label="商品金额">¥{{ formatPrice(order.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="运费">¥{{ formatPrice(order.freightAmount) }}</el-descriptions-item>
            <el-descriptions-item label="普通优惠">¥{{ formatPrice(order.discountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="优惠券优惠">¥{{ formatPrice(order.couponAmount) }}</el-descriptions-item>
            <el-descriptions-item label="活动优惠">¥{{ formatPrice(order.activityDiscountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="积分抵扣">¥{{ formatPrice(order.pointsAmount) }}</el-descriptions-item>
            <el-descriptions-item label="优惠及抵扣合计">
              ¥{{ formatPrice(Number(order.discountAmount || 0) + Number(order.couponAmount || 0) + Number(order.activityDiscountAmount || 0) + Number(order.pointsAmount || 0)) }}
            </el-descriptions-item>
            <el-descriptions-item label="实付金额">¥{{ formatPrice(order.payAmount) }}</el-descriptions-item>
            <el-descriptions-item label="买家备注" :span="2">{{ order.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="运营备注" :span="2">{{ order.adminRemark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>商品列表</span></template>
          <el-table :data="asArray(order.items)" stripe>
            <el-table-column label="商品图片" width="80">
              <template #default="{ row }">
                <el-image :src="row.productImage" style="width: 50px; height: 50px" fit="cover" />
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" show-overflow-tooltip />
            <el-table-column prop="skuName" label="规格" width="120" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="小计" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.subtotal) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card v-if="order.logistics" style="margin-bottom: 20px">
          <template #header><span>物流信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="物流公司">{{ order.logistics.company }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ order.logistics.trackingNo }}</el-descriptions-item>
          </el-descriptions>
          <el-timeline style="margin-top: 16px">
            <el-timeline-item
              v-for="(item, idx) in asArray(order.logistics?.traces)"
              :key="idx"
              :timestamp="item.time"
              placement="top"
            >
              {{ item.context }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="margin-bottom: 20px">
          <template #header><span>收货信息</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="收货人">{{ order.consignee }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ order.phone }}</el-descriptions-item>
            <el-descriptions-item label="收货地址">{{ order.address }}</el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup'" label="配送方式">到店自提</el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup' && order.pickupStoreName" label="自提点">{{ order.pickupStoreName }}</el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup' && order.pickupStoreAddress" label="自提地址">{{ order.pickupStoreAddress }}</el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup' && order.pickupContactPhone" label="联系电话">{{ order.pickupContactPhone }}</el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup' && order.pickupCode" label="自提码">
              <el-tag type="warning" size="large">{{ order.pickupCode }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="order.fulfillmentType === 'pickup' && order.pickedUpAt" label="核销时间">{{ order.pickedUpAt }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>推广来源</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="来源类型">
              <el-tag :type="getOrderSourceTagType(order.sourceType) as any">
                {{ formatOrderSourceType(order.sourceType) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="推广码">{{ order.sourceCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="推荐人ID">{{ order.referrerUserId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="分享记录ID">{{ order.shareRecordId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="分享活动ID">{{ order.shareCampaignId || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>操作日志</span></template>
          <el-timeline>
            <el-timeline-item
              v-for="(log, idx) in asArray(order.operationLogs)"
              :key="idx"
              :timestamp="formatDate(log.createTime)"
              placement="top"
            >
              {{ log.content }} <span>（{{ formatOrderLogOperator(log) }}）</span>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card>
          <template #header><span>订单操作</span></template>
          <div style="display: flex; flex-direction: column; gap: 10px">
            <el-button v-permission="'order:remark'" @click="showRemarkDialog">编辑运营备注</el-button>
            <el-button v-if="order.status === 'pending_delivery'" v-permission="'order:deliver'" type="primary" :disabled="submitting" @click="showDeliverDialog">发货</el-button>
            <el-button v-if="order.status === 'pending_pickup'" v-permission="'pickup:verify'" type="success" :disabled="submitting" @click="showVerifyPickupDialog">核销自提</el-button>
            <el-button v-if="order.status === 'pending_payment'" v-permission="'order:cancel'" type="danger" :loading="submitting" :disabled="submitting" @click="handleCancelOrder">取消订单</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="deliverVisible" title="发货" width="500px" destroy-on-close>
      <el-form ref="deliverFormRef" :model="deliverForm" :rules="deliverRules" label-width="100px">
        <el-form-item label="物流公司" prop="logisticsCompany">
          <el-select v-model="deliverForm.logisticsCompany" placeholder="请选择物流公司" filterable>
            <el-option label="顺丰速运" value="顺丰速运" />
            <el-option label="中通快递" value="中通快递" />
            <el-option label="圆通速递" value="圆通速递" />
            <el-option label="韵达快递" value="韵达快递" />
            <el-option label="申通快递" value="申通快递" />
            <el-option label="极兔速递" value="极兔速递" />
            <el-option label="京东物流" value="京东物流" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号" prop="logisticsNo">
          <el-input v-model="deliverForm.logisticsNo" placeholder="请输入物流单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="deliverVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="submitting" @click="handleDeliver">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyPickupVisible" title="核销自提" width="420px" destroy-on-close>
      <el-alert
        :title="`即将核销订单 ${order.orderNo || '-'}`"
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form label-width="80px">
        <el-form-item label="自提码">
          <el-input :model-value="verifyPickupCode" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="verifyPickupVisible = false">取消</el-button>
        <el-button type="success" :loading="submitting" :disabled="submitting" @click="handleVerifyPickup">确认核销</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="remarkVisible" title="运营备注" width="520px" destroy-on-close>
      <el-input
        v-model="adminRemarkInput"
        type="textarea"
        :rows="5"
        maxlength="500"
        show-word-limit
        placeholder="填写订单处理、沟通或异常情况；留空保存可清除备注"
      />
      <template #footer>
        <el-button :disabled="remarkSubmitting" @click="remarkVisible = false">取消</el-button>
        <el-button type="primary" :loading="remarkSubmitting" :disabled="remarkSubmitting" @click="handleSaveRemark">保存备注</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi } from '@/api/order'
import { pickupStoreApi } from '@/api/pickup-store'
import { formatPrice, formatDate, formatOrderStatus, getOrderStatusTagType, formatOrderSourceType, getOrderSourceTagType } from '@/utils/format'
import { asArray } from '@/utils/response'

const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const remarkSubmitting = ref(false)
const deliverVisible = ref(false)
const verifyPickupVisible = ref(false)
const remarkVisible = ref(false)
const deliverFormRef = ref<FormInstance>()
const verifyPickupCode = ref('')
const adminRemarkInput = ref('')

const order = ref<any>({})

const deliverForm = reactive({
  orderId: undefined as string | undefined,
  logisticsCompany: '',
  logisticsNo: '',
})

const deliverRules: FormRules = {
  logisticsCompany: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
  logisticsNo: [{ required: true, message: '请输入物流单号', trigger: 'blur' }],
}

async function fetchDetail() {
  try {
    const res = await orderApi.getDetail(String(route.params.id))
    order.value = res.data || {}
  } catch {}
}

function formatOrderLogOperator(log: any) {
  if (log?.operatorType === 'admin') return '管理员'
  if (log?.operatorType === 'system') return '系统'
  if (log?.operatorType === 'user') return '用户'
  return String(log?.operator || '未知')
}

function showRemarkDialog() {
  if (remarkSubmitting.value) return
  const orderId = String(order.value.id || '')
  if (!/^\d+$/.test(orderId)) {
    ElMessage.warning('订单ID无效，请刷新后重试')
    return
  }

  adminRemarkInput.value = String(order.value.adminRemark || '')
  remarkVisible.value = true
}

async function handleSaveRemark() {
  if (remarkSubmitting.value) return
  const orderId = String(order.value.id || '')
  if (!/^\d+$/.test(orderId)) {
    ElMessage.warning('订单ID无效，请刷新后重试')
    return
  }

  const remark = adminRemarkInput.value.trim()
  if (remark.length > 500) {
    ElMessage.warning('订单备注不能超过500个字符')
    return
  }

  remarkSubmitting.value = true
  try {
    await orderApi.remark(orderId, remark)
    ElMessage.success(remark ? '运营备注已保存' : '运营备注已清除')
    remarkVisible.value = false
    await fetchDetail()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存运营备注失败')
  } finally {
    remarkSubmitting.value = false
  }
}

function showDeliverDialog() {
  if (submitting.value) return
  const orderId = String(order.value.id || '')
  if (!/^\d+$/.test(orderId)) {
    ElMessage.warning('订单ID无效，请刷新后重试')
    return
  }

  deliverForm.orderId = orderId
  deliverForm.logisticsCompany = ''
  deliverForm.logisticsNo = ''
  deliverFormRef.value?.clearValidate()
  deliverVisible.value = true
}

async function handleDeliver() {
  if (submitting.value) return
  submitting.value = true
  try {
    const valid = await deliverFormRef.value?.validate().catch(() => false)
    if (!valid) return

    const orderId = deliverForm.orderId
    const logisticsCompany = deliverForm.logisticsCompany.trim()
    const logisticsNo = deliverForm.logisticsNo.trim()
    if (!orderId || !logisticsCompany || !logisticsNo) {
      ElMessage.warning('请完整填写发货信息')
      return
    }

    await orderApi.deliver({ orderId, logisticsCompany, logisticsNo })
    ElMessage.success('发货成功')
    deliverVisible.value = false
    await fetchDetail()
  } catch {} finally {
    submitting.value = false
  }
}

async function handleCancelOrder() {
  if (submitting.value) return
  submitting.value = true
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消订单', { inputPattern: /\S+/, inputErrorMessage: '请输入取消原因' })
    const reason = String(value || '').trim()
    if (!reason) {
      ElMessage.warning('请输入取消原因')
      return
    }
    await orderApi.cancel(String(order.value.id), reason)
    ElMessage.success('取消成功')
    await fetchDetail()
  } catch {
    // 用户关闭确认框或请求失败时由 finally 统一释放操作锁。
  } finally {
    submitting.value = false
  }
}

function showVerifyPickupDialog() {
  if (submitting.value) return
  if (order.value.status !== 'pending_pickup') {
    ElMessage.warning('当前订单状态不可核销')
    return
  }

  const code = String(order.value.pickupCode || '').trim()
  if (!/^\d{8}$/.test(code)) {
    ElMessage.warning('当前订单自提码无效，请刷新后重试')
    return
  }

  verifyPickupCode.value = code
  verifyPickupVisible.value = true
}

async function handleVerifyPickup() {
  if (submitting.value) return
  submitting.value = true
  try {
    const code = verifyPickupCode.value
    const currentCode = String(order.value.pickupCode || '').trim()
    if (order.value.status !== 'pending_pickup' || !/^\d{8}$/.test(code) || code !== currentCode) {
      ElMessage.warning('订单或自提码已变化，请刷新后重试')
      verifyPickupVisible.value = false
      return
    }

    await pickupStoreApi.verifyPickupCode(code)
    ElMessage.success('核销成功')
    verifyPickupVisible.value = false
    verifyPickupCode.value = ''
    await fetchDetail()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '核销失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>
