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
        <el-table-column prop="id" label="ID" width="80" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { shareApi } from '@/api/share'

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

onMounted(() => {
  fetchStats()
  fetchInviteList()
})
</script>
