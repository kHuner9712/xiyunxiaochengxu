<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-card class="stat-card" shadow="never">
        <div class="stat-label">待结算</div>
        <div class="stat-value">¥{{ formatPrice(stats.pendingAmount) }}</div>
        <div class="stat-sub">{{ stats.pending }} 条</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-label">已确认</div>
        <div class="stat-value">¥{{ formatPrice(stats.confirmedAmount) }}</div>
        <div class="stat-sub">{{ stats.confirmed }} 条</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-label">已结算</div>
        <div class="stat-value">¥{{ formatPrice(stats.settledAmount) }}</div>
        <div class="stat-sub">{{ stats.settled }} 条</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-label">已取消</div>
        <div class="stat-value">¥{{ formatPrice(stats.cancelledAmount) }}</div>
        <div class="stat-sub">{{ stats.cancelled }} 条</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-label">合计</div>
        <div class="stat-value">¥{{ formatPrice(stats.totalCommissionAmount) }}</div>
        <div class="stat-sub">{{ stats.total }} 条</div>
      </el-card>
    </div>

    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="来源类型">
          <el-select v-model="searchForm.sourceType" placeholder="全部" clearable style="width: 140px">
            <el-option label="销售分佣" value="sales_referral" />
            <el-option label="服务结算" value="service_verification" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="待结算" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已结算" value="settled" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="商家ID">
          <el-input v-model="searchForm.merchantPromotionSourceId" placeholder="商家推广来源ID" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="门店ID">
          <el-input v-model="searchForm.pickupStoreId" placeholder="门店ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderId" placeholder="订单ID" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="核销码">
          <el-input v-model="searchForm.verifyCode" placeholder="核销码" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="发生时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            start-placeholder="开始"
            end-placeholder="结束"
            @change="onDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column label="来源类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.sourceType === 'sales_referral' ? 'primary' : 'success'" size="small">
              {{ row.sourceType === 'sales_referral' ? '销售分佣' : '服务结算' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商家/门店" min-width="160">
          <template #default="{ row }">
            <div v-if="row.merchantName">{{ row.merchantName }}（{{ row.merchantCode }}）</div>
            <div v-if="row.storeName">门店：{{ row.storeName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单号/核销码" min-width="160">
          <template #default="{ row }">
            <div v-if="row.orderNo">订单：{{ row.orderNo }}</div>
            <div v-if="row.verifyCode">核销码：{{ row.verifyCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="计算基数" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.sourceAmount) }}</template>
        </el-table-column>
        <el-table-column label="应结算金额" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c; font-weight: 600">¥{{ formatPrice(row.commissionAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发生时间" width="160">
          <template #default="{ row }">{{ formatDate(row.occurredAt) }}</template>
        </el-table-column>
        <el-table-column label="结算时间" width="160">
          <template #default="{ row }">{{ row.settledAt ? formatDate(row.settledAt) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              link type="primary" size="small"
              @click="handleUpdateStatus(row, 'confirmed')"
            >确认</el-button>
            <el-button
              v-if="row.status === 'pending' || row.status === 'confirmed'"
              link type="warning" size="small"
              @click="handleUpdateStatus(row, 'cancelled')"
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { merchantSettlementApi } from '@/api/merchant-settlement'
import { formatPrice, formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dateRange = ref<[Date, Date] | null>(null)

const stats = reactive({
  total: 0,
  pending: 0,
  confirmed: 0,
  settled: 0,
  cancelled: 0,
  pendingAmount: 0,
  confirmedAmount: 0,
  settledAmount: 0,
  cancelledAmount: 0,
  totalSourceAmount: 0,
  totalCommissionAmount: 0,
})

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  sourceType: '',
  merchantPromotionSourceId: '',
  pickupStoreId: '',
  status: '',
  orderId: '',
  verifyCode: '',
  occurredFrom: '',
  occurredTo: '',
})

function onDateChange(val: any) {
  if (val && val.length === 2) {
    searchForm.occurredFrom = val[0].toISOString()
    searchForm.occurredTo = val[1].toISOString()
  } else {
    searchForm.occurredFrom = ''
    searchForm.occurredTo = ''
  }
}

function statusText(s: string) {
  return { pending: '待结算', confirmed: '已确认', settled: '已结算', cancelled: '已取消' }[s] || s
}
function statusTagType(s: string): any {
  return { pending: 'warning', confirmed: 'primary', settled: 'success', cancelled: 'info' }[s] || ''
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await merchantSettlementApi.getRecords(searchForm)
    tableData.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } catch (e) {
    // 已处理
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res: any = await merchantSettlementApi.getRecordsStats()
    Object.assign(stats, res.data || {})
  } catch (e) {
    // 已处理
  }
}

function handleSearch() {
  searchForm.page = 1
  loadList()
}

function resetSearch() {
  Object.assign(searchForm, {
    sourceType: '',
    merchantPromotionSourceId: '',
    pickupStoreId: '',
    status: '',
    orderId: '',
    verifyCode: '',
    occurredFrom: '',
    occurredTo: '',
    page: 1,
  })
  dateRange.value = null
  loadList()
}

async function handleUpdateStatus(row: any, status: string) {
  try {
    await merchantSettlementApi.updateRecordStatus(row.id, { status })
    ElMessage.success('操作成功')
    loadList()
    loadStats()
  } catch (e) {
    // 已处理
  }
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>

<style scoped>
.page-container { padding: 16px; }
.stats-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.stat-card { flex: 1; min-width: 160px; }
.stat-label { color: #909399; font-size: 13px; }
.stat-value { color: #f56c6c; font-weight: 700; font-size: 20px; margin-top: 4px; }
.stat-sub { color: #909399; font-size: 12px; margin-top: 4px; }
.search-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
</style>
