<template>
  <div class="page-container">
    <el-page-header @back="router.back()" content="用户详情" style="margin-bottom: 20px" />

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header><span>基本信息</span></template>
          <div style="text-align: center; margin-bottom: 16px">
            <el-avatar :src="user.avatar" :size="80">{{ user.nickname?.charAt(0) }}</el-avatar>
            <h3 style="margin: 8px 0">{{ user.nickname }}</h3>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户ID">{{ user.id }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ user.phone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="会员等级">{{ user.memberLevelName || '普通用户' }}</el-descriptions-item>
            <el-descriptions-item label="积分">{{ user.points || 0 }}</el-descriptions-item>
            <el-descriptions-item label="余额">¥{{ formatPrice(user.balance) }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDate(user.createTime) }}</el-descriptions-item>
            <el-descriptions-item label="最后登录">{{ formatDate(user.lastLoginTime) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card style="margin-bottom: 20px">
          <template #header><span>消费统计</span></template>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-statistic title="总订单数" :value="user.orderCount || 0" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="总消费金额" :value="Number(formatPrice(user.totalSpent))" prefix="¥" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="平均客单价" :value="Number(formatPrice(user.avgOrderAmount))" prefix="¥" />
            </el-col>
          </el-row>
        </el-card>

        <el-card style="margin-bottom: 20px">
          <template #header><span>宝宝档案</span></template>
          <el-table :data="babies" stripe size="small">
            <el-table-column prop="name" label="宝宝昵称" />
            <el-table-column label="性别" width="80">
              <template #default="{ row }">{{ row.gender === 1 ? '男' : '女' }}</template>
            </el-table-column>
            <el-table-column label="出生日期" width="120">
              <template #default="{ row }">{{ formatDateShort(row.birthday) }}</template>
            </el-table-column>
            <el-table-column prop="age" label="月龄" width="80" />
          </el-table>
        </el-card>

        <el-card>
          <template #header><span>最近订单</span></template>
          <el-table :data="recentOrders" stripe size="small">
            <el-table-column prop="orderNo" label="订单号" width="200" />
            <el-table-column label="金额" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.totalAmount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="getOrderStatusTagType(row.status) as any" size="small">{{ formatOrderStatus(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { userApi } from '@/api/user'
import { formatPrice, formatDate, formatDateShort, formatOrderStatus, getOrderStatusTagType } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const user = ref<any>({})
const babies = ref<any[]>([])
const recentOrders = ref<any[]>([])

async function fetchDetail() {
  try {
    const res = await userApi.getDetail(Number(route.params.id))
    user.value = res.data || {}
    babies.value = res.data?.babies || []
    recentOrders.value = res.data?.recentOrders || []
  } catch {}
}

onMounted(() => {
  fetchDetail()
})
</script>
