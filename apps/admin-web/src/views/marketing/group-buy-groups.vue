<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <el-row :gutter="12" style="margin-bottom: 16px">
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">开团数</div>
          <div class="stat-value">{{ stats.totalGroups ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">组团中</div>
          <div class="stat-value" style="color: #e6a23c">{{ stats.formingGroups ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">成团数</div>
          <div class="stat-value" style="color: #67c23a">{{ stats.successGroups ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">已失败</div>
          <div class="stat-value" style="color: #f56c6c">{{ stats.failedGroups ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">参团人数</div>
          <div class="stat-value">{{ stats.totalMembers ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover">
          <div class="stat-label">成交金额</div>
          <div class="stat-value">¥{{ formatPrice(stats.totalAmount ?? 0) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="活动ID">
          <el-input v-model="searchForm.activityId" placeholder="活动ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="团状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="组团中" value="forming" />
            <el-option label="已成团" value="success" />
            <el-option label="已失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="团号">
          <el-input v-model="searchForm.groupNo" placeholder="团号" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="团长用户ID">
          <el-input v-model="searchForm.leaderUserId" placeholder="用户ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="warning" plain @click="handleMarkExpired">标记过期团</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="groupNo" label="团号" width="200" show-overflow-tooltip />
        <el-table-column prop="activityId" label="活动ID" width="90" />
        <el-table-column prop="leaderUserId" label="团长ID" width="90" />
        <el-table-column label="人数" width="100">
          <template #default="{ row }">{{ row.currentCount }} / {{ row.targetCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="groupStatusTagType(row.status)" size="small">{{ groupStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="过期时间" width="170">
          <template #default="{ row }">{{ formatDate(row.expiresAt) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
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

    <!-- 团详情抽屉 -->
    <el-drawer v-model="detailVisible" title="团详情" size="600px">
      <div v-if="detail" style="padding: 0 8px">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="团号">{{ detail.groupNo }}</el-descriptions-item>
          <el-descriptions-item label="活动ID">{{ detail.activityId }}</el-descriptions-item>
          <el-descriptions-item label="团长ID">{{ detail.leaderUserId }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="groupStatusTagType(detail.status)" size="small">{{ groupStatusText(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前/目标">{{ detail.currentCount }} / {{ detail.targetCount }}</el-descriptions-item>
          <el-descriptions-item label="过期时间">{{ formatDate(detail.expiresAt) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="成团时间">{{ detail.successAt ? formatDate(detail.successAt) : '-' }}</el-descriptions-item>
        </el-descriptions>

        <div style="font-weight: 600; margin-bottom: 8px">成员列表</div>
        <el-table :data="detail.members" stripe size="small">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="userId" label="用户ID" width="90" />
          <el-table-column label="角色" width="80">
            <template #default="{ row }">
              <el-tag :type="row.role === 'leader' ? 'primary' : 'info'" size="small">
                {{ row.role === 'leader' ? '团长' : '成员' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="memberStatusTagType(row.status)" size="small">{{ memberStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="orderId" label="订单ID" width="100" />
          <el-table-column label="支付时间" min-width="150">
            <template #default="{ row }">{{ row.paidAt ? formatDate(row.paidAt) : '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { groupBuyApi } from '@/api/group-buy'
import { formatPrice, formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const detailVisible = ref(false)
const detail = ref<any>(null)
const stats = ref<any>({})

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  activityId: '',
  status: '',
  groupNo: '',
  leaderUserId: '',
})

function groupStatusText(s: string): string {
  const map: Record<string, string> = { forming: '组团中', success: '已成团', failed: '已失败', cancelled: '已取消' }
  return map[s] || s
}
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

function groupStatusTagType(s: string): TagType {
  const map: Record<string, TagType> = { forming: 'warning', success: 'success', failed: 'danger', cancelled: 'info' }
  return map[s] || 'info'
}
function memberStatusText(s: string): string {
  const map: Record<string, string> = { pending_payment: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款' }
  return map[s] || s
}
function memberStatusTagType(s: string): TagType {
  const map: Record<string, TagType> = { pending_payment: 'warning', paid: 'success', cancelled: 'info', refunded: 'danger' }
  return map[s] || 'info'
}

async function loadStats() {
  try {
    const res: any = await groupBuyApi.getStats()
    stats.value = res.data || {}
  } catch (e) {
    // ignore
  }
}

async function loadList() {
  loading.value = true
  try {
    const params: any = {
      page: searchForm.page,
      pageSize: searchForm.pageSize,
    }
    if (searchForm.activityId) params.activityId = Number(searchForm.activityId)
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.groupNo) params.groupNo = searchForm.groupNo
    if (searchForm.leaderUserId) params.leaderUserId = Number(searchForm.leaderUserId)
    const res: any = await groupBuyApi.getGroups(params)
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
  searchForm.activityId = ''
  searchForm.status = ''
  searchForm.groupNo = ''
  searchForm.leaderUserId = ''
  searchForm.page = 1
  loadList()
}

async function handleDetail(row: any) {
  const res: any = await groupBuyApi.getGroupDetail(row.id)
  detail.value = res.data
  detailVisible.value = true
}

async function handleMarkExpired() {
  try {
    await ElMessageBox.confirm('将所有过期且组团中的团标记为失败，确认执行？', '提示', { type: 'warning' })
    const res: any = await groupBuyApi.markExpired()
    ElMessage.success(`已标记 ${res.data?.affected ?? 0} 个过期团为失败`)
    loadList()
    loadStats()
  } catch (e) {
    // 取消或错误
  }
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
.stat-label { font-size: 12px; color: #909399; }
.stat-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
</style>
