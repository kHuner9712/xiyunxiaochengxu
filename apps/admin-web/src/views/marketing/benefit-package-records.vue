<template>
  <div class="page-container">
    <div class="table-card">
      <el-row :gutter="16">
        <el-col :span="4" v-for="card in statCards" :key="card.label">
          <el-card shadow="hover">
            <div style="color: #909399; font-size: 13px">{{ card.label }}</div>
            <div style="font-size: 24px; font-weight: 600; margin-top: 6px">{{ card.value }}</div>
          </el-card>
        </el-col>
      </el-row>
      <div v-if="storeStats.length || merchantStats.length" style="margin-top: 16px">
        <strong>门店核销数量</strong>
        <div style="margin-top: 6px">
          <el-tag v-for="s in storeStats" :key="s.name" style="margin: 0 8px 8px 0">{{ s.name }}：{{ s.count }}</el-tag>
        </div>
        <strong>商家核销数量</strong>
        <div style="margin-top: 6px">
          <el-tag v-for="s in merchantStats" :key="s.name" type="warning" style="margin: 0 8px 8px 0">{{ s.name }}：{{ s.count }}</el-tag>
        </div>
      </div>
    </div>

    <div class="table-card" style="margin-top: 16px">
      <el-tabs v-model="activeTab">
        <!-- 用户权益包 -->
        <el-tab-pane label="用户权益包" name="packages">
          <el-form :model="pkgSearch" inline>
            <el-form-item label="用户ID"><el-input v-model="pkgSearch.userId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="手机号"><el-input v-model="pkgSearch.phone" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="权益包ID"><el-input v-model="pkgSearch.packageId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="订单ID"><el-input v-model="pkgSearch.orderId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="状态">
              <el-select v-model="pkgSearch.status" clearable style="width: 120px">
                <el-option label="有效" value="active" />
                <el-option label="已过期" value="expired" />
                <el-option label="已退款" value="refunded" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchPackages">搜索</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="pkgData" stripe v-loading="pkgLoading">
            <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
            <el-table-column prop="packageName" label="权益包" min-width="140" show-overflow-tooltip />
            <el-table-column prop="nickname" label="用户" width="100" />
            <el-table-column prop="phone" label="手机号" width="120" />
            <el-table-column prop="orderId" label="订单ID" width="120" show-overflow-tooltip />
            <el-table-column label="使用情况" width="110">
              <template #default="{ row }">{{ row.entitlementUsed ?? 0 }} / {{ row.entitlementTotal ?? 0 }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="pkgStatusTag(row.status) as any" size="small">{{ pkgStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="有效期" min-width="200">
              <template #default="{ row }">{{ formatDate(row.validFrom) }} 至 {{ row.validTo ? formatDate(row.validTo) : '长期' }}</template>
            </el-table-column>
            <el-table-column label="到账时间" width="170">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="pkgPage.page"
              v-model:page-size="pkgPage.pageSize"
              :total="pkgPage.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="fetchPackages"
              @current-change="fetchPackages"
            />
          </div>
        </el-tab-pane>

        <!-- 单项权益 -->
        <el-tab-pane label="单项权益" name="entitlements">
          <el-form :model="entSearch" inline>
            <el-form-item label="用户ID"><el-input v-model="entSearch.userId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="手机号"><el-input v-model="entSearch.phone" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="核销码"><el-input v-model="entSearch.verifyCode" clearable style="width: 160px" /></el-form-item>
            <el-form-item label="权益包ID"><el-input v-model="entSearch.packageId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="状态">
              <el-select v-model="entSearch.status" clearable style="width: 120px">
                <el-option label="未使用" value="unused" />
                <el-option label="已使用" value="used" />
                <el-option label="已过期" value="expired" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchEntitlements">搜索</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="entData" stripe v-loading="entLoading">
            <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
            <el-table-column prop="verifyCode" label="核销码" width="120">
              <template #default="{ row }"><el-tag type="warning">{{ row.verifyCode }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="packageName" label="权益包" min-width="120" show-overflow-tooltip />
            <el-table-column prop="itemName" label="权益项" min-width="120" show-overflow-tooltip />
            <el-table-column prop="nickname" label="用户" width="100" />
            <el-table-column prop="phone" label="手机号" width="120" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="entStatusTag(row.status) as any" size="small">{{ entStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="核销时间" width="170">
              <template #default="{ row }">{{ row.usedAt ? formatDate(row.usedAt) : '-' }}</template>
            </el-table-column>
            <el-table-column label="有效期至" width="170">
              <template #default="{ row }">{{ row.validTo ? formatDate(row.validTo) : '长期' }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="entPage.page"
              v-model:page-size="entPage.pageSize"
              :total="entPage.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="fetchEntitlements"
              @current-change="fetchEntitlements"
            />
          </div>
        </el-tab-pane>

        <!-- 核销日志 -->
        <el-tab-pane label="核销日志" name="logs">
          <el-form :model="logSearch" inline>
            <el-form-item label="核销码"><el-input v-model="logSearch.verifyCode" clearable style="width: 160px" /></el-form-item>
            <el-form-item label="用户ID"><el-input v-model="logSearch.userId" clearable style="width: 140px" /></el-form-item>
            <el-form-item label="权益包ID"><el-input v-model="logSearch.packageId" clearable style="width: 140px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchLogs">搜索</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="logData" stripe v-loading="logLoading">
            <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
            <el-table-column prop="verifyCode" label="核销码" width="120" />
            <el-table-column prop="packageName" label="权益项" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.itemName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="nickname" label="用户" width="100" />
            <el-table-column prop="phone" label="手机号" width="120" />
            <el-table-column prop="verifierName" label="核销人" width="120" />
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column label="核销时间" width="170">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="logPage.page"
              v-model:page-size="logPage.pageSize"
              :total="logPage.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="fetchLogs"
              @current-change="fetchLogs"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { benefitPackageApi } from '@/api/benefit-package'
import { formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const activeTab = ref('packages')
const stats = ref<any>(null)
const storeStats = computed(() => stats.value?.byStore || [])
const merchantStats = computed(() => stats.value?.byMerchant || [])
const statCards = computed(() => {
  const s = stats.value || {}
  return [
    { label: '上架权益包', value: s.packageCount ?? 0 },
    { label: '已发放权益包', value: s.userPackageCount ?? 0 },
    { label: '权益总数', value: s.entitlementTotal ?? 0 },
    { label: '已核销', value: s.entitlementUsed ?? 0 },
    { label: '未核销', value: s.entitlementUnused ?? 0 },
    { label: '核销记录数', value: s.verifyLogCount ?? 0 },
  ]
})

async function fetchStats() {
  try {
    const res = await benefitPackageApi.getStats()
    stats.value = res.data
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取统计失败')
  }
}

// 用户权益包
const pkgSearch = reactive({ userId: '', phone: '', packageId: '', orderId: '', status: '' })
const pkgPage = reactive({ page: 1, pageSize: 10, total: 0 })
const pkgData = ref<any[]>([])
const pkgLoading = ref(false)
async function fetchPackages() {
  pkgLoading.value = true
  try {
    const res = await benefitPackageApi.getUserPackages({
      page: pkgPage.page,
      pageSize: pkgPage.pageSize,
      userId: pkgSearch.userId || undefined,
      phone: pkgSearch.phone || undefined,
      packageId: pkgSearch.packageId || undefined,
      orderId: pkgSearch.orderId || undefined,
      status: pkgSearch.status || undefined,
    })
    pkgData.value = asArray(res.data)
    pkgPage.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取权益包失败')
  } finally {
    pkgLoading.value = false
  }
}
function searchPackages() { pkgPage.page = 1; fetchPackages() }
function pkgStatusLabel(s: string) { return { active: '有效', expired: '已过期', refunded: '已退款', cancelled: '已取消' }[s] || s }
function pkgStatusTag(s: string) { return { active: 'success', expired: 'warning', refunded: 'info', cancelled: 'info' }[s] || 'info' }

// 单项权益
const entSearch = reactive({ userId: '', phone: '', verifyCode: '', packageId: '', status: '' })
const entPage = reactive({ page: 1, pageSize: 10, total: 0 })
const entData = ref<any[]>([])
const entLoading = ref(false)
async function fetchEntitlements() {
  entLoading.value = true
  try {
    const res = await benefitPackageApi.getEntitlements({
      page: entPage.page,
      pageSize: entPage.pageSize,
      userId: entSearch.userId || undefined,
      phone: entSearch.phone || undefined,
      verifyCode: entSearch.verifyCode || undefined,
      packageId: entSearch.packageId || undefined,
      status: entSearch.status || undefined,
    })
    entData.value = asArray(res.data)
    entPage.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取权益失败')
  } finally {
    entLoading.value = false
  }
}
function searchEntitlements() { entPage.page = 1; fetchEntitlements() }
function entStatusLabel(s: string) { return { unused: '未使用', used: '已使用', expired: '已过期', cancelled: '已取消', refunded: '已退款' }[s] || s }
function entStatusTag(s: string) { return { unused: 'success', used: 'info', expired: 'warning', cancelled: 'info', refunded: 'info' }[s] || 'info' }

// 核销日志
const logSearch = reactive({ verifyCode: '', userId: '', packageId: '' })
const logPage = reactive({ page: 1, pageSize: 10, total: 0 })
const logData = ref<any[]>([])
const logLoading = ref(false)
async function fetchLogs() {
  logLoading.value = true
  try {
    const res = await benefitPackageApi.getVerificationLogs({
      page: logPage.page,
      pageSize: logPage.pageSize,
      verifyCode: logSearch.verifyCode || undefined,
      userId: logSearch.userId || undefined,
      packageId: logSearch.packageId || undefined,
    })
    logData.value = asArray(res.data)
    logPage.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取日志失败')
  } finally {
    logLoading.value = false
  }
}
function searchLogs() { logPage.page = 1; fetchLogs() }

fetchStats()
fetchPackages()
fetchEntitlements()
fetchLogs()
</script>
