<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>积分规则配置</span>
        </div>
      </template>

      <el-table :data="ruleList" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="规则名称" width="150" />
        <el-table-column prop="code" label="规则编码" width="150" />
        <el-table-column label="积分值" width="100">
          <template #default="{ row }">{{ row.points }}</template>
        </el-table-column>
        <el-table-column label="积分上限/天" width="120">
          <template #default="{ row }">{{ row.dailyLimit || '无限制' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { pointsApi } from '@/api/points'

const loading = ref(false)
const ruleList = ref<any[]>([])

async function fetchList() {
  loading.value = true
  try {
    const res = await pointsApi.getList()
    ruleList.value = res.data || []
  } catch {} finally {
    loading.value = false
  }
}

fetchList()
</script>
