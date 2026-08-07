<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="售后详情" style="margin-bottom: 20px" />

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card style="margin-bottom: 20px">
          <template #header><span>售后信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="售后单号">{{ detail.aftersaleNo || detail.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ detail.order?.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="售后类型">{{ AFTERSALE_TYPE_MAP[detail.type] || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getAftersaleStatusTagType(detail.status)">
                {{ formatAftersaleStatus(detail.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="退款金额">¥{{ formatPrice(detail.refundAmount) }}</el-descriptions-item>
            <el-descriptions-item label="申请时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="售后原因" :span="2">{{ detail.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="售后描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="asArray(detail.images).length" style="margin-top: 16px">
            <p style="font-weight: 600; margin-bottom: 8px">凭证图片</p>
            <el-image
              v-for="(img, idx) in asArray(detail.images)"
              :key="idx"
              :src="displayImages[idx] || img"
              :preview-src-list="displayImages"
              style="width: 80px; height: 80px; margin-right: 8px"
              fit="cover"
            />
          </div>
        </el-card>

        <el-card>
          <template #header><span>商品信息</span></template>
          <el-table :data="orderItems" stripe>
            <el-table-column label="商品图片" width="80">
              <template #default="{ row }">
                <el-image :src="row.productImage" style="width: 50px; height: 50px" fit="cover" />
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" show-overflow-tooltip />
            <el-table-column label="规格" width="160">
              <template #default="{ row }">{{ formatSkuSpecs(row.skuSpecs) }}</template>
            </el-table-column>
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="小计" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.subtotal) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="margin-bottom: 20px">
          <template #header><span>用户信息</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户">{{ detail.user?.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.user?.phone || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="detail.status === 'pending_review'" v-permission="'order:aftersale:review'">
          <template #header><span>审核操作</span></template>
          <el-form label-width="110px">
            <el-form-item label="审核结果">
              <el-radio-group v-model="auditResult">
                <el-radio value="approve">通过</el-radio>
                <el-radio value="reject">拒绝</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="auditResult === 'approve'" label="退款金额(元)">
              <el-input-number v-model="refundAmountYuan" :min="0.01" :precision="2" style="width: 180px" />
              <div style="width: 100%; margin-top: 6px; color: #909399; font-size: 12px">
                系统会校验可退金额上限
              </div>
            </el-form-item>
            <el-form-item v-if="auditResult === 'reject'" label="拒绝原因">
              <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请输入拒绝原因" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="handleAudit">提交</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-if="needsRefundSync" style="margin-bottom: 20px">
          <el-alert
            title="退款请求结果待核实，请先同步微信退款状态；确认已关闭后才能重新发起普通退款"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 12px"
          />
          <el-button
            v-permission="'order:aftersale:refund'"
            :loading="syncingRefund"
            :disabled="!detail.latestOutRefundNo"
            @click="handleSyncRefund"
          >
            同步微信退款状态
          </el-button>
        </el-card>

        <el-card v-if="needsManualRefund" style="margin-bottom: 20px">
          <el-alert
            title="微信退款异常，不能重新发起普通退款"
            description="请前往微信支付商户平台的交易中心处理此笔异常退款，或按微信支付异常退款流程处理。处理完成后再同步退款状态。"
            type="error"
            :closable="false"
            show-icon
          />
        </el-card>

        <el-card v-if="canRefund" v-permission="'order:aftersale:refund'">
          <template #header><span>{{ isRefundRetry ? '退款重试' : '退款操作' }}</span></template>
          <el-descriptions :column="1" border style="margin-bottom: 16px">
            <el-descriptions-item label="确认退款金额">¥{{ formatPrice(detail.refundAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-button type="primary" :loading="submitting" @click="handleRefund">
            {{ isRefundRetry ? '重新发起退款' : '确认退款' }}
          </el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { aftersaleApi } from '@/api/aftersale'
import { refundApi } from '@/api/refund'
import {
  formatPrice,
  formatDate,
  formatAftersaleStatus,
  getAftersaleStatusTagType,
  priceToFen,
} from '@/utils/format'
import { resolvePrivateFileUrls, revokePrivateObjectUrls } from '@/utils/private-file'
import { asArray } from '@/utils/response'

const AFTERSALE_TYPE_MAP: Record<number, string> = { 1: '仅退款', 2: '退货退款' }
const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const syncingRefund = ref(false)
const detail = ref<any>({})
const auditResult = ref('approve')
const rejectReason = ref('')
const refundAmountYuan = ref(0)
const displayImages = ref<string[]>([])

const orderItems = computed(() => (detail.value.orderItem ? [detail.value.orderItem] : []))
const isRefundRetry = computed(() => {
  return detail.value.status === 'pending_refund' && detail.value.refundRetryable === true
})
const needsRefundSync = computed(() => {
  return detail.value.status === 'pending_refund' && detail.value.refundSyncRequired === true
})
const needsManualRefund = computed(() => {
  return detail.value.status === 'pending_refund' && detail.value.refundManualRequired === true
})
const canRefund = computed(() => {
  return (
    (detail.value.type === 1 && detail.value.status === 'approved') ||
    (detail.value.type === 2 && detail.value.status === 'returned') ||
    isRefundRetry.value
  )
})

function formatSkuSpecs(specs: unknown) {
  if (!specs) return '-'
  if (typeof specs === 'string') return specs
  if (Array.isArray(specs)) return specs.join(' / ')
  if (typeof specs === 'object') return Object.values(specs as Record<string, unknown>).join(' / ')
  return String(specs)
}

async function fetchDetail() {
  try {
    revokePrivateObjectUrls(displayImages.value)
    displayImages.value = []
    const res = await aftersaleApi.getDetail(String(route.params.id))
    detail.value = res.data || {}
    const defaultRefundAmount = detail.value.refundAmount || detail.value.orderItem?.subtotal || 0
    refundAmountYuan.value = defaultRefundAmount / 100
    displayImages.value = await resolvePrivateFileUrls(asArray(detail.value.images))
  } catch (e: any) {
    ElMessage.error(e?.message || '获取售后详情失败')
  }
}

async function handleAudit() {
  if (auditResult.value === 'reject' && !rejectReason.value.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  const refundAmount = priceToFen(refundAmountYuan.value)
  if (auditResult.value === 'approve' && refundAmount <= 0) {
    ElMessage.warning('请输入正确的退款金额')
    return
  }

  const actionLabel = auditResult.value === 'approve' ? `通过并确认退款 ¥${refundAmountYuan.value.toFixed(2)}` : '拒绝'
  try {
    await ElMessageBox.confirm(`确认${actionLabel}该售后申请？`, '审核确认', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  submitting.value = true
  try {
    if (auditResult.value === 'approve') {
      await aftersaleApi.approve(String(detail.value.id), refundAmount)
      ElMessage.success('审核通过')
    } else {
      await aftersaleApi.reject(String(detail.value.id), rejectReason.value.trim())
      ElMessage.success('已拒绝')
    }
    await fetchDetail()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleSyncRefund() {
  const outRefundNo = String(detail.value.latestOutRefundNo || '').trim()
  if (!outRefundNo) {
    ElMessage.warning('退款单号缺失，无法同步')
    return
  }

  syncingRefund.value = true
  try {
    const res = await refundApi.sync(outRefundNo)
    const result = res.data || {}
    if (result.synced === false) {
      ElMessage.warning(result.message || '退款状态暂未完成同步')
    } else {
      ElMessage.success(result.message || '退款状态已同步')
    }
    await fetchDetail()
  } catch {
    // 请求错误由全局拦截器统一提示。
  } finally {
    syncingRefund.value = false
  }
}

async function handleRefund() {
  const refundAmount = Number(detail.value.refundAmount || 0)
  if (refundAmount <= 0) {
    ElMessage.warning('退款金额未设置')
    return
  }

  const actionLabel = isRefundRetry.value ? '重新发起退款' : '确认退款'
  try {
    await ElMessageBox.confirm(`${actionLabel} ¥${formatPrice(refundAmount)}？此操作将发起微信退款，请谨慎操作。`, '退款确认', {
      confirmButtonText: isRefundRetry.value ? '重新发起' : '确认退款',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  submitting.value = true
  try {
    await aftersaleApi.refund(String(detail.value.id))
    ElMessage.success(isRefundRetry.value ? '退款已重新发起' : '退款已发起')
    await fetchDetail()
  } catch (e: any) {
    ElMessage.error(e?.message || '退款失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
})

onUnmounted(() => {
  revokePrivateObjectUrls(displayImages.value)
})
</script>
