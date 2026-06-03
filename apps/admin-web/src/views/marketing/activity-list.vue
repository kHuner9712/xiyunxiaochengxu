<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="活动名称">
          <el-input v-model="searchForm.name" placeholder="请输入活动名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="未开始" :value="0" />
            <el-option label="进行中" :value="1" />
            <el-option label="已结束" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button v-permission="'marketing:activity'" type="primary" @click="router.push('/marketing/activity-edit')">新增活动</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="活动名称" min-width="150" />
        <el-table-column label="活动类型" width="100">
          <template #default="{ row }">{{ ACTIVITY_TYPE_MAP[row.type] || '-' }}</template>
        </el-table-column>
        <el-table-column label="活动时间" min-width="200">
          <template #default="{ row }">{{ formatDate(row.startTime) }} ~ {{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : row.status === 0 ? 'warning' : 'info'" size="small">
              {{ formatActivityStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:activity'" type="primary" link @click="router.push(`/marketing/activity-edit/${row.id}`)">编辑</el-button>
            <el-button v-permission="'marketing:activity'" v-if="row.status === 0 || row.status === 1" type="warning" link @click="handleEnd(row)">结束</el-button>
            <el-button v-permission="'marketing:activity'" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { activityApi } from '@/api/activity'
import { formatDate, formatActivityStatus } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const ACTIVITY_TYPE_MAP: Record<number, string> = { 1: '限时折扣', 2: '满减活动', 3: '满赠活动', 4: '组合套餐', 5: '新人礼包' }
const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])

const searchForm = reactive({
  name: '',
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const res = await activityApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch {} finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.status = undefined
  handleSearch()
}

async function handleEnd(row: any) {
  try {
    await ElMessageBox.confirm('确定结束该活动吗？', '提示', { type: 'warning' })
    await activityApi.updateStatus(row.id, 2)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该活动吗？', '提示', { type: 'warning' })
    await activityApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

fetchList()
</script>
