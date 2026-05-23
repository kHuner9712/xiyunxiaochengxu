<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="事件详情" style="margin-bottom: 20px" />

    <el-card>
      <template #header><span>事件信息</span></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="ID">{{ detail.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="事件类型">{{ detail.eventType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detail.bizType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ detail.bizId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="级别">
          <el-tag :type="levelTagType[detail.level] || 'info'" :style="{ fontWeight: detail.level === 'critical' ? 'bold' : 'normal' }">
            {{ levelMap[detail.level] || detail.level || '-' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="消息" :span="2">{{ detail.message || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header><span>Payload</span></template>
      <pre v-if="detail.payload" style="max-height: 500px; overflow: auto; background: #f5f7fa; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.6"><code>{{ formatJson(detail.payload) }}</code></pre>
      <span v-else>-</span>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { businessEventApi } from '@/api/business-event'
import { formatDate } from '@/utils/format'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const detail = ref<any>({})

const levelMap: Record<string, string> = {
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  critical: 'Critical',
}

const levelTagType: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
  info: 'info',
  warn: 'warning',
  error: 'danger',
  critical: 'danger',
}

function formatJson(data: any): string {
  if (!data) return '-'
  try {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

async function fetchDetail() {
  try {
    const res = await businessEventApi.getDetail(route.params.id as string)
    detail.value = res.data || {}
  } catch (e: any) {
    ElMessage.error(e?.message || '查询事件详情失败')
  }
}

onMounted(() => {
  fetchDetail()
})
</script>
