<template>
  <div class="page-container">
    <el-card style="margin-bottom: 16px">
      <template #header><span>分享统计</span></template>
      <el-row :gutter="20">
        <el-col :span="4">
          <el-statistic title="总分享次数" :value="stats.totalShares" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="总点击次数" :value="stats.totalClicks" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="总注册转化" :value="stats.totalRegisters" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="邀请关系数" :value="stats.totalInviteRelations" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="首单转化数" :value="stats.totalPaidOrders" />
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-bottom: 16px">
      <template #header><span>邀请关系</span></template>
      <el-table :data="inviteList" v-loading="inviteLoading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column label="邀请人" width="140">
          <template #default="{ row }">{{ row.inviter?.nickname || row.inviterUserId }}</template>
        </el-table-column>
        <el-table-column label="被邀请人" width="140">
          <template #default="{ row }">{{ row.invitee?.nickname || row.inviteeUserId }}</template>
        </el-table-column>
        <el-table-column label="首次访问" width="170">
          <template #default="{ row }">{{ row.firstVisitAt?.replace('T', ' ').substring(0, 16) || '-' }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">{{ row.registeredAt?.replace('T', ' ').substring(0, 16) || '-' }}</template>
        </el-table-column>
        <el-table-column label="首单时间" width="170">
          <template #default="{ row }">{{ row.firstPaidAt?.replace('T', ' ').substring(0, 16) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.firstPaidAt ? 'success' : 'warning'" size="small">{{ row.firstPaidAt ? '已下单' : '待下单' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="invitePage"
        :page-size="10"
        :total="inviteTotal"
        layout="total, prev, pager, next"
        @current-change="fetchInviteList"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <el-card>
      <template #header><span>奖励记录</span></template>
      <div style="margin-bottom: 12px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-select v-model="rewardFilter.rewardType" placeholder="奖励类型" clearable style="width: 140px">
          <el-option label="积分" value="points" />
          <el-option label="优惠券" value="coupon" />
          <el-option label="实物" value="physical" />
        </el-select>
        <el-select v-model="rewardFilter.status" placeholder="状态" clearable style="width: 140px">
          <el-option label="待领取" value="pending" />
          <el-option label="已发放" value="issued" />
          <el-option label="已领取" value="claimed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-select v-model="rewardFilter.sourceType" placeholder="来源" clearable style="width: 140px">
          <el-option label="注册奖励" value="register" />
          <el-option label="首单奖励" value="first_paid_order" />
          <el-option label="邀请人数奖励" value="invite_count" />
        </el-select>
        <el-button type="primary" @click="fetchRewardList">查询</el-button>
      </div>
      <el-table :data="rewardList" v-loading="rewardLoading" size="small">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column label="获奖用户" width="140">
          <template #default="{ row }">
            <div>{{ row.userName || row.userId }}</div>
            <div style="font-size: 12px; color: #999">{{ row.userPhone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="被邀请人" width="140">
          <template #default="{ row }">
            <span v-if="row.inviteeUserId">{{ row.inviteeName || row.inviteeUserId }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="奖励类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ rewardTypeMap[row.rewardType] || row.rewardType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rewardName" label="奖励名称" min-width="160" />
        <el-table-column label="详情" width="140">
          <template #default="{ row }">
            <span v-if="row.rewardType === 'points'">{{ row.points }} 积分</span>
            <span v-else-if="row.rewardType === 'coupon'">{{ row.couponName || row.couponId }}</span>
            <span v-else>实物</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="rewardStatusTagType(row.status)" size="small">{{ rewardStatusMap[row.status] || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row }">{{ rewardSourceMap[row.sourceType] || row.sourceType }}</template>
        </el-table-column>
        <el-table-column label="发放时间" width="160">
          <template #default="{ row }">{{ row.issuedAt?.replace('T', ' ').substring(0, 16) || '-' }}</template>
        </el-table-column>
        <el-table-column label="领取时间" width="160">
          <template #default="{ row }">{{ row.claimedAt?.replace('T', ' ').substring(0, 16) || '-' }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="rewardPage"
        :page-size="10"
        :total="rewardTotal"
        layout="total, prev, pager, next"
        @current-change="fetchRewardList"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { shareApi, type InviteRewardItem } from '@/api/share'

const stats = ref({
  totalShares: 0,
  totalClicks: 0,
  totalRegisters: 0,
  totalInviteRelations: 0,
  totalPaidOrders: 0,
})

const inviteLoading = ref(false)
const inviteList = ref<any[]>([])
const inviteTotal = ref(0)
const invitePage = ref(1)

async function fetchStats() {
  try {
    const res = await shareApi.getShareStats()
    stats.value = res.data || res || stats.value
  } catch {}
}

async function fetchInviteList() {
  inviteLoading.value = true
  try {
    const res = await shareApi.getInviteRelations({ page: invitePage.value, pageSize: 10 })
    inviteList.value = res.data?.list || []
    inviteTotal.value = res.data?.total || 0
  } catch {} finally {
    inviteLoading.value = false
  }
}

// 奖励记录
const rewardLoading = ref(false)
const rewardList = ref<InviteRewardItem[]>([])
const rewardTotal = ref(0)
const rewardPage = ref(1)
const rewardFilter = reactive({
  rewardType: '',
  status: '',
  sourceType: '',
})

const rewardTypeMap: Record<string, string> = {
  points: '积分',
  coupon: '优惠券',
  physical: '实物',
}

const rewardStatusMap: Record<string, string> = {
  pending: '待领取',
  issued: '已发放',
  claimed: '已领取',
  cancelled: '已取消',
}

const rewardSourceMap: Record<string, string> = {
  register: '注册奖励',
  first_paid_order: '首单奖励',
  invite_count: '邀请人数奖励',
}

function rewardStatusTagType(status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'issued') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'claimed') return 'info'
  if (status === 'cancelled') return 'danger'
  return 'primary'
}

async function fetchRewardList() {
  rewardLoading.value = true
  try {
    const res = await shareApi.getRewards({
      page: rewardPage.value,
      pageSize: 10,
      rewardType: rewardFilter.rewardType || undefined,
      status: rewardFilter.status || undefined,
      sourceType: rewardFilter.sourceType || undefined,
    })
    rewardList.value = res.data?.list || []
    rewardTotal.value = res.data?.total || 0
  } catch {} finally {
    rewardLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
  fetchInviteList()
  fetchRewardList()
})
</script>
