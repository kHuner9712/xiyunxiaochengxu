<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>裂变活动</span>
          <el-button type="primary" @click="openCreateDialog">创建活动</el-button>
        </div>
      </template>

      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="name" label="活动名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            <el-tag>{{ typeMap[row.type] || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rewardType" label="奖励类型" width="120">
          <template #default="{ row }">
            <el-tag type="warning">{{ rewardTypeMap[row.rewardType] || row.rewardType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="活动时间" width="200">
          <template #default="{ row }">
            <div style="font-size: 12px">{{ formatDate(row.startTime) }}</div>
            <div style="font-size: 12px">至 {{ formatDate(row.endTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 1 ? 'danger' : 'success'"
              :loading="statusBusyIds.has(String(row.id))"
              :disabled="statusBusyIds.has(String(row.id))"
              @click="handleToggleStatus(row)"
            >{{ row.status === 1 ? '停用' : '启用' }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        :page-size="10"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchList"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="showCreateDialog" :title="editingId ? '编辑活动' : '创建活动'" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="活动名称" required>
          <el-input v-model="form.name" placeholder="请输入活动名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="活动类型">
          <el-select v-model="form.type">
            <el-option label="邀新有礼" value="invite_new_user" />
            <el-option label="商品分享" value="product_share" />
            <el-option label="活动分享" value="activity_share" />
            <el-option label="内容分享" value="content_share" />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励类型">
          <el-select v-model="form.rewardType">
            <el-option label="积分" value="points" />
            <el-option label="优惠券" value="coupon" />
            <el-option label="积分+优惠券" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="邀请人奖励">
          <div style="width: 100%">
            <div v-if="form.rewardType === 'points' || form.rewardType === 'both'">
              <el-input-number
                v-model="form.inviterPoints"
                :min="1"
                :max="2147483647"
                :step="1"
                controls-position="right"
                style="width: 100%; margin-bottom: 8px"
              />
            </div>
            <div v-if="form.rewardType === 'coupon' || form.rewardType === 'both'">
              <el-select
                v-model="form.inviterCouponId"
                filterable
                remote
                reserve-keyword
                clearable
                :remote-method="searchCoupons"
                :loading="couponLoading"
                placeholder="请输入优惠券名称搜索"
                style="width: 100%; margin-bottom: 8px"
              >
                <el-option
                  v-for="item in couponOptions"
                  :key="item.id"
                  :label="couponOptionLabel(item)"
                  :value="String(item.id)"
                />
              </el-select>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="被邀请人奖励">
          <div style="width: 100%">
            <div v-if="form.rewardType === 'points' || form.rewardType === 'both'">
              <el-input-number
                v-model="form.inviteePoints"
                :min="0"
                :max="2147483647"
                :step="1"
                controls-position="right"
                style="width: 100%; margin-bottom: 8px"
              />
              <div class="hint">0 表示不发注册积分</div>
            </div>
            <div v-if="form.rewardType === 'coupon' || form.rewardType === 'both'">
              <el-select
                v-model="form.inviteeCouponId"
                filterable
                remote
                reserve-keyword
                clearable
                :remote-method="searchCoupons"
                :loading="couponLoading"
                placeholder="可选；输入优惠券名称搜索"
                style="width: 100%; margin-bottom: 8px"
              >
                <el-option
                  v-for="item in couponOptions"
                  :key="item.id"
                  :label="couponOptionLabel(item)"
                  :value="String(item.id)"
                />
              </el-select>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker v-model="form.startTime" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="结束时间" required>
          <el-date-picker v-model="form.endTime" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { shareApi } from '@/api/share'
import { couponApi } from '@/api/coupon'
import { formatDate, formatPrice } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const POSITIVE_ID = /^[1-9]\d*$/
const CAMPAIGN_TYPES = new Set(['invite_new_user', 'product_share', 'activity_share', 'content_share'])
const REWARD_TYPES = new Set(['points', 'coupon', 'both'])
const loading = ref(false)
const saving = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const showCreateDialog = ref(false)
const editingId = ref('')
const couponOptions = ref<any[]>([])
const couponLoading = ref(false)
const statusBusyIds = reactive(new Set<string>())
let listLoadSeq = 0
let couponLoadSeq = 0

const typeMap: Record<string, string> = {
  invite_new_user: '邀新有礼',
  product_share: '商品分享',
  activity_share: '活动分享',
  content_share: '内容分享',
}

const rewardTypeMap: Record<string, string> = {
  points: '积分',
  coupon: '优惠券',
  both: '积分+优惠券',
}

const form = reactive({
  name: '',
  type: 'invite_new_user',
  rewardType: 'points',
  inviterPoints: 10,
  inviterCouponId: '',
  inviteePoints: 0,
  inviteeCouponId: '',
  startTime: '' as string | Date,
  endTime: '' as string | Date,
})

function couponOptionLabel(item: any) {
  const value = Number(item?.value || 0)
  if (Number(item?.type) === 2) return `${item.name}（${value / 10}折）`
  return `${item.name}（¥${formatPrice(value)}）`
}

async function loadCoupons(keyword?: string) {
  const normalizedKeyword = String(keyword || '').trim()
  const requestSeq = ++couponLoadSeq
  couponLoading.value = true
  try {
    const res = await couponApi.getList({ page: 1, pageSize: 100, name: normalizedKeyword || undefined, status: 1 })
    if (requestSeq !== couponLoadSeq) return
    couponOptions.value = asArray(res.data)
  } catch (e: any) {
    if (requestSeq === couponLoadSeq) {
      couponOptions.value = []
      ElMessage.error(e?.message || '加载优惠券失败')
    }
  } finally {
    if (requestSeq === couponLoadSeq) couponLoading.value = false
  }
}

async function searchCoupons(query: string) {
  await loadCoupons(query || undefined)
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, {
    name: '',
    type: 'invite_new_user',
    rewardType: 'points',
    inviterPoints: 10,
    inviterCouponId: '',
    inviteePoints: 0,
    inviteeCouponId: '',
    startTime: '',
    endTime: '',
  })
}

function openCreateDialog() {
  resetForm()
  void loadCoupons()
  showCreateDialog.value = true
}

async function fetchList() {
  const requestSeq = ++listLoadSeq
  loading.value = true
  try {
    const res = await shareApi.getCampaignList({ page: page.value, pageSize: 10 })
    if (requestSeq !== listLoadSeq) return
    list.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } catch (e: any) {
    if (requestSeq === listLoadSeq) ElMessage.error(e?.message || '加载裂变活动失败')
  } finally {
    if (requestSeq === listLoadSeq) loading.value = false
  }
}

function handleEdit(row: any) {
  editingId.value = String(row.id)
  Object.assign(form, {
    name: row.name || '',
    type: row.type || 'invite_new_user',
    rewardType: row.rewardType || 'points',
    inviterPoints: Number(row.inviterRewardConfig?.points || 0),
    inviterCouponId: row.inviterRewardConfig?.couponId ? String(row.inviterRewardConfig.couponId) : '',
    inviteePoints: Number(row.inviteeRewardConfig?.points || 0),
    inviteeCouponId: row.inviteeRewardConfig?.couponId ? String(row.inviteeRewardConfig.couponId) : '',
    startTime: row.startTime || '',
    endTime: row.endTime || '',
  })
  void loadCoupons()
  showCreateDialog.value = true
}

function buildPayload() {
  const name = form.name.trim()
  if (!name) throw new Error('请输入活动名称')
  if (!CAMPAIGN_TYPES.has(form.type)) throw new Error('活动类型无效')
  if (!REWARD_TYPES.has(form.rewardType)) throw new Error('奖励类型无效')

  const start = new Date(form.startTime)
  const end = new Date(form.endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('活动结束时间必须晚于开始时间')
  }

  const hasPoints = form.rewardType === 'points' || form.rewardType === 'both'
  const hasCoupon = form.rewardType === 'coupon' || form.rewardType === 'both'
  if (hasPoints && (!Number.isSafeInteger(form.inviterPoints) || form.inviterPoints <= 0)) {
    throw new Error('邀请人首单积分奖励必须为正整数')
  }
  if (hasPoints && (!Number.isSafeInteger(form.inviteePoints) || form.inviteePoints < 0)) {
    throw new Error('被邀请人注册积分奖励必须为非负整数')
  }
  if (hasCoupon && !POSITIVE_ID.test(form.inviterCouponId)) {
    throw new Error('请选择邀请人首单奖励优惠券')
  }
  if (hasCoupon && form.inviteeCouponId && !POSITIVE_ID.test(form.inviteeCouponId)) {
    throw new Error('被邀请人注册奖励优惠券ID无效')
  }

  return {
    name,
    type: form.type,
    rewardType: form.rewardType,
    inviterRewardConfig: {
      points: hasPoints ? form.inviterPoints : 0,
      couponId: hasCoupon ? form.inviterCouponId : '',
    },
    inviteeRewardConfig: {
      points: hasPoints ? form.inviteePoints : 0,
      couponId: hasCoupon ? form.inviteeCouponId : '',
    },
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  }
}

async function handleToggleStatus(row: any) {
  const id = String(row.id)
  if (statusBusyIds.has(id)) return
  const previousStatus = Number(row.status)
  const target = previousStatus === 1 ? 0 : 1
  statusBusyIds.add(id)
  try {
    await shareApi.updateCampaignStatus(id, target)
    row.status = target
    ElMessage.success(target === 1 ? '已启用' : '已停用')
  } catch (e: any) {
    row.status = previousStatus
    ElMessage.error(e?.message || '状态更新失败')
  } finally {
    statusBusyIds.delete(id)
  }
}

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    const data = buildPayload()
    if (editingId.value) {
      await shareApi.updateCampaign(editingId.value, data)
    } else {
      await shareApi.createCampaign(data)
    }

    ElMessage.success('保存成功')
    showCreateDialog.value = false
    editingId.value = ''
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存裂变活动失败')
  } finally {
    saving.value = false
  }
}

fetchList()
</script>

<style scoped>
.hint {
  margin-top: -4px;
  margin-bottom: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
