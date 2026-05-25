<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>裂变活动</span>
          <el-button type="primary" @click="showCreateDialog = true">创建活动</el-button>
        </div>
      </template>

      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="活动名称" />
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
            <div style="font-size: 12px">{{ row.startTime?.replace('T', ' ').substring(0, 16) }}</div>
            <div style="font-size: 12px">至 {{ row.endTime?.replace('T', ' ').substring(0, 16) }}</div>
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
            <el-button link :type="row.status === 1 ? 'danger' : 'success'" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
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
        <el-form-item label="活动名称">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
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
              <el-input v-model.number="form.inviterPoints" placeholder="积分数量" style="margin-bottom: 8px" />
            </div>
            <div v-if="form.rewardType === 'coupon' || form.rewardType === 'both'">
              <el-input v-model="form.inviterCouponId" placeholder="优惠券ID" style="margin-bottom: 8px" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="被邀请人奖励">
          <div style="width: 100%">
            <div v-if="form.rewardType === 'points' || form.rewardType === 'both'">
              <el-input v-model.number="form.inviteePoints" placeholder="积分数量" style="margin-bottom: 8px" />
            </div>
            <div v-if="form.rewardType === 'coupon' || form.rewardType === 'both'">
              <el-input v-model="form.inviteeCouponId" placeholder="优惠券ID" style="margin-bottom: 8px" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="form.startTime" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="form.endTime" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { shareApi } from '@/api/share'

const loading = ref(false)
const saving = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const showCreateDialog = ref(false)
const editingId = ref('')

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
  inviterPoints: 0,
  inviterCouponId: '',
  inviteePoints: 0,
  inviteeCouponId: '',
  startTime: '',
  endTime: '',
})

async function fetchList() {
  loading.value = true
  try {
    const res = await shareApi.getCampaignList({ page: page.value, pageSize: 10 })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    type: row.type,
    rewardType: row.rewardType,
    inviterPoints: row.inviterRewardConfig?.points || 0,
    inviterCouponId: row.inviterRewardConfig?.couponId || '',
    inviteePoints: row.inviteeRewardConfig?.points || 0,
    inviteeCouponId: row.inviteeRewardConfig?.couponId || '',
    startTime: row.startTime,
    endTime: row.endTime,
  })
  showCreateDialog.value = true
}

async function handleToggleStatus(row: any) {
  try {
    await shareApi.updateCampaignStatus(row.id, row.status === 1 ? 0 : 1)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

async function handleSave() {
  saving.value = true
  try {
    const data: any = {
      name: form.name,
      type: form.type,
      rewardType: form.rewardType,
      inviterRewardConfig: {},
      inviteeRewardConfig: {},
      startTime: form.startTime,
      endTime: form.endTime,
    }

    if (form.rewardType === 'points' || form.rewardType === 'both') {
      data.inviterRewardConfig.points = form.inviterPoints
      data.inviteeRewardConfig.points = form.inviteePoints
    }
    if (form.rewardType === 'coupon' || form.rewardType === 'both') {
      data.inviterRewardConfig.couponId = form.inviterCouponId
      data.inviteeRewardConfig.couponId = form.inviteeCouponId
    }

    if (editingId.value) {
      await shareApi.updateCampaign(editingId.value, data)
    } else {
      await shareApi.createCampaign(data)
    }

    ElMessage.success('保存成功')
    showCreateDialog.value = false
    editingId.value = ''
    fetchList()
  } catch {} finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchList()
})
</script>
