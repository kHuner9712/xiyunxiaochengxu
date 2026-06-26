<template>
  <div class="flash-sale-orders-page">
    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-label">活动数</div>
        <div class="stat-value">{{ stats.activityCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">秒杀订单数</div>
        <div class="stat-value">{{ stats.orderCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">待支付锁定</div>
        <div class="stat-value warn">{{ stats.pendingCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">已支付成交</div>
        <div class="stat-value success">{{ stats.paidCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">已取消</div>
        <div class="stat-value">{{ stats.cancelledCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">已过期锁</div>
        <div class="stat-value">{{ stats.expiredCount }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-label">成交金额</div>
        <div class="stat-value success">¥{{ formatPrice(stats.paidAmount) }}</div>
      </el-card>
    </div>

    <div class="search-bar">
      <el-input v-model="searchForm.activityId" placeholder="活动ID" clearable style="width: 120px" />
      <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 140px">
        <el-option label="待支付" value="pending_payment" />
        <el-option label="已支付" value="paid" />
        <el-option label="已取消" value="cancelled" />
        <el-option label="已过期" value="expired" />
        <el-option label="已退款" value="refunded" />
      </el-select>
      <el-input v-model="searchForm.userId" placeholder="用户ID" clearable style="width: 120px" />
      <el-input v-model="searchForm.orderId" placeholder="订单ID" clearable style="width: 120px" />
      <el-button type="primary" @click="loadList">查询</el-button>
      <el-button type="warning" @click="handleReleaseExpired">释放过期锁</el-button>
    </div>

    <el-table v-loading="loading" :data="tableData" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="activityId" label="活动ID" width="90" />
      <el-table-column prop="userId" label="用户ID" width="90" />
      <el-table-column prop="orderId" label="订单ID" width="100" />
      <el-table-column prop="quantity" label="数量" width="70" />
      <el-table-column label="秒杀价" width="100">
        <template #default="{ row }">¥{{ formatPrice(row.flashPrice) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="orderStatusTagType(row.status)">{{ orderStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="锁过期时间" width="170">
        <template #default="{ row }">{{ formatDateShort(row.lockExpireAt) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateShort(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="支付时间" width="170">
        <template #default="{ row }">{{ row.paidAt ? formatDateShort(row.paidAt) : '-' }}</template>
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { flashSaleApi } from '@/api/flash-sale'
import { formatPrice, formatDateShort } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const stats = ref({
  activityCount: 0,
  orderCount: 0,
  pendingCount: 0,
  paidCount: 0,
  cancelledCount: 0,
  expiredCount: 0,
  paidAmount: 0,
})

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  activityId: '',
  status: '',
  userId: '',
  orderId: '',
})

function orderStatusText(s: string): string {
  const map: Record<string, string> = {
    pending_payment: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    expired: '已过期',
    refunded: '已退款',
  }
  return map[s] || s
}

function orderStatusTagType(s: string): TagType {
  const map: Record<string, TagType> = {
    pending_payment: 'warning',
    paid: 'success',
    cancelled: 'info',
    expired: 'info',
    refunded: 'danger',
  }
  return map[s] || 'info'
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await flashSaleApi.getOrders({
      page: searchForm.page,
      pageSize: searchForm.pageSize,
      activityId: searchForm.activityId || undefined,
      status: searchForm.status || undefined,
      userId: searchForm.userId || undefined,
      orderId: searchForm.orderId || undefined,
    })
    tableData.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res: any = await flashSaleApi.getStats()
    stats.value = res.data || stats.value
  } catch (e) {}
}

async function handleReleaseExpired() {
  try {
    await ElMessageBox.confirm('确认释放所有过期的秒杀库存锁？', '提示', { type: 'warning' })
    const res: any = await flashSaleApi.releaseExpiredLocks()
    ElMessage.success(`已释放 ${res.data?.released ?? 0} 条过期锁`)
    loadList()
    loadStats()
  } catch (e) {}
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>

<style scoped>
.flash-sale-orders-page {
  padding: 16px;
}
.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.stat-card {
  min-width: 130px;
}
.stat-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #333;
}
.stat-value.warn {
  color: #e6a23c;
}
.stat-value.success {
  color: #67c23a;
}
.search-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
