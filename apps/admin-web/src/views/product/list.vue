<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="商品名称">
          <el-input v-model="searchForm.keyword" placeholder="请输入商品名称" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-tree-select
            v-model="searchForm.categoryId"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' } as any"
            placeholder="请选择分类"
            clearable
            check-strictly
          />
        </el-form-item>
        <el-form-item label="品牌">
          <el-select v-model="searchForm.brandId" placeholder="请选择品牌" clearable>
            <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="0" />
            <el-option label="草稿/待完善" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between">
        <div>
          <el-button v-permission="'product:create'" type="primary" @click="handleAdd">新增商品</el-button>
        </div>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="商品图片" width="100">
          <template #default="{ row }">
            <el-image v-if="row.mainImage" :src="row.mainImage" style="width: 60px; height: 60px" fit="cover" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" show-overflow-tooltip min-width="200" />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column prop="brandName" label="品牌" width="100" />
        <el-table-column label="价格" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">{{ row.stock ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="80" prop="sortOrder" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'product:edit'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-permission="'product:publish'"
              :type="row.status === 1 ? 'warning' : 'success'"
              link
              :loading="isOperationBusy(row.id, 'status')"
              :disabled="isAnyOperationBusy(row.id)"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button
              v-permission="'product:delete'"
              type="danger"
              link
              :loading="isOperationBusy(row.id, 'delete')"
              :disabled="isAnyOperationBusy(row.id)"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi } from '@/api/product'
import { categoryApi } from '@/api/category'
import { brandApi } from '@/api/brand'
import { formatPrice } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const categoryTree = ref<any[]>([])
const brandList = ref<any[]>([])
const operationBusy = ref<Record<string, 'status' | 'delete'>>({})
let listRequestVersion = 0

const searchForm = reactive({
  keyword: '',
  categoryId: undefined as string | undefined,
  brandId: undefined as string | undefined,
  status: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

function normalizeCategoryIds(rows: any[]): any[] {
  return rows.map((row) => ({
    ...row,
    id: String(row.id),
    children: Array.isArray(row.children) ? normalizeCategoryIds(row.children) : row.children,
  }))
}

function operationKey(id: unknown) {
  return String(id || '')
}

function isOperationBusy(id: unknown, type: 'status' | 'delete') {
  return operationBusy.value[operationKey(id)] === type
}

function isAnyOperationBusy(id: unknown) {
  return !!operationBusy.value[operationKey(id)]
}

function beginOperation(id: unknown, type: 'status' | 'delete') {
  const key = operationKey(id)
  if (!key || operationBusy.value[key]) return false
  operationBusy.value = { ...operationBusy.value, [key]: type }
  return true
}

function endOperation(id: unknown) {
  const key = operationKey(id)
  if (!operationBusy.value[key]) return
  const next = { ...operationBusy.value }
  delete next[key]
  operationBusy.value = next
}

async function fetchList() {
  const requestVersion = ++listRequestVersion
  const params = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...searchForm,
  }
  loading.value = true
  try {
    const res = await productApi.getList(params)
    if (requestVersion !== listRequestVersion) return
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch {
    if (requestVersion !== listRequestVersion) return
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false
  }
}

async function fetchCategoryTree() {
  try {
    const res = await categoryApi.getTree()
    categoryTree.value = normalizeCategoryIds(asArray(res.data))
  } catch {}
}

async function fetchBrandList() {
  try {
    const res = await brandApi.getList({ page: 1, pageSize: 100 })
    brandList.value = asArray(res.data).map((item: any) => ({ ...item, id: String(item.id) }))
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  void fetchList()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.categoryId = undefined
  searchForm.brandId = undefined
  searchForm.status = undefined
  handleSearch()
}

function handleAdd() {
  router.push('/product/edit')
}

function handleEdit(row: any) {
  router.push(`/product/edit/${String(row.id)}`)
}

function getStatusText(status: number) {
  if (status === 1) return '上架'
  if (status === 0) return '下架'
  if (status === 3) return '草稿/待完善'
  return `状态${status}`
}

function getStatusTagType(status: number) {
  if (status === 1) return 'success'
  if (status === 3) return 'warning'
  return 'info'
}

async function handleToggleStatus(row: any) {
  const productId = String(row?.id || '')
  if (!beginOperation(productId, 'status')) return
  const newStatus = row.status === 1 ? 0 : 1
  try {
    await productApi.updateStatus(productId, newStatus)
    ElMessage.success('操作成功')
    await fetchList()
  } catch {} finally {
    endOperation(productId)
  }
}

async function handleDelete(row: any) {
  const productId = String(row?.id || '')
  if (!beginOperation(productId, 'delete')) return
  try {
    await ElMessageBox.confirm('确定删除该商品吗？', '提示', { type: 'warning' })
    await productApi.delete(productId)
    ElMessage.success('删除成功')
    await fetchList()
  } catch {
    // 用户关闭确认框或请求失败时统一在 finally 释放操作锁。
  } finally {
    endOperation(productId)
  }
}

onMounted(() => {
  void fetchList()
  void fetchCategoryTree()
  void fetchBrandList()
})
</script>