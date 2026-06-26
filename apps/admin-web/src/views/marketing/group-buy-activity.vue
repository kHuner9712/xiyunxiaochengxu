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
          拼团活动绑定商品后，用户在小程序发起或参与拼团，支付成功后计入成团人数；达到目标人数自动成团。活动库存独立于商品 SKU 库存。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="活动名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productId" label="商品ID" width="90" />
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
        <el-table-column label="活动时间" width="280">
          <template #default="{ row }">
            <div>{{ formatDateShort(row.startTime) }} 至</div>
            <div>{{ formatDateShort(row.endTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
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
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
          <el-input v-model="editing.productId" placeholder="绑定的商品ID" />
        </el-form-item>
        <el-form-item label="SKU ID">
          <el-input v-model="editing.skuId" placeholder="可选，留空则需用户选择规格" />
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
          <span style="margin-left: 8px; color: #909399">留空表示不限</span>
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { groupBuyApi } from '@/api/group-buy'
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
  resetEditing()
  dialogVisible.value = true
}

async function handleEdit(row: any) {
  resetEditing()
  const res: any = await groupBuyApi.getActivityDetail(row.id)
  const d = res.data || {}
  Object.assign(editing, {
    id: d.id,
    name: d.name || '',
    productId: d.productId ?? '',
    skuId: d.skuId ?? '',
    groupPrice: d.groupPrice ?? 0,
    originalPrice: d.originalPrice,
    groupSize: d.groupSize ?? 2,
    groupExpireHours: d.groupExpireHours ?? 24,
    stockLimit: d.stockLimit,
    limitPerUser: d.limitPerUser ?? 0,
    startTime: d.startTime ? formatDate(d.startTime) : '',
    endTime: d.endTime ? formatDate(d.endTime) : '',
    status: d.status ?? 1,
    sortOrder: d.sortOrder ?? 0,
    coverImage: d.coverImage || '',
    description: d.description || '',
  })
  dialogVisible.value = true
}

function formatDate(d: string): string {
  if (!d) return ''
  return d.replace('T', ' ').slice(0, 19)
}

async function handleSubmit() {
  if (!editing.name) {
    ElMessage.warning('请填写活动名称')
    return
  }
  if (!editing.productId) {
    ElMessage.warning('请填写商品ID')
    return
  }
  if (!editing.startTime || !editing.endTime) {
    ElMessage.warning('请选择活动时间')
    return
  }
  const payload: any = { ...editing }
  if (!payload.skuId) delete payload.skuId
  if (payload.originalPrice === null || payload.originalPrice === '') delete payload.originalPrice
  if (payload.stockLimit === null || payload.stockLimit === '') delete payload.stockLimit
  try {
    if (editing.id) {
      await groupBuyApi.updateActivity(editing.id, payload)
    } else {
      await groupBuyApi.createActivity(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch (e) {
    // 错误已由拦截器处理
  }
}

async function handleStatusChange(row: any, val: string | number | boolean) {
  const numVal = Number(val)
  try {
    await groupBuyApi.updateActivityStatus(row.id, numVal)
    ElMessage.success(numVal === 1 ? '已上架' : '已下架')
  } catch (e) {
    row.status = numVal === 1 ? 0 : 1
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」吗？`, '提示', { type: 'warning' })
    await groupBuyApi.deleteActivity(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch (e) {
    // 取消或错误
  }
}

onMounted(() => loadList())
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
</style>
