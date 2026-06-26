<template>
  <div class="page-container">
    <div class="table-card">
      <el-alert type="info" :closable="false" style="margin-bottom: 16px">
        输入用户出示的权益核销码，先预览权益信息，确认无误后核销。重复核销会被拒绝。
      </el-alert>
      <el-form inline>
        <el-form-item label="核销码">
          <el-input v-model="verifyCode" placeholder="请输入权益核销码" style="width: 240px" @keyup.enter="handlePreview" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="previewLoading" @click="handlePreview">查询预览</el-button>
          <el-button type="success" :loading="verifyLoading" :disabled="!canVerify" @click="handleVerify">确认核销</el-button>
          <el-button @click="handleReset">清空</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card" style="margin-top: 16px" v-loading="previewLoading">
      <div v-if="!preview" style="color: #909399; text-align: center; padding: 32px 0">
        请输入核销码并点击「查询预览」
      </div>
      <div v-else>
        <el-descriptions :column="2" border title="权益信息">
          <el-descriptions-item label="核销码">
            <el-tag type="warning">{{ preview.verifyCode }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(preview.status) as any">{{ statusLabel(preview.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="用户">{{ preview.nickname || '-' }} / {{ preview.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="权益包">{{ preview.packageName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="权益项">{{ preview.itemName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ itemTypeLabel(preview.itemType) }}</el-descriptions-item>
          <el-descriptions-item label="原价">{{ preview.originalValue != null ? '¥' + formatPrice(preview.originalValue) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="商家">{{ preview.merchantName || '-' }} {{ preview.merchantContactPhone ? '/ ' + preview.merchantContactPhone : '' }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ preview.storeName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="门店地址">{{ preview.storeAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="有效期">
            {{ formatDate(preview.validFrom) }} 至 {{ preview.validTo ? formatDate(preview.validTo) : '长期' }}
          </el-descriptions-item>
          <el-descriptions-item label="核销时间">{{ preview.usedAt ? formatDate(preview.usedAt) : '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="!preview.canVerify"
          type="error"
          :title="preview.reason || '不可核销'"
          :closable="false"
          style="margin-top: 16px"
        />
        <el-alert
          v-else
          type="success"
          title="该权益可核销"
          :closable="false"
          style="margin-top: 16px"
        />

        <el-form-item label="核销备注" style="margin-top: 16px">
          <el-input v-model="remark" placeholder="可选，核销备注" style="width: 360px" />
        </el-form-item>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { benefitPackageApi } from '@/api/benefit-package'
import { formatDate, formatPrice } from '@/utils/format'

const verifyCode = ref('')
const remark = ref('')
const preview = ref<any>(null)
const previewLoading = ref(false)
const verifyLoading = ref(false)

const canVerify = computed(() => !!preview.value?.canVerify)

function statusLabel(s: string) {
  return { unused: '未使用', used: '已使用', expired: '已过期', cancelled: '已取消', refunded: '已退款' }[s] || s
}
function statusTagType(s: string) {
  return { unused: 'success', used: 'info', expired: 'warning', cancelled: 'info', refunded: 'info' }[s] || 'info'
}
function itemTypeLabel(t: string) {
  return { service: '服务', physical: '实物', coupon: '优惠券', other: '其他' }[t] || t
}

async function handlePreview() {
  if (!verifyCode.value.trim()) {
    ElMessage.warning('请输入核销码')
    return
  }
  previewLoading.value = true
  preview.value = null
  try {
    const res = await benefitPackageApi.verifyPreview(verifyCode.value.trim().toUpperCase())
    preview.value = res.data
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '查询失败')
  } finally {
    previewLoading.value = false
  }
}

async function handleVerify() {
  if (!preview.value?.canVerify) return
  verifyLoading.value = true
  try {
    await benefitPackageApi.verify({
      verifyCode: preview.value.verifyCode,
      remark: remark.value || undefined,
    })
    ElMessage.success('核销成功')
    handleReset()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '核销失败')
  } finally {
    verifyLoading.value = false
  }
}

function handleReset() {
  verifyCode.value = ''
  remark.value = ''
  preview.value = null
}
</script>
