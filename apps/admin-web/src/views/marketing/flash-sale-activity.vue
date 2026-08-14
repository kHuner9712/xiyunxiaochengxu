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

    <div class="table-card">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px">
        秒杀活动必须绑定一个真实可售 SKU；活动库存是额外秒杀上限，最终成交仍受 SKU 实际库存约束。商品/SKU ID 全程按字符串处理，避免大整数精度丢失。
      </el-alert>
      <el-table v-loading="loading" :data="tableData" border>
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="name" label="活动名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productId" label="商品ID" width="110" show-overflow-tooltip />
        <el-table-column prop="skuId" label="SKU ID" width="110" show-overflow-tooltip />
        <el-table-column label="秒杀价" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.flashPrice) }}</template>
        </el-table-column>
        <el-table-column label="库存/已售/锁定" width="130">
          <template #default="{ row }">{{ row.stockLimit }} / {{ row.soldCount }} / {{ row.lockedCount }}</template>
        </el-table-column>
        <el-table-column prop="limitPerUser" label="限购" width="70" />
        <el-table-column prop="lockMinutes" label="锁库存(分)" width="100" />
        <el-table-column label="活动时间" width="320">
          <template #default="{ row }">{{ formatActivityDate(row.startTime) }} ~ {{ formatActivityDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :disabled="statusBusyIds.has(String(row.id))"
              @change="(val: any) => handleStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              size="small"
              type="danger"
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id))"
              @click="handleDelete(row)"
            >删除</el-button>
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
    </div>

    <el-dialog v-model="dialogVisible" :title="editing.id ? '编辑秒杀活动' : '新增秒杀活动'" width="700px">
      <el-form :model="editing" label-width="120px">
        <el-form-item label="活动名称" required>
          <el-input v-model="editing.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="商品ID" required>
          <div class="inline-field">
            <el-input
              v-model="editing.productId"
              placeholder="输入商品ID后加载SKU"
              @change="handleProductChanged"
            />
            <el-button :loading="productLoading" @click="loadProductSkus(true)">加载SKU</el-button>
          </div>
        </el-form-item>
        <el-form-item label="SKU" required>
          <el-select
            v-model="editing.skuId"
            filterable
            placeholder="请先加载商品并选择SKU"
            style="width: 100%"
            :disabled="availableSkus.length === 0"
          >
            <el-option
              v-for="sku in availableSkus"
              :key="sku.id"
              :value="sku.id"
              :label="`${sku.name}｜ID ${sku.id}｜¥${formatPrice(sku.price)}｜库存 ${sku.stock}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="秒杀价(元)" required>
          <el-input-number v-model="editing.flashPrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="原价(元)">
          <el-input-number v-model="editing.originalPrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="秒杀库存" required>
          <el-input-number v-model="editing.stockLimit" :min="1" />
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
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { flashSaleApi } from '@/api/flash-sale'
import { productApi } from '@/api/product'
import { formatPrice } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const POSITIVE_ID = /^[1-9]\d*$/
const loading = ref(false)
const productLoading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const availableSkus = ref<Array<{ id: string; name: string; price: number; stock: number }>>([])
const total = ref(0)
const dialogVisible = ref(false)
const statusBusyIds = reactive(new Set<string>())
const deleteBusyIds = reactive(new Set<string>())
let skuLoadSeq = 0
let editLoadSeq = 0

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

function resetEditing() {
  skuLoadSeq += 1
  productLoading.value = false
  availableSkus.value = []
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
}

async function loadProductSkus(showMessage = false): Promise<boolean> {
  const requestSeq = ++skuLoadSeq
  const productId = String(editing.productId || '').trim()
  if (!POSITIVE_ID.test(productId)) {
    availableSkus.value = []
    editing.skuId = ''
    if (showMessage) ElMessage.warning('请输入有效的商品ID')
    return false
  }

  productLoading.value = true
  try {
    const res: any = await productApi.getDetail(productId)
    if (requestSeq !== skuLoadSeq || String(editing.productId || '').trim() !== productId) {
      return false
    }
    const product = res.data || {}
    const skus = asArray(product.skus)
      .filter((sku: any) => sku?.id != null && (sku.status === 1 || sku.status === undefined))
      .map((sku: any) => ({
        id: String(sku.id),
        name: Object.values(sku.specs || {}).join('/') || sku.skuCode || `SKU ${sku.id}`,
        price: Number(sku.price || 0),
        stock: Number(sku.stock || 0),
      }))

    availableSkus.value = skus
    if (skus.length === 0) {
      editing.skuId = ''
      if (showMessage) ElMessage.warning('该商品没有可售SKU，无法创建秒杀活动')
      return false
    }
    if (!skus.some((sku) => sku.id === String(editing.skuId || ''))) {
      editing.skuId = skus.length === 1 ? skus[0].id : ''
    }
    if (showMessage) ElMessage.success(`已加载 ${skus.length} 个可售SKU`)
    return true
  } catch {
    if (requestSeq === skuLoadSeq) {
      availableSkus.value = []
      editing.skuId = ''
    }
    return false
  } finally {
    if (requestSeq === skuLoadSeq) productLoading.value = false
  }
}

