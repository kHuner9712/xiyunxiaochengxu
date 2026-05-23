<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="退款详情" style="margin-bottom: 20px" />

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card style="margin-bottom: 20px">
          <template #header><span>退款信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="退款单号">{{ detail.refundNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="微信退款单号">{{ detail.refundId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="商户退款单号">{{ detail.outRefundNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="REFUND_STATUS_TAG_TYPE[detail.status] || 'info'">
                {{ REFUND_STATUS_MAP[detail.status] || detail.status || '-' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="退款金额">¥{{ formatPrice(detail.refundAmount) }}</el-descriptions-item>
            <el-descriptions-item label="订单实付金额">¥{{ formatPrice(detail.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="退款原因" :span="2">{{ detail.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="回调时间">{{ formatDate(detail.notifiedAt) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>订单信息</span></template>
          <el-descriptions :column="2" border v-if="detail.order">
            <el-descriptions-item label="订单号">{{ detail.order.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单ID">{{ detail.orderId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单总金额">¥{{ formatPrice(detail.order.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="实付金额">¥{{ formatPrice(detail.order.payAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无订单信息" :image-size="60" />
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>关联信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="售后单ID">{{ detail.aftersaleId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="支付记录ID">{{ detail.paymentId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="商户订单号">{{ detail.outTradeNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="微信交易号">{{ detail.transactionId || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>请求/响应数据</span></template>
          <el-row :gutter="20">
            <el-col :span="12">
              <p style="font-weight: 600; margin-bottom: 8px">请求参数 (rawRequest)</p>
              <el-input
                type="textarea"
                :model-value="formatJson(detail.rawRequest)"
                :rows="12"
                readonly
                style="font-family: monospace"
              />
            </el-col>
            <el-col :span="12">
              <p style="font-weight: 600; margin-bottom: 8px">响应数据 (rawResponse)</p>
              <el-input
                type="textarea"
                :model-value="formatJson(detail.rawResponse)"
                :rows="12"
                readonly
                style="font-family: monospace"
              />
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header><span>退款时间线</span></template>
          <el-timeline>
            <el-timeline-item timestamp="创建退款" :type="detail.createdAt ? 'primary' : 'info'" placement="top">
              {{ formatDate(detail.createdAt) }}
            </el-timeline-item>
            <el-timeline-item timestamp="回调通知" :type="detail.notifiedAt ? 'success' : 'info'" placement="top">
              {{ formatDate(detail.notifiedAt) }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { refundApi } from '@/api/refund'
import { formatPrice, formatDate } from '@/utils/format'

const REFUND_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  success: '退款成功',
  failed: '退款失败',
  closed: '已关闭',
  abnormal: '异常',
}

const REFUND_STATUS_TAG_TYPE: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
  pending: 'warning',
  processing: 'primary',
  success: 'success',
  failed: 'danger',
  closed: 'info',
  abnormal: 'danger',
}

const router = useRouter()
const route = useRoute()
const detail = ref<any>({})

function formatJson(data: any): string {
  if (!data) return '-'
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

async function fetchDetail() {
  try {
    const res = await refundApi.getDetail(route.params.id as string)
    detail.value = res.data || {}
  } catch {}
}

onMounted(() => {
  fetchDetail()
})
</script>
