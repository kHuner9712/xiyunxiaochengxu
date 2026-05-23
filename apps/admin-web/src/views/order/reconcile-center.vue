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
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>支付对账</span>
              <el-button
                type="primary"
                :loading="paymentLoading"
                @click="handlePaymentReconcile"
              >
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
                <el-tag :type="paymentResult.fixed > 0 ? 'success' : 'info'" size="small">
                  {{ paymentResult.fixed }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <el-tag :type="paymentResult.failed > 0 ? 'danger' : 'info'" size="small">
                  {{ paymentResult.failed }}
                </el-tag>
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
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>退款对账</span>
              <el-button
                type="primary"
                :loading="refundLoading"
                @click="handleRefundReconcile"
              >
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
                <el-tag :type="refundResult.fixed > 0 ? 'success' : 'info'" size="small">
                  {{ refundResult.fixed }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <el-tag :type="refundResult.failed > 0 ? 'danger' : 'info'" size="small">
                  {{ refundResult.failed }}
                </el-tag>
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
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>单笔退款同步</span>
              <el-button
                type="primary"
                :loading="syncLoading"
                :disabled="!syncOutRefundNo"
                @click="handleSyncRefund"
              >
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
            <div v-if="syncResult.orphanLog" style="margin-top: 12px">
              <el-divider content-position="left">孤儿回调信息</el-divider>
              <pre class="result-json">{{ JSON.stringify(syncResult.orphanLog, null, 2) }}</pre>
            </div>
          </div>
          <el-empty v-else-if="!syncOutRefundNo" description="输入退款单号后同步" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="lastError" style="margin-top: 20px">
      <template #header><span style="color: #f56c6c">错误信息</span></template>
      <pre class="result-json error-json">{{ lastError }}</pre>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reconcileApi } from '@/api/reconcile'

const paymentLoading = ref(false)
const refundLoading = ref(false)
const syncLoading = ref(false)

const paymentResult = ref<{ total: number; fixed: number; failed: number; skipped: number } | null>(null)
const refundResult = ref<{ total: number; fixed: number; failed: number; skipped: number } | null>(null)
const syncResult = ref<any>(null)
const syncOutRefundNo = ref('')
const lastError = ref('')

async function handlePaymentReconcile() {
  try {
    await ElMessageBox.confirm(
      '即将触发支付对账，将查询微信侧状态并修复本地异常数据。请勿频繁触发，是否继续？',
      '确认操作',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' },
    )
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
  } catch (e: any) {
    lastError.value = e?.message || '支付对账请求失败'
    ElMessage.error('支付对账请求失败')
  } finally {
    paymentLoading.value = false
  }
}

async function handleRefundReconcile() {
  try {
    await ElMessageBox.confirm(
      '即将触发退款对账，将查询微信侧状态并修复本地异常数据。请勿频繁触发，是否继续？',
      '确认操作',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' },
    )
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
  } catch (e: any) {
    lastError.value = e?.message || '退款对账请求失败'
    ElMessage.error('退款对账请求失败')
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
    await ElMessageBox.confirm(
      `即将同步退款单 ${outRefundNo} 的微信侧状态到本地，是否继续？`,
      '确认操作',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' },
    )
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
  } catch (e: any) {
    lastError.value = e?.message || '退款同步请求失败'
    ElMessage.error('退款同步请求失败')
  } finally {
    syncLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.reconcile-desc {
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.reconcile-result {
  margin-top: 16px;
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
