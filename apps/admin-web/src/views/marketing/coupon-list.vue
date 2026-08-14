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
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="name" label="优惠券名称" min-width="150" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ formatCouponType(row.type) }}</template>
        </el-table-column>
        <el-table-column label="面额/折扣" width="120">
          <template #default="{ row }">
            <span v-if="row.type === 2">{{ (Number(row.value || 0) / 10).toFixed(1) }}折</span>
            <span v-else>¥{{ formatPrice(row.value || 0) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用门槛" width="120">
          <template #default="{ row }">{{ row.minAmount ? '满¥' + formatPrice(row.minAmount) : '无门槛' }}</template>
        </el-table-column>
        <el-table-column prop="totalCount" label="发行量" width="80">
          <template #default="{ row }">{{ row.totalCount === 0 ? '不限' : row.totalCount }}</template>
        </el-table-column>
        <el-table-column prop="receivedCount" label="已领取" width="80" />
        <el-table-column prop="usedCount" label="已使用" width="80" />
        <el-table-column label="有效期" min-width="250">
          <template #default="{ row }">{{ formatDate(row.startTime) }} ~ {{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:coupon'" type="primary" link :disabled="isActionBusy(row)" @click="router.push(`/marketing/coupon-edit/${row.id}`)">编辑</el-button>
            <el-button v-permission="'marketing:coupon'" :type="row.status === 1 ? 'warning' : 'success'" link :loading="isActionBusy(row)" :disabled="isActionBusy(row)" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button v-permission="'marketing:coupon'" type="danger" link :loading="isActionBusy(row)" :disabled="isActionBusy(row)" @click="handleDelete(row)">删除</el-button>
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
const actionBusyIds = reactive(new Set<string>())
let listRequestSeq = 0

const searchForm = reactive({
  name: '',
  type: undefined as number | undefined,
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

function couponKey(row: any) { return String(row?.id || '') }
function isActionBusy(row: any) { return actionBusyIds.has(couponKey(row)) }

async function fetchList() {
  const requestSeq = ++listRequestSeq
  loading.value = true
  try {
    const res = await couponApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    if (requestSeq !== listRequestSeq) return
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    if (requestSeq === listRequestSeq) ElMessage.error(e?.message || '获取优惠券列表失败')
  } finally {
    if (requestSeq === listRequestSeq) loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  void fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.type = undefined
  searchForm.status = undefined
  handleSearch()
}

async function handleToggleStatus(row: any) {
  const id = couponKey(row)
  if (!id || actionBusyIds.has(id)) return
  actionBusyIds.add(id)
  const nextStatus = row.status === 1 ? 0 : 1
  const actionText = nextStatus === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定${actionText}该优惠券吗？`, '提示', { type: 'warning' })
    await couponApi.update(id, { status: nextStatus })
    ElMessage.success('操作成功')
    await fetchList()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '操作失败')
  } finally {
    actionBusyIds.delete(id)
  }
}

async function handleDelete(row: any) {
  const id = couponKey(row)
  if (!id || actionBusyIds.has(id)) return
  actionBusyIds.add(id)
  try {
    await ElMessageBox.confirm(
      Number(row.receivedCount || 0) > 0
        ? '该优惠券已有用户领取。删除将停止继续发放，但会保留用户已领取权益，是否继续？'
        : '确定删除该优惠券吗？',
      '提示',
      { type: 'warning' },
    )
    await couponApi.delete(id)
    ElMessage.success(Number(row.receivedCount || 0) > 0 ? '已停止发放并保留已领取权益' : '删除成功')
    await fetchList()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '删除失败')
  } finally {
    actionBusyIds.delete(id)
  }
}

void fetchList()
</script>
