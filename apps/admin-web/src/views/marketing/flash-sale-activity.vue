<template>
  <div class="flash-sale-activity-page">
    <div class="search-bar">
      <el-input v-model="searchForm.keyword" placeholder="活动名称" clearable style="width: 200px" />
      <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 120px">
        <el-option label="上架" :value="1" />
        <el-option label="下架" :value="0" />
      </el-select>
      <el-button type="primary" @click="loadList">查询</el-button>
      <el-button type="success" @click="openCreate">新增活动</el-button>
    </div>

    <el-table v-loading="loading" :data="tableData" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="活动名称" min-width="140" />
      <el-table-column prop="productId" label="商品ID" width="90" />
      <el-table-column prop="skuId" label="SKU ID" width="90" />
      <el-table-column label="秒杀价" width="100">
        <template #default="{ row }">¥{{ formatPrice(row.flashPrice) }}</template>
      </el-table-column>
      <el-table-column label="库存/已售/锁定" width="130">
        <template #default="{ row }">{{ row.stockLimit }} / {{ row.soldCount }} / {{ row.lockedCount }}</template>
      </el-table-column>
      <el-table-column prop="limitPerUser" label="限购" width="70" />
      <el-table-column prop="lockMinutes" label="锁库存(分)" width="100" />
      <el-table-column label="活动时间" width="320">
        <template #default="{ row }">{{ formatDateShort(row.startTime) }} ~ {{ formatDateShort(row.endTime) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-switch :model-value="row.status === 1" @change="(val: any) => handleStatusChange(row, val)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="searchForm.page"
      v-model:page-size="searchForm.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="loadList"
      style="margin-top: 16px"
    />

    <el-dialog v-model="dialogVisible" :title="editing.id ? '编辑秒杀活动' : '新增秒杀活动'" width="640px">
      <el-form :model="editing" label-width="120px">
        <el-form-item label="活动名称" required>
          <el-input v-model="editing.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="商品ID" required>
          <el-input v-model="editing.productId" placeholder="请输入商品ID" />
        </el-form-item>
        <el-form-item label="SKU ID">
          <el-input v-model="editing.skuId" placeholder="可选，留空则需用户选择规格" />
        </el-form-item>
        <el-form-item label="秒杀价(元)" required>
          <el-input-number v-model="editing.flashPrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="原价(元)">
          <el-input-number v-model="editing.originalPrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="秒杀库存" required>
          <el-input-number v-model="editing.stockLimit" :min="0" />
        </el-form-item>
        <el-form-item label="每人限购">
          <el-input-number v-model="editing.limitPerUser" :min="0" />
          <span style="margin-left: 8px; color: #999">0 表示不限</span>
        </el-form-item>
        <el-form-item label="锁库存分钟数">
          <el-input-number v-model="editing.lockMinutes" :min="1" />
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker v-model="editing.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="结束时间" required>
          <el-date-picker v-model="editing.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editing.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="editing.coverImage" placeholder="封面图URL" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editing.status">
            <el-radio :value="1">上架</el-radio>
            <el-radio :value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="活动说明">
          <el-input v-model="editing.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { flashSaleApi } from '@/api/flash-sale'
import { formatPrice, formatDateShort } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: undefined as number | undefined,
})

const editing = reactive<any>({
  id: null,
  name: '',
  productId: '',
  skuId: '',
  flashPrice: 0,
  originalPrice: null,
  stockLimit: 100,
  limitPerUser: 1,
  lockMinutes: 15,
  startTime: '',
  endTime: '',
  status: 1,
  sortOrder: 0,
  coverImage: '',
  description: '',
})

async function loadList() {
  loading.value = true
  try {
    const res: any = await flashSaleApi.getActivities({
      page: searchForm.page,
      pageSize: searchForm.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status,
    })
    tableData.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(editing, {
    id: null,
    name: '',
    productId: '',
    skuId: '',
    flashPrice: 0,
    originalPrice: null,
    stockLimit: 100,
    limitPerUser: 1,
    lockMinutes: 15,
    startTime: '',
    endTime: '',
    status: 1,
    sortOrder: 0,
    coverImage: '',
    description: '',
  })
  dialogVisible.value = true
}

function openEdit(row: any) {
  Object.assign(editing, {
    id: row.id,
    name: row.name,
    productId: row.productId,
    skuId: row.skuId || '',
    flashPrice: row.flashPrice / 100,
    originalPrice: row.originalPrice ? row.originalPrice / 100 : null,
    stockLimit: row.stockLimit,
    limitPerUser: row.limitPerUser,
    lockMinutes: row.lockMinutes,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    sortOrder: row.sortOrder,
    coverImage: row.coverImage || '',
    description: row.description || '',
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!editing.name) { ElMessage.warning('请填写活动名称'); return }
  if (!editing.productId) { ElMessage.warning('请填写商品ID'); return }
  if (!editing.startTime || !editing.endTime) { ElMessage.warning('请选择活动时间'); return }
  const payload: any = {
    ...editing,
    productId: Number(editing.productId),
    flashPrice: Math.round(Number(editing.flashPrice) * 100),
    originalPrice: editing.originalPrice ? Math.round(Number(editing.originalPrice) * 100) : undefined,
    stockLimit: Number(editing.stockLimit),
    limitPerUser: Number(editing.limitPerUser),
    lockMinutes: Number(editing.lockMinutes),
    sortOrder: Number(editing.sortOrder),
  }
  if (!payload.skuId) delete payload.skuId
  if (payload.originalPrice === undefined) delete payload.originalPrice
  try {
    if (editing.id) {
      await flashSaleApi.updateActivity(editing.id, payload)
    } else {
      await flashSaleApi.createActivity(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch (e) {}
}

async function handleStatusChange(row: any, val: string | number | boolean) {
  const numVal = val ? 1 : 0
  try {
    await flashSaleApi.updateActivityStatus(row.id, numVal)
    ElMessage.success(numVal === 1 ? '已上架' : '已下架')
  } catch (e) {
    row.status = numVal === 1 ? 0 : 1
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」吗？`, '提示', { type: 'warning' })
    await flashSaleApi.deleteActivity(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch (e) {}
}

onMounted(() => loadList())
</script>

<style scoped>
.flash-sale-activity-page {
  padding: 16px;
}
.search-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
</style>