function handleProductChanged() {
  skuLoadSeq += 1
  productLoading.value = false
  editing.productId = String(editing.productId || '').trim()
  editing.skuId = ''
  availableSkus.value = []
}

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
  editLoadSeq += 1
  resetEditing()
  dialogVisible.value = true
}

async function openEdit(row: any) {
  const requestSeq = ++editLoadSeq
  resetEditing()
  Object.assign(editing, {
    id: row.id,
    name: row.name,
    productId: row.productId != null ? String(row.productId) : '',
    skuId: row.skuId != null ? String(row.skuId) : '',
    flashPrice: Number(row.flashPrice || 0) / 100,
    originalPrice: row.originalPrice != null ? Number(row.originalPrice) / 100 : null,
    stockLimit: row.stockLimit,
    limitPerUser: row.limitPerUser,
    lockMinutes: row.lockMinutes,
    startTime: toLocalPickerDateTime(row.startTime),
    endTime: toLocalPickerDateTime(row.endTime),
    status: row.status,
    sortOrder: row.sortOrder,
    coverImage: row.coverImage || '',
    description: row.description || '',
  })
  const loaded = await loadProductSkus(false)
  if (requestSeq !== editLoadSeq || !loaded) return
  dialogVisible.value = true
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function toLocalPickerDateTime(value: unknown): string {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`
}

function parsePickerDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value.trim().replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDateTime(value: unknown): string | null {
  return parsePickerDateTime(value)?.toISOString() ?? null
}

function formatActivityDate(value: unknown): string {
  return toLocalPickerDateTime(value) || '-'
}

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (!editing.name?.trim()) { ElMessage.warning('请填写活动名称'); return }
    const productId = String(editing.productId || '').trim()
    if (!POSITIVE_ID.test(productId)) { ElMessage.warning('请输入有效的商品ID'); return }

    const loaded = await loadProductSkus(false)
    if (!loaded || productId !== String(editing.productId || '').trim()) {
      ElMessage.warning('商品或SKU不可用，请重新加载')
      return
    }
    const skuId = String(editing.skuId || '').trim()
    const selectedSku = availableSkus.value.find((sku) => sku.id === skuId)
    if (!POSITIVE_ID.test(skuId) || !selectedSku) {
      ElMessage.warning('请选择该商品的有效SKU')
      return
    }

    const startDate = parsePickerDateTime(editing.startTime)
    const endDate = parsePickerDateTime(editing.endTime)
    if (!startDate || !endDate) { ElMessage.warning('请选择有效的活动时间'); return }
    if (startDate.getTime() >= endDate.getTime()) {
      ElMessage.warning('活动结束时间必须晚于开始时间')
      return
    }

    const flashPriceFen = Math.round(Number(editing.flashPrice) * 100)
    if (!Number.isSafeInteger(flashPriceFen) || flashPriceFen < 0) {
      ElMessage.warning('秒杀价格无效')
      return
    }
    if (flashPriceFen > selectedSku.price) {
      ElMessage.warning(`秒杀价不能高于当前SKU售价 ¥${formatPrice(selectedSku.price)}`)
      return
    }
    const stockLimit = Number(editing.stockLimit)
    if (!Number.isInteger(stockLimit) || stockLimit < 1) {
      ElMessage.warning('秒杀库存必须至少为1')
      return
    }

    const { id: _id, ...rest } = editing
    const payload: any = {
      ...rest,
      productId,
      skuId,
      flashPrice: flashPriceFen,
      originalPrice: editing.originalPrice != null
        ? Math.round(Number(editing.originalPrice) * 100)
        : undefined,
      stockLimit,
      limitPerUser: Number(editing.limitPerUser),
      lockMinutes: Number(editing.lockMinutes),
      sortOrder: Number(editing.sortOrder),
      startTime: toIsoDateTime(editing.startTime),
      endTime: toIsoDateTime(editing.endTime),
    }
    if (payload.originalPrice === undefined) delete payload.originalPrice

    if (editing.id) {
      await flashSaleApi.updateActivity(String(editing.id), payload)
    } else {
      await flashSaleApi.createActivity(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadList()
  } catch {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

async function handleStatusChange(row: any, val: string | number | boolean) {
  const id = String(row.id)
  const previousStatus = Number(row.status)
  const numVal = val ? 1 : 0
  if (statusBusyIds.has(id)) return
  statusBusyIds.add(id)
  try {
    await flashSaleApi.updateActivityStatus(id, numVal)
    row.status = numVal
    ElMessage.success(numVal === 1 ? '已上架' : '已下架')
  } catch {
    row.status = previousStatus
  } finally {
    statusBusyIds.delete(id)
  }
}

async function handleDelete(row: any) {
  const id = String(row.id)
  if (deleteBusyIds.has(id)) return
  deleteBusyIds.add(id)
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」吗？`, '提示', { type: 'warning' })
    await flashSaleApi.deleteActivity(id)
    ElMessage.success('删除成功')
    await loadList()
  } catch {
    // 取消或错误
  } finally {
    deleteBusyIds.delete(id)
  }
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
  flex-wrap: wrap;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}
.table-card {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}
.inline-field {
  display: flex;
  gap: 8px;
  width: 100%;
}
.inline-field .el-input { flex: 1; }
</style>