<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="事件级别">
          <el-select v-model="searchForm.level" placeholder="请选择" clearable>
            <el-option label="Info" value="info" />
            <el-option label="Warn" value="warn" />
            <el-option label="Error" value="error" />
            <el-option label="Critical" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务类型">
          <el-input v-model="searchForm.bizType" placeholder="请输入业务类型" clearable />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input v-model="searchForm.eventType" placeholder="请输入事件类型" clearable />
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading" :row-class-name="rowClassName" @row-click="handleRowClick" style="cursor: pointer">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="eventType" label="事件类型" width="160" />
        <el-table-column prop="bizType" label="业务类型" width="120" />
        <el-table-column prop="bizId" label="业务ID" width="120" />
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="levelTagType[row.level] || 'info'" :style="{ fontWeight: row.level === 'critical' ? 'bold' : 'normal' }" size="small">
              {{ levelMap[row.level] || row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="消息" show-overflow-tooltip min-width="200" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { businessEventApi } from '@/api/business-event'
import { formatDate } from '@/utils/format'
import { ElMessage } from 'element-plus'
import { asArray, paginationTotal } from '@/utils/response'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const dateRange = ref<string[]>([])

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

const searchForm = reactive({
  level: undefined as string | undefined,
  bizType: '',
  eventType: '',
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...searchForm,
    }
    if (dateRange.value?.length === 2) {
      params.createdAt = `${dateRange.value[0]},${dateRange.value[1]}`
    }
    const res = await businessEventApi.getList(params)
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '查询业务事件失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.level = undefined
  searchForm.bizType = ''
  searchForm.eventType = ''
  dateRange.value = []
  handleSearch()
}

function rowClassName({ row }: { row: any }): string {
  if (row.level === 'critical') return 'critical-row'
  if (row.level === 'error') return 'error-row'
  return ''
}

function handleRowClick(row: any) {
  router.push(`/system/business-event-detail/${row.id}`)
}

fetchList()
</script>

<style scoped>
:deep(.critical-row) {
  --el-table-tr-bg-color: #fef0f0;
}
:deep(.error-row) {
  --el-table-tr-bg-color: #fdf6ec;
}
</style>
