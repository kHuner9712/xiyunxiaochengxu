<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="标题">
          <el-input v-model="searchForm.title" placeholder="请输入标题" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable>
            <el-option label="文章" :value="1" />
            <el-option label="视频" :value="2" />
            <el-option label="图文" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="已发布" :value="1" />
            <el-option label="草稿" :value="0" />
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
        <el-button v-permission="'content:edit'" type="primary" @click="router.push('/content/edit')">新增内容</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="封面" width="100">
          <template #default="{ row }">
            <el-image v-if="row.coverImage" :src="row.coverImage" style="width: 60px; height: 40px" fit="cover" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" show-overflow-tooltip min-width="200" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">{{ { 1: '文章', 2: '视频', 3: '图文' }[row.type] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览量" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="180">
          <template #default="{ row }">{{ formatDate(row.publishTime || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'content:edit'" type="primary" link @click="router.push(`/content/edit/${row.id}`)">编辑</el-button>
            <el-button v-permission="'content:edit'" :type="row.status === 1 ? 'warning' : 'success'" link @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '下架' : '发布' }}
            </el-button>
            <el-button v-permission="'content:edit'" type="danger" link @click="handleDelete(row)">删除</el-button>
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
import { contentApi } from '@/api/content'
import { formatDate } from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])

const searchForm = reactive({
  title: '',
  type: undefined as number | undefined,
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const res = await contentApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.title = ''
  searchForm.type = undefined
  searchForm.status = undefined
  handleSearch()
}

async function handleToggleStatus(row: any) {
  try {
    await contentApi.updateStatus(row.id, row.status === 1 ? 0 : 1)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该内容吗？', '提示', { type: 'warning' })
    await contentApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

fetchList()
</script>
