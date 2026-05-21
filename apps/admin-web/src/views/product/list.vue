<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="商品名称">
          <el-input v-model="searchForm.name" placeholder="请输入商品名称" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-tree-select
            v-model="searchForm.categoryId"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' }"
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
          <el-button v-permission="'product:edit'" type="primary" @click="handleAdd">新增商品</el-button>
          <el-button v-permission="'product:edit'" type="danger" :disabled="!selectedIds.length" @click="handleBatchOff">批量下架</el-button>
        </div>
      </div>

      <el-table :data="tableData" stripe v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
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
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="80" prop="sort" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'product:edit'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-permission="'product:edit'"
              :type="row.status === 1 ? 'warning' : 'success'"
              link
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button v-permission="'product:edit'" type="danger" link @click="handleDelete(row)">删除</el-button>
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

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const selectedIds = ref<number[]>([])
const categoryTree = ref<any[]>([])
const brandList = ref<any[]>([])

const searchForm = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  brandId: undefined as number | undefined,
  status: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

async function fetchList() {
  loading.value = true
  try {
    const res = await productApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...searchForm,
    })
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

async function fetchCategoryTree() {
  try {
    const res = await categoryApi.getTree()
    categoryTree.value = res.data || []
  } catch {}
}

async function fetchBrandList() {
  try {
    const res = await brandApi.getAll()
    brandList.value = res.data || []
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.categoryId = undefined
  searchForm.brandId = undefined
  searchForm.status = undefined
  handleSearch()
}

function handleSelectionChange(rows: any[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function handleAdd() {
  router.push('/product/edit')
}

function handleEdit(row: any) {
  router.push(`/product/edit/${row.id}`)
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 1 ? 0 : 1
  try {
    await productApi.updateStatus(row.id, newStatus)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该商品吗？', '提示', { type: 'warning' })
    await productApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

async function handleBatchOff() {
  try {
    await ElMessageBox.confirm(`确定下架选中的 ${selectedIds.value.length} 个商品吗？`, '提示', { type: 'warning' })
    await productApi.batchUpdateStatus(selectedIds.value, 0)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

onMounted(() => {
  fetchList()
  fetchCategoryTree()
  fetchBrandList()
})
</script>
