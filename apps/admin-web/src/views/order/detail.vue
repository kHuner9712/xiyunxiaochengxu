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
            <el-descriptions-item label="订单金额">¥{{ formatPrice(order.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="实付金额">¥{{ formatPrice(order.payAmount) }}</el-descriptions-item>
            <el-descriptions-item label="运费">¥{{ formatPrice(order.freightAmount) }}</el-descriptions-item>
            <el-descriptions-item label="优惠金额">¥{{ formatPrice(order.discountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="买家备注" :span="2">{{ order.remark || '-' }}</el-descriptions-item>
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
          <template #header><span>操作日志</span></template>
          <el-timeline>
            <el-timeline-item
              v-for="(log, idx) in asArray(order.operationLogs)"
              :key="idx"
              :timestamp="formatDate(log.createTime)"
              placement="top"
            >
              {{ log.content }} <span v-if="log.operator">（{{ log.operator }}）</span>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card>
          <template #header><span>订单操作</span></template>
          <div style="display: flex; flex-direction: column; gap: 10px">
            <el-button v-if="order.status === 'pending_delivery'" v-permission="'order:delivery'" type="primary" @click="showDeliverDialog">发货</el-button>
            <el-button v-if="order.status === 'pending_pickup'" v-permission="'order:delivery'" type="success" @click="showVerifyPickupDialog">核销自提</el-button>
            <el-button v-if="order.status === 'pending_payment'" v-permission="'order:detail'" type="danger" @click="handleCancelOrder">取消订单</el-button>
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
        <el-button @click="deliverVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleDeliver">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyPickupVisible" title="核销自提" width="400px" destroy-on-close>
      <el-form :model="verifyPickupForm" label-width="80px">
        <el-form-item label="自提码">
          <el-input v-model="verifyPickupForm.pickupCode" placeholder="请输入8位自提码" maxlength="8" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyPickupVisible = false">取消</el-button>
        <el-button type="success" :loading="submitting" @click="handleVerifyPickup">确认核销</el-button>
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
import { formatPrice, formatDate, formatOrderStatus, getOrderStatusTagType } from '@/utils/format'
import { asArray } from '@/utils/response'

const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const deliverVisible = ref(false)
const verifyPickupVisible = ref(false)
const deliverFormRef = ref<FormInstance>()

const order = ref<any>({})

const deliverForm = reactive({
  orderId: undefined as number | undefined,
  logisticsCompany: '',
  logisticsNo: '',
})

const verifyPickupForm = reactive({
  pickupCode: '',
})

const deliverRules: FormRules = {
  logisticsCompany: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
  logisticsNo: [{ required: true, message: '请输入物流单号', trigger: 'blur' }],
}

async function fetchDetail() {
  try {
    const res = await orderApi.getDetail(route.params.id as string)
    order.value = res.data || {}
  } catch {}
}

function showDeliverDialog() {
  deliverForm.orderId = order.value.id
  deliverForm.logisticsCompany = ''
  deliverForm.logisticsNo = ''
  deliverVisible.value = true
}

async function handleDeliver() {
  const valid = await deliverFormRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await orderApi.deliver(deliverForm as any)
    ElMessage.success('发货成功')
    deliverVisible.value = false
    fetchDetail()
  } catch {} finally {
    submitting.value = false
  }
}

async function handleCancelOrder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消订单', { inputPattern: /.+/, inputErrorMessage: '请输入取消原因' })
    await orderApi.cancel(order.value.id, value)
    ElMessage.success('取消成功')
    fetchDetail()
  } catch {}
}

function showVerifyPickupDialog() {
  verifyPickupForm.pickupCode = order.value.pickupCode || ''
  verifyPickupVisible.value = true
}

async function handleVerifyPickup() {
  if (!verifyPickupForm.pickupCode) {
    ElMessage.warning('请输入自提码')
    return
  }
  submitting.value = true
  try {
    await pickupStoreApi.verifyPickupCode(verifyPickupForm.pickupCode)
    ElMessage.success('核销成功')
    verifyPickupVisible.value = false
    fetchDetail()
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
