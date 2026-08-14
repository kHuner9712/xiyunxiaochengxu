<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="活动名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
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
      <div style="margin-bottom: 16px">
        <el-button type="primary" @click="handleAdd">新增活动</el-button>
        <el-alert type="info" :closable="false" style="margin-top: 8px">
          拼团活动必须绑定一个真实可售 SKU。活动库存是额外活动上限，最终成交仍同时受 SKU 实际库存约束；支付成功后计入成团人数，达到目标人数才进入履约。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="name" label="活动名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productId" label="商品ID" width="110" show-overflow-tooltip />
        <el-table-column prop="skuId" label="SKU ID" width="110" show-overflow-tooltip />
        <el-table-column label="拼团价" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.groupPrice) }}</template>
        </el-table-column>
        <el-table-column label="成团人数" width="90">
          <template #default="{ row }">{{ row.groupSize }}人</template>
        </el-table-column>
        <el-table-column label="时限" width="80">
          <template #default="{ row }">{{ row.groupExpireHours }}h</template>
        </el-table-column>
        <el-table-column label="库存/已售" width="110">
          <template #default="{ row }">
            {{ row.stockLimit != null ? `${row.soldCount}/${row.stockLimit}` : `${row.soldCount}/∞` }}
          </template>
        </el-table-column>
        <el-table-column label="活动时间" width="320">
          <template #default="{ row }">
            <div>{{ formatActivityDate(row.startTime) }} 至</div>
            <div>{{ formatActivityDate(row.endTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              :disabled="statusBusyIds.has(String(row.id))"
              active-text="上架"
              inactive-text="下架"
              inline-prompt
              @change="(val) => handleStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              link
              type="danger"
              size="small"
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id))"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="searchForm.page"
          v-model:page-size="searchForm.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editing.id ? '编辑活动' : '新增活动'" width="780px">
      <el-form ref="formRef" :model="editing" label-width="120px">
        <el-form-item label="活动名称" required>
          <el-input v-model="editing.name" placeholder="如：3人拼团特惠" />
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
        <el-form-item label="拼团价(分)" required>
          <el-input-number v-model="editing.groupPrice" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">¥{{ formatPrice(editing.groupPrice || 0) }}</span>
        </el-form-item>
        <el-form-item label="原价(分)">
          <el-input-number v-model="editing.originalPrice" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">展示用，可空</span>
        </el-form-item>
        <el-form-item label="成团人数" required>
          <el-input-number v-model="editing.groupSize" :min="2" :max="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="成团时限(小时)">
          <el-input-number v-model="editing.groupExpireHours" :min="1" :max="168" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">开团后 N 小时内成团</span>
        </el-form-item>
        <el-form-item label="活动库存">
          <el-input-number v-model="editing.stockLimit" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">留空表示不限，但仍受SKU实际库存约束</span>
        </el-form-item>
        <el-form-item label="每人限购">
          <el-input-number v-model="editing.limitPerUser" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">0 表示不限</span>
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker v-model="editing.startTime" type="datetime" placeholder="开始时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="结束时间" required>
          <el-date-picker v-model="editing.endTime" type="datetime" placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editing.sortOrder" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">数字越小越靠前</span>
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="editing.coverImage" placeholder="封面图 URL" />
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
import { groupBuyApi } from '@/api/group-buy'
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
  groupPrice: 0,
  originalPrice: null,
  groupSize: 2,
  groupExpireHours: 24,
  stockLimit: null,
  limitPerUser: 0,
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
    groupPrice: 0,
    originalPrice: null,
    groupSize: 2,
    groupExpireHours: 24,
    stockLimit: null,
    limitPerUser: 0,
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
      if (showMessage) ElMessage.warning('该商品没有可售SKU，无法创建拼团活动')
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
    const res: any = await groupBuyApi.getActivities({
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

function handleSearch() {
  searchForm.page = 1
  loadList()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.page = 1
  loadList()
}

function handleAdd() {
  editLoadSeq += 1
  resetEditing()
  dialogVisible.value = true
}

async function handleEdit(row: any) {
  const requestSeq = ++editLoadSeq
  resetEditing()
  const res: any = await groupBuyApi.getActivityDetail(row.id)
  if (requestSeq !== editLoadSeq) return
  const d = res.data || {}
  Object.assign(editing, {
    id: d.id,
    name: d.name || '',
    productId: d.productId != null ? String(d.productId) : '',
    skuId: d.skuId != null ? String(d.skuId) : '',
    groupPrice: d.groupPrice ?? 0,
    originalPrice: d.originalPrice,
    groupSize: d.groupSize ?? 2,
    groupExpireHours: d.groupExpireHours ?? 24,
    stockLimit: d.stockLimit,
    limitPerUser: d.limitPerUser ?? 0,
    startTime: toLocalPickerDateTime(d.startTime),
    endTime: toLocalPickerDateTime(d.endTime),
    status: d.status ?? 1,
    sortOrder: d.sortOrder ?? 0,
    coverImage: d.coverImage || '',
    description: d.description || '',
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
    if (!editing.name?.trim()) {
      ElMessage.warning('请填写活动名称')
      return
    }
    const productId = String(editing.productId || '').trim()
    if (!POSITIVE_ID.test(productId)) {
      ElMessage.warning('请输入有效的商品ID')
      return
    }
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
    if (!startDate || !endDate) {
      ElMessage.warning('请选择有效的活动时间')
      return
    }
    if (startDate.getTime() >= endDate.getTime()) {
      ElMessage.warning('活动结束时间必须晚于开始时间')
      return
    }
    if (Number(editing.groupPrice) > selectedSku.price) {
      ElMessage.warning(`拼团价不能高于当前SKU售价 ¥${formatPrice(selectedSku.price)}`)
      return
    }

    const { id: _id, ...rest } = editing
    const payload: any = {
      ...rest,
      productId,
      skuId,
      startTime: toIsoDateTime(editing.startTime),
      endTime: toIsoDateTime(editing.endTime),
    }
    if (payload.originalPrice === null || payload.originalPrice === '') delete payload.originalPrice
    if (payload.stockLimit === null || payload.stockLimit === '') delete payload.stockLimit

    if (editing.id) {
      await groupBuyApi.updateActivity(String(editing.id), payload)
    } else {
      await groupBuyApi.createActivity(payload)
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
  const numVal = Number(val)
  if (statusBusyIds.has(id)) {
    row.status = numVal === 1 ? 0 : 1
    return
  }
  statusBusyIds.add(id)
  try {
    await groupBuyApi.updateActivityStatus(id, numVal)
    ElMessage.success(numVal === 1 ? '已上架' : '已下架')
  } catch {
    row.status = numVal === 1 ? 0 : 1
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
    await groupBuyApi.deleteActivity(id)
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
.page-container { padding: 16px; }
.search-bar { margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
.inline-field { display: flex; gap: 8px; width: 100%; }
.inline-field .el-input { flex: 1; }
</style>