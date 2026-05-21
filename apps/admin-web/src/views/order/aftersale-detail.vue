<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="售后详情" style="margin-bottom: 20px" />

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card style="margin-bottom: 20px">
          <template #header><span>售后信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="售后单号">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="售后类型">{{ { 1: '仅退款', 2: '退货退款', 3: '换货' }[detail.type] || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detail.status === 0 ? 'warning' : detail.status === 4 ? 'success' : detail.status === 2 ? 'danger' : 'info'">
                {{ formatAftersaleStatus(detail.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="退款金额">¥{{ formatPrice(detail.refundAmount) }}</el-descriptions-item>
            <el-descriptions-item label="申请时间">{{ formatDate(detail.createTime) }}</el-descriptions-item>
            <el-descriptions-item label="售后原因" :span="2">{{ detail.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="售后描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="detail.images?.length" style="margin-top: 16px">
            <p style="font-weight: 600; margin-bottom: 8px">凭证图片</p>
            <el-image
              v-for="(img, idx) in detail.images"
              :key="idx"
              :src="img"
              :preview-src-list="detail.images"
              style="width: 80px; height: 80px; margin-right: 8px"
              fit="cover"
            />
          </div>
        </el-card>

        <el-card>
          <template #header><span>商品信息</span></template>
          <el-table :data="detail.items || []" stripe>
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
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="margin-bottom: 20px">
          <template #header><span>用户信息</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户">{{ detail.userName }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.userPhone }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="detail.status === 0">
          <template #header><span>审核操作</span></template>
          <el-form label-width="100px">
            <el-form-item label="审核结果">
              <el-radio-group v-model="auditResult">
                <el-radio label="approve">通过</el-radio>
                <el-radio label="reject">拒绝</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="auditResult === 'reject'" label="拒绝原因">
              <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请输入拒绝原因" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="handleAudit">提交</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-if="detail.status === 1">
          <template #header><span>退款操作</span></template>
          <el-form label-width="100px">
            <el-form-item label="退款金额(元)">
              <el-input-number v-model="refundAmountYuan" :min="0" :precision="2" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="handleRefund">确认退款</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { aftersaleApi } from '@/api/aftersale'
import { formatPrice, formatDate, formatAftersaleStatus, priceToFen } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const detail = ref<any>({})
const auditResult = ref('approve')
const rejectReason = ref('')
const refundAmountYuan = ref(0)

async function fetchDetail() {
  try {
    const res = await aftersaleApi.getDetail(Number(route.params.id))
    detail.value = res.data || {}
    refundAmountYuan.value = (res.data?.refundAmount || 0) / 100
  } catch {}
}

async function handleAudit() {
  submitting.value = true
  try {
    if (auditResult.value === 'approve') {
      await aftersaleApi.approve(detail.value.id)
      ElMessage.success('审核通过')
    } else {
      if (!rejectReason.value) {
        ElMessage.warning('请输入拒绝原因')
        return
      }
      await aftersaleApi.reject(detail.value.id, rejectReason.value)
      ElMessage.success('已拒绝')
    }
    fetchDetail()
  } catch {} finally {
    submitting.value = false
  }
}

async function handleRefund() {
  submitting.value = true
  try {
    await aftersaleApi.refund(detail.value.id, priceToFen(refundAmountYuan.value))
    ElMessage.success('退款成功')
    fetchDetail()
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>
