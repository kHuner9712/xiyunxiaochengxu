<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>自提核销</span>
      </template>

      <div class="verify-section">
        <el-input
          v-model="pickupCode"
          placeholder="请输入8位自提码"
          maxlength="8"
          size="large"
          style="max-width: 300px"
          @keyup.enter="handlePreview"
        >
          <template #append>
            <el-button type="primary" @click="handlePreview" :loading="previewing">查询</el-button>
          </template>
        </el-input>
      </div>

      <div v-if="preview" class="preview-section">
        <el-descriptions title="订单信息" :column="2" border>
          <el-descriptions-item label="订单号">{{ preview.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="订单ID">{{ preview.orderId }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag :type="getOrderStatusTagType(preview.status) as any">{{ formatOrderStatus(preview.status) }}</el-tag>
            <el-tag v-if="preview.alreadyCompleted" type="info" style="margin-left: 8px">已核销</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ preview.createTime }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{ preview.userName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ preview.userPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="自提点">{{ preview.pickupStoreName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="自提地址">{{ preview.pickupStoreAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ preview.pickupContactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="自提码">
            <span class="pickup-code-text">{{ preview.pickupCode }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单金额">{{ formatPrice(preview.payAmount) }}</el-descriptions-item>
          <el-descriptions-item v-if="preview.pickedUpAt" label="核销时间">{{ preview.pickedUpAt }}</el-descriptions-item>
        </el-descriptions>

        <div class="goods-section">
          <div class="goods-title">商品清单</div>
          <el-table :data="preview.items" border size="small">
            <el-table-column label="商品" min-width="200">
              <template #default="{ row }">
                <div class="goods-cell">
                  <el-image :src="row.productImage" fit="cover" class="goods-image" />
                  <span>{{ row.productName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="规格" prop="skuName" min-width="120" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatPrice(row.price) }}</template>
            </el-table-column>
            <el-table-column label="数量" prop="quantity" width="80" />
            <el-table-column label="小计" width="100">
              <template #default="{ row }">{{ formatPrice(row.subtotal) }}</template>
            </el-table-column>
          </el-table>
        </div>

        <div class="action-section">
          <el-button @click="resetPreview">取消</el-button>
          <el-button
            type="success"
            :loading="verifying"
            :disabled="preview.alreadyCompleted || preview.status !== 'pending_pickup'"
            @click="handleVerify"
          >
            {{ preview.alreadyCompleted ? '已核销' : '确认核销' }}
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { pickupStoreApi, type PickupOrderPreview } from '@/api/pickup-store'
import { formatPrice, formatOrderStatus, getOrderStatusTagType } from '@/utils/format'

const pickupCode = ref('')
const previewing = ref(false)
const verifying = ref(false)
const preview = ref<PickupOrderPreview | null>(null)

async function handlePreview() {
  if (!pickupCode.value || pickupCode.value.length !== 8) {
    ElMessage.warning('请输入8位自提码')
    return
  }
  previewing.value = true
  preview.value = null
  try {
    const res = await pickupStoreApi.previewPickupCode(pickupCode.value)
    preview.value = res.data || res
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '查询失败'
    ElMessage.error(msg)
  } finally {
    previewing.value = false
  }
}

async function handleVerify() {
  if (!preview.value) return
  verifying.value = true
  try {
    await pickupStoreApi.verifyPickupCode(pickupCode.value)
    ElMessage.success('核销成功')
    resetPreview()
    pickupCode.value = ''
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '核销失败'
    ElMessage.error(msg)
  } finally {
    verifying.value = false
  }
}

function resetPreview() {
  preview.value = null
}
</script>

<style scoped>
.verify-section {
  display: flex;
  justify-content: center;
  padding: 30px 0;
}

.preview-section {
  margin-top: 20px;
}

.goods-section {
  margin-top: 20px;
}

.goods-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}

.goods-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.goods-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  flex-shrink: 0;
}

.pickup-code-text {
  font-family: monospace;
  font-size: 16px;
  font-weight: 700;
  color: #e6a23c;
  letter-spacing: 2px;
}

.action-section {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
