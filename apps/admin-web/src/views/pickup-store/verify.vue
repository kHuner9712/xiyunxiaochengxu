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
          @keyup.enter="handleVerify"
        >
          <template #append>
            <el-button type="primary" @click="handleVerify" :loading="verifying">核销</el-button>
          </template>
        </el-input>
      </div>

      <el-result v-if="verifyResult" icon="success" title="核销成功" :sub-title="`订单号：${verifyResult.orderNo}`">
        <template #extra>
          <el-descriptions :column="1" border style="max-width: 400px">
            <el-descriptions-item label="订单ID">{{ verifyResult.orderId }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ verifyResult.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="核销时间">{{ verifyResult.pickedUpAt }}</el-descriptions-item>
          </el-descriptions>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { pickupStoreApi } from '@/api/pickup-store'

const pickupCode = ref('')
const verifying = ref(false)
const verifyResult = ref<any>(null)

async function handleVerify() {
  if (!pickupCode.value || pickupCode.value.length !== 8) {
    ElMessage.warning('请输入8位自提码')
    return
  }
  verifying.value = true
  verifyResult.value = null
  try {
    const res = await pickupStoreApi.verifyPickupCode(pickupCode.value)
    verifyResult.value = res.data || res
    ElMessage.success('核销成功')
    pickupCode.value = ''
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '核销失败'
    ElMessage.error(msg)
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.verify-section {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
</style>
