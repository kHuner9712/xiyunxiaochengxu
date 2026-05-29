<template>
  <div class="page-container">
    <el-alert
      title="对账与补偿操作说明"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    >
      <template #default>
        本页面用于手动补偿微信回调丢失、本地状态不一致等异常场景。对账操作会查询微信侧状态并修复本地数据，<strong>不是实时强一致</strong>，请勿频繁触发。
      </template>
    </el-alert>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>支付对账</span>
              <el-button type="primary" :loading="paymentLoading" @click="handlePaymentReconcile">
                触发支付对账
              </el-button>
            </div>
          </template>
          <div class="reconcile-desc">
            扫描本地支付记录，与微信侧状态对账，修复半成功状态（支付已成功但订单未推进）。
          </div>
          <div v-if="paymentResult" class="reconcile-result">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="总计">{{ paymentResult.total }}</el-descriptions-item>
              <el-descriptions-item label="已修复">
                <el-tag :type="paymentResult.fixed > 0 ? 'success' : 'info'" size="small">{{ paymentResult.fixed }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <el-tag :type="paymentResult.failed > 0 ? 'danger' : 'info'" size="small">{{ paymentResult.failed }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="跳过">
                <el-tag type="info" size="small">{{ paymentResult.skipped }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂未执行对账" :image-size="60" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>退款对账</span>
              <el-button type="primary" :loading="refundLoading" @click="handleRefundReconcile">
                触发退款对账
              </el-button>
            </div>
          </template>
          <div class="reconcile-desc">
            扫描本地退款记录，与微信侧状态对账，修复退款成功但本地未完成、退款关闭等异常。
          </div>
          <div v-if="refundResult" class="reconcile-result">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="总计">{{ refundResult.total }}</el-descriptions-item>
              <el-descriptions-item label="已修复">
                <el-tag :type="refundResult.fixed > 0 ? 'success' : 'info'" size="small">{{ refundResult.fixed }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <el-tag :type="refundResult.failed > 0 ? 'danger' : 'info'" size="small">{{ refundResult.failed }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="跳过">
                <el-tag type="info" size="small">{{ refundResult.skipped }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂未执行对账" :image-size="60" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>单笔退款同步</span>
              <el-button type="primary" :loading="syncLoading" :disabled="!syncOutRefundNo" @click="handleSyncRefund">
                同步退款状态
              </el-button>
            </div>
          </template>
          <div class="reconcile-desc">
            输入退款单号(outRefundNo)，查询微信侧状态并同步到本地，可补偿回调丢失的退款。
          </div>
          <el-input
            v-model="syncOutRefundNo"
            placeholder="请输入退款单号，如 REFUND123..."
            clearable
            style="margin: 16px 0"
          />
          <div v-if="syncResult" class="reconcile-result">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="同步状态">
                <el-tag :type="syncResult.synced ? 'success' : 'warning'" size="small">
                  {{ syncResult.synced ? '已同步' : '未同步' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="原因">{{ syncResult.reason }}</el-descriptions-item>
              <el-descriptions-item label="信息">{{ syncResult.message }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else-if="!syncOutRefundNo" description="输入退款单号后同步" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>支付补偿任务</span>
          <div class="filter-row">
            <el-select v-model="compensationQuery.status" style="width: 140px" @change="handleCompensationFilterChange">
              <el-option label="全部状态" value="" />
              <el-option label="待处理" value="pending" />
              <el-option label="已解决" value="resolved" />
              <el-option label="已忽略" value="ignored" />
            </el-select>
            <el-input
              v-model="compensationQuery.orderNo"
              placeholder="按订单号搜索"
              clearable
              style="width: 220px"
              @keyup.enter="fetchCompensationTasks"
              @clear="handleCompensationFilterChange"
            />
            <el-button type="primary" :loading="compensationLoading" @click="fetchCompensationTasks">查询</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="compensationLoading" :data="compensationList" border>
        <el-table-column prop="orderNo" label="订单号" min-width="150" />
        <el-table-column prop="transactionId" label="微信交易号" min-width="180" />
        <el-table-column prop="amount" label="金额(分)" width="100" />
        <el-table-column prop="reason" label="原因" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'warning' : row.status === 'resolved' ? 'success' : 'info'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="回调摘要" min-width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="showPayloadDetail(row)">查看详情</el-button>
            <span class="payload-summary">{{ summarizePayload(row.callbackPayload) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status !== 'pending'" @click="openResolveDialog(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="compensationPagination.total"
          :current-page="compensationPagination.page"
          :page-size="compensationPagination.pageSize"
          :page-sizes="[10, 20, 50]"
          @current-change="handleCompensationPageChange"
          @size-change="handleCompensationSizeChange"
        />
      </div>
    </el-card>

    <el-card v-if="lastError" style="margin-top: 20px">
      <template #header><span style="color: #f56c6c">错误信息</span></template>
      <pre class="result-json error-json">{{ lastError }}</pre>
    </el-card>

    <el-dialog v-model="payloadDialogVisible" title="回调载荷详情" width="720px">
      <pre class="result-json">{{ payloadDialogText }}</pre>
    </el-dialog>

    <el-dialog v-model="resolveDialogVisible" title="处理补偿任务" width="520px">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="处理动作">
          <el-radio-group v-model="resolveForm.status">
            <el-radio label="resolved">resolved</el-radio>
            <el-radio label="ignored">ignored</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理结论">
          <el-input v-model="resolveForm.resolution" type="textarea" :rows="4" placeholder="请输入处理结论" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resolveSubmitting" @click="submitResolve">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reconcileApi } from '@/api/reconcile'

const paymentLoading = ref(false)
const refundLoading = ref(false)
const syncLoading = ref(false)
const compensationLoading = ref(false)
const resolveSubmitting = ref(false)

const paymentResult = ref<{ total: number; fixed: number; failed: number; skipped: number } | null>(null)
const refundResult = ref<{ total: number; fixed: number; failed: number; skipped: number } | null>(null)
const syncResult = ref<any>(null)
const syncOutRefundNo = ref('')
const lastError = ref('')

const compensationQuery = reactive({
  page: 1,
  pageSize: 10,
  status: '',
  orderNo: '',
})
const compensationList = ref<any[]>([])
const compensationPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const payloadDialogVisible = ref(false)
const payloadDialogText = ref('')
const resolveDialogVisible = ref(false)
const currentTask = ref<any>(null)
const resolveForm = reactive<{ status: 'resolved' | 'ignored'; resolution: string }>({
  status: 'resolved',
  resolution: '',
})

async function handlePaymentReconcile() {
  try {
    await ElMessageBox.confirm('即将触发支付对账，将查询微信侧状态并修复本地异常数据。请勿频繁触发，是否继续？', '确认操作', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  paymentLoading.value = true
  lastError.value = ''
  try {
    const res = await reconcileApi.reconcilePayments()
    paymentResult.value = res.data
    if (res.data.fixed > 0) {
      ElMessage.success(`支付对账完成，修复 ${res.data.fixed} 条记录`)
    } else {
      ElMessage.info('支付对账完成，无需修复')
    }
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '支付对账请求失败'
    lastError.value = message
    ElMessage.error(message)
  } finally {
    paymentLoading.value = false
  }
}

async function handleRefundReconcile() {
  try {
    await ElMessageBox.confirm('即将触发退款对账，将查询微信侧状态并修复本地异常数据。请勿频繁触发，是否继续？', '确认操作', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  refundLoading.value = true
  lastError.value = ''
  try {
    const res = await reconcileApi.reconcileRefunds()
    refundResult.value = res.data
    if (res.data.fixed > 0) {
      ElMessage.success(`退款对账完成，修复 ${res.data.fixed} 条记录`)
    } else {
      ElMessage.info('退款对账完成，无需修复')
    }
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '退款对账请求失败'
    lastError.value = message
    ElMessage.error(message)
  } finally {
    refundLoading.value = false
  }
}

async function handleSyncRefund() {
  const outRefundNo = syncOutRefundNo.value.trim()
  if (!outRefundNo) {
    ElMessage.warning('请输入退款单号')
    return
  }
  try {
    await ElMessageBox.confirm(`即将同步退款单 ${outRefundNo} 的微信侧状态到本地，是否继续？`, '确认操作', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  syncLoading.value = true
  lastError.value = ''
  try {
    const res = await reconcileApi.syncRefund(outRefundNo)
    syncResult.value = res.data
    if (res.data.synced) {
      ElMessage.success(res.data.message || '同步成功')
    } else {
      ElMessage.warning(res.data.message || '同步未完成')
    }
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '退款同步请求失败'
    lastError.value = message
    ElMessage.error(message)
  } finally {
    syncLoading.value = false
  }
}

function summarizePayload(payload: any) {
  if (!payload) return '-'
  const tx = payload?.decryptedData?.transaction_id || payload?.transactionId
  if (tx) return `transaction_id: ${tx}`
  return '可查看详情'
}

function showPayloadDetail(row: any) {
  payloadDialogText.value = JSON.stringify(row.callbackPayload || {}, null, 2)
  payloadDialogVisible.value = true
}

function openResolveDialog(row: any) {
  currentTask.value = row
  resolveForm.status = 'resolved'
  resolveForm.resolution = ''
  resolveDialogVisible.value = true
}

async function submitResolve() {
  if (!currentTask.value) return
  if (!resolveForm.resolution.trim()) {
    ElMessage.warning('请输入处理结论')
    return
  }
  resolveSubmitting.value = true
  try {
    await reconcileApi.resolveCompensationTask(currentTask.value.id, {
      status: resolveForm.status,
      resolution: resolveForm.resolution.trim(),
    })
    ElMessage.success('补偿任务处理成功')
    resolveDialogVisible.value = false
    await fetchCompensationTasks()
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '补偿任务处理失败'
    ElMessage.error(message)
  } finally {
    resolveSubmitting.value = false
  }
}

function handleCompensationFilterChange() {
  compensationQuery.page = 1
  fetchCompensationTasks()
}

function handleCompensationPageChange(page: number) {
  compensationQuery.page = page
  fetchCompensationTasks()
}

function handleCompensationSizeChange(pageSize: number) {
  compensationQuery.pageSize = pageSize
  compensationQuery.page = 1
  fetchCompensationTasks()
}

async function fetchCompensationTasks() {
  compensationLoading.value = true
  try {
    const res = await reconcileApi.listCompensationTasks({
      page: compensationQuery.page,
      pageSize: compensationQuery.pageSize,
      status: compensationQuery.status || undefined,
      orderNo: compensationQuery.orderNo.trim() || undefined,
    })
    compensationList.value = res.data.list || []
    compensationPagination.page = res.data.pagination?.page || compensationQuery.page
    compensationPagination.pageSize = res.data.pagination?.pageSize || compensationQuery.pageSize
    compensationPagination.total = res.data.pagination?.total || 0
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '补偿任务列表加载失败'
    ElMessage.error(message)
  } finally {
    compensationLoading.value = false
  }
}

onMounted(() => {
  fetchCompensationTasks()
})
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reconcile-desc {
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.reconcile-result {
  margin-top: 16px;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.payload-summary {
  color: #909399;
  margin-left: 8px;
}

.result-json {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-json {
  background: #fef0f0;
  color: #f56c6c;
}
</style>
