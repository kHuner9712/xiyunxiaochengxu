<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="优惠券名称">
          <el-input v-model="searchForm.name" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable>
            <el-option label="满减券" :value="1" />
            <el-option label="折扣券" :value="2" />
            <el-option label="无门槛券" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
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
        <el-button v-permission="'marketing:coupon'" type="primary" @click="router.push('/marketing/coupon-edit')">新增优惠券</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="优惠券名称" min-width="150" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ formatCouponType(row.type) }}</template>
        </el-table-column>
        <el-table-column label="面额/折扣" width="120">
          <template #default="{ row }">
            <span v-if="row.type === 2">{{ (row.discount * 100).toFixed(0) }}折</span>
            <span v-else>¥{{ formatPrice(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用门槛" width="120">
          <template #default="{ row }">{{ row.minAmount ? '满¥' + formatPrice(row.minAmount) : '无门槛' }}</template>
        </el-table-column>
        <el-table-column prop="totalCount" label="发行量" width="80" />
        <el-table-column prop="usedCount" label="已使用" width="80" />
        <el-table-column label="有效期" min-width="200">
          <template #default="{ row }">{{ formatDate(row.startTime) }} ~ {{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:coupon'" type="primary" link @click="router.push(`/marketing/coupon-edit/${row.id}`)">编辑</el-button>
            <el-button v-permission="'marketing:coupon'" :type="row.status === 1 ? 'warning' : 'success'" link @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button v-permission="'marketing:coupon'" type="danger" link @click="handleDelete(row)">删除</el-button>
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
import { couponApi } from '@/api/coupon'
import { formatPrice, formatDate, formatCouponType } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])

const searchForm = reactive({
  name: '',
  type: undefined as number | undefined,
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const res = await couponApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取优惠券列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.type = undefined
  searchForm.status = undefined
  handleSearch()
}

async function handleToggleStatus(row: any) {
  const actionText = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${actionText}该优惠券吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }

  try {
    await couponApi.update({ id: row.id, status: row.status === 1 ? 0 : 1 })
    ElMessage.success('操作成功')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该优惠券吗？', '提示', { type: 'warning' })
    await couponApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

fetchList()
</script>
