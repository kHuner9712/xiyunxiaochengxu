<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="草稿" value="draft" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已付款" value="paid" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="商家ID">
          <el-input v-model="searchForm.merchantPromotionSourceId" placeholder="商家推广来源ID" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="门店ID">
          <el-input v-model="searchForm.pickupStoreId" placeholder="门店ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button type="primary" @click="openCreateDialog">创建结算批次</el-button>
        <el-alert type="info" :closable="false" style="margin-top: 8px">
          批次仅包含 status=pending/confirmed、occurredAt 在周期内、且未被其他未取消批次包含的记录。批次状态流转：草稿 → 已确认 → 已付款（已付款不可取消）。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="settlementNo" label="结算单号" width="180" />
        <el-table-column label="商家/门店" min-width="160">
          <template #default="{ row }">
            <div v-if="row.merchantName">{{ row.merchantName }}（{{ row.merchantCode }}）</div>
            <div v-if="row.storeName">门店：{{ row.storeName }}</div>
            <div v-if="!row.merchantName && !row.storeName">全部商家/门店</div>
          </template>
        </el-table-column>
        <el-table-column label="周期" width="240">
          <template #default="{ row }">
            <div>{{ formatDate(row.periodStart) }}</div>
            <div>至 {{ formatDate(row.periodEnd) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录数" width="90" />
        <el-table-column label="基数合计" width="110">
          <template #default="{ row }">¥{{ formatPrice(row.totalSourceAmount) }}</template>
        </el-table-column>
        <el-table-column label="应结合计" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c; font-weight: 600">¥{{ formatPrice(row.totalCommissionAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'draft'"
              link type="success" size="small"
              @click="confirmBatch(row)"
            >确认</el-button>
            <el-button
              v-if="row.status === 'confirmed'"
              link type="warning" size="small"
              @click="markPaid(row)"
            >标记已付款</el-button>
            <el-button
              v-if="row.status === 'draft' || row.status === 'confirmed'"
              link type="danger" size="small"
              @click="cancelBatch(row)"
            >取消</el-button>
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

    <!-- 创建批次对话框 -->
    <el-dialog v-model="createDialogVisible" title="创建结算批次" width="560px">
      <el-form :model="createForm" label-width="120px">
        <el-form-item label="商家推广来源ID">
          <el-input v-model="createForm.merchantPromotionSourceId" placeholder="留空表示全部商家" />
        </el-form-item>
        <el-form-item label="自提门店ID">
          <el-input v-model="createForm.pickupStoreId" placeholder="留空表示全部门店" />
        </el-form-item>
        <el-form-item label="周期开始" required>
          <el-date-picker v-model="createForm.periodStart" type="datetime" placeholder="周期开始" />
        </el-form-item>
        <el-form-item label="周期结束" required>
          <el-date-picker v-model="createForm.periodEnd" type="datetime" placeholder="周期结束" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item>
          <el-button @click="previewBatch">预览可结算记录</el-button>
        </el-form-item>
      </el-form>
      <el-card v-if="previewResult" shadow="never" style="margin-top: 12px">
        <div>记录数：{{ previewResult.recordCount }}</div>
        <div>基数合计：¥{{ formatPrice(previewResult.totalSourceAmount) }}</div>
        <div>应结合计：¥{{ formatPrice(previewResult.totalCommissionAmount) }}</div>
      </el-card>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :disabled="!previewResult || previewResult.recordCount === 0">生成批次</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="批次详情" size="60%">
      <div v-if="detailData" style="padding: 0 16px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="结算单号">{{ detailData.settlementNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusText(detailData.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商家">{{ detailData.merchantName || '全部' }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ detailData.storeName || '全部' }}</el-descriptions-item>
          <el-descriptions-item label="周期">{{ formatDate(detailData.periodStart) }} 至 {{ formatDate(detailData.periodEnd) }}</el-descriptions-item>
          <el-descriptions-item label="记录数">{{ detailData.recordCount }}</el-descriptions-item>
          <el-descriptions-item label="基数合计">¥{{ formatPrice(detailData.totalSourceAmount) }}</el-descriptions-item>
          <el-descriptions-item label="应结合计">¥{{ formatPrice(detailData.totalCommissionAmount) }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin-top: 16px">明细列表</h4>
        <el-table :data="detailData.items || []" stripe size="small">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="来源类型" width="100">
            <template #default="{ row }">
              {{ row.record?.sourceType === 'sales_referral' ? '销售分佣' : '服务结算' }}
            </template>
          </el-table-column>
          <el-table-column label="商家/门店" min-width="140">
            <template #default="{ row }">
              <div v-if="row.record?.merchantName">{{ row.record.merchantName }}</div>
              <div v-if="row.record?.storeName">{{ row.record.storeName }}</div>
            </template>
          </el-table-column>
          <el-table-column label="订单/核销码" min-width="140">
            <template #default="{ row }">
              <div v-if="row.record?.orderNo">{{ row.record.orderNo }}</div>
              <div v-if="row.record?.verifyCode">{{ row.record.verifyCode }}</div>
            </template>
          </el-table-column>
          <el-table-column label="基数" width="90">
            <template #default="{ row }">¥{{ formatPrice(row.record?.sourceAmount || 0) }}</template>
          </el-table-column>
          <el-table-column label="应结" width="100">
            <template #default="{ row }">¥{{ formatPrice(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="项状态" width="100" />
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { merchantSettlementApi } from '@/api/merchant-settlement'
import { formatPrice, formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const createDialogVisible = ref(false)
const detailVisible = ref(false)
const previewResult = ref<any>(null)
const detailData = ref<any>(null)

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  status: '',
  merchantPromotionSourceId: '',
  pickupStoreId: '',
})

const createForm = reactive<any>({
  merchantPromotionSourceId: '',
  pickupStoreId: '',
  periodStart: null,
  periodEnd: null,
  remark: '',
})

function statusText(s: string) {
  return { draft: '草稿', confirmed: '已确认', paid: '已付款', cancelled: '已取消' }[s] || s
}
function statusTagType(s: string): any {
  return { draft: 'info', confirmed: 'primary', paid: 'success', cancelled: 'warning' }[s] || ''
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await merchantSettlementApi.getBatches(searchForm)
    tableData.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } catch (e) {
    // 已处理
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  searchForm.page = 1
  loadList()
}

function resetSearch() {
  Object.assign(searchForm, {
    status: '',
    merchantPromotionSourceId: '',
    pickupStoreId: '',
    page: 1,
  })
  loadList()
}

function openCreateDialog() {
  Object.assign(createForm, {
    merchantPromotionSourceId: '',
    pickupStoreId: '',
    periodStart: null,
    periodEnd: null,
    remark: '',
  })
  previewResult.value = null
  createDialogVisible.value = true
}

async function previewBatch() {
  if (!createForm.periodStart || !createForm.periodEnd) {
    ElMessage.warning('请选择周期')
    return
  }
  try {
    const res: any = await merchantSettlementApi.previewBatch({
      ...createForm,
      periodStart: createForm.periodStart.toISOString(),
      periodEnd: createForm.periodEnd.toISOString(),
    })
    previewResult.value = res.data
    if (res.data.recordCount === 0) {
      ElMessage.info('所选范围内无可结算记录')
    }
  } catch (e) {
    // 已处理
  }
}

async function handleCreate() {
  try {
    await merchantSettlementApi.createBatch({
      ...createForm,
      periodStart: createForm.periodStart.toISOString(),
      periodEnd: createForm.periodEnd.toISOString(),
    })
    ElMessage.success('批次已创建')
    createDialogVisible.value = false
    loadList()
  } catch (e) {
    // 已处理
  }
}

async function viewDetail(row: any) {
  try {
    const res: any = await merchantSettlementApi.getBatchDetail(row.id)
    detailData.value = res.data
    detailVisible.value = true
  } catch (e) {
    // 已处理
  }
}

async function confirmBatch(row: any) {
  try {
    await ElMessageBox.confirm(`确认批次「${row.settlementNo}」吗？确认后关联记录将升格为已确认`, '提示', { type: 'warning' })
    await merchantSettlementApi.confirmBatch(row.id)
    ElMessage.success('已确认')
    loadList()
  } catch (e) {
    // 已处理
  }
}

async function markPaid(row: any) {
  try {
    await ElMessageBox.confirm(`确认批次「${row.settlementNo}」已付款吗？此操作不可撤销`, '提示', { type: 'warning' })
    await merchantSettlementApi.markBatchPaid(row.id)
    ElMessage.success('已标记付款')
    loadList()
  } catch (e) {
    // 已处理
  }
}

async function cancelBatch(row: any) {
  try {
    await ElMessageBox.confirm(`确认取消批次「${row.settlementNo}」吗？`, '提示', { type: 'warning' })
    await merchantSettlementApi.cancelBatch(row.id)
    ElMessage.success('已取消')
    loadList()
  } catch (e) {
    // 已处理
  }
}

onMounted(() => loadList())
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
</style>
