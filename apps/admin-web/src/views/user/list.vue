<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="昵称">
          <el-input v-model="searchForm.nickname" placeholder="请输入昵称" clearable />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入手机号" clearable />
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="searchForm.memberLevel" placeholder="请选择" clearable>
            <el-option v-for="lv in memberLevels" :key="lv.id" :label="lv.name" :value="lv.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :src="row.avatar" :size="40">{{ displayName(row).charAt(0) }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="昵称" width="120">
          <template #default="{ row }">{{ displayName(row) }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="微信OpenID" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ displayWechatIdentifier(row.openidMasked, row.openid) }}</template>
        </el-table-column>
        <el-table-column label="微信UnionID" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ displayWechatIdentifier(row.unionIdMasked, row.unionId) }}</template>
        </el-table-column>
        <el-table-column label="会员等级" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.memberLevelName || '普通用户' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="80" />
        <el-table-column label="余额" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.balance) }}</template>
        </el-table-column>
        <el-table-column label="订单数" width="80">
          <template #default="{ row }">{{ row.orderCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="消费金额" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.totalSpent) }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
          <template #default="{ row }">{{ formatDate(row.lastLoginAt || row.lastLoginTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDetail(row)">查看</el-button>
            <el-button v-permission="'user:detail'" type="warning" link @click="handleAdjustPoints(row)">调整积分</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <el-dialog v-model="pointsVisible" title="调整积分" width="400px" destroy-on-close>
      <el-form ref="pointsFormRef" :model="pointsForm" :rules="pointsRules" label-width="100px">
        <el-form-item label="用户">{{ pointsForm.nickname }}</el-form-item>
        <el-form-item label="当前积分">{{ pointsForm.currentPoints }}</el-form-item>
        <el-form-item label="调整积分" prop="points">
          <el-input-number v-model="pointsForm.points" :step="1" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">正数增加，负数减少</span>
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="pointsForm.reason" type="textarea" :rows="2" placeholder="请输入调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointsVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handlePointsSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { userApi } from '@/api/user'
import { memberApi } from '@/api/member'
import { formatPrice, formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const pointsVisible = ref(false)
const tableData = ref<any[]>([])
const memberLevels = ref<any[]>([])
const pointsFormRef = ref<FormInstance>()

const searchForm = reactive({
  nickname: '',
  phone: '',
  memberLevel: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const pointsForm = reactive({
  userId: undefined as number | undefined,
  nickname: '',
  currentPoints: 0,
  points: 0,
  reason: '',
})

const pointsRules: FormRules = {
  points: [{ required: true, message: '请输入调整积分', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
}

function displayName(row: any) {
  return row.nickname || '微信用户'
}

function maskIdentifier(value?: string) {
  if (!value) return ''
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`
  return `${value.slice(0, 4)}****${value.slice(-4)}`
}

function displayWechatIdentifier(masked?: string, raw?: string) {
  return masked || maskIdentifier(raw) || '-'
}

async function fetchList() {
  loading.value = true
  try {
    const res = await userApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch {} finally {
    loading.value = false
  }
}

async function fetchMemberLevels() {
  try {
    const res = await memberApi.getList()
    memberLevels.value = asArray(res.data)
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.nickname = ''
  searchForm.phone = ''
  searchForm.memberLevel = undefined
  handleSearch()
}

function handleDetail(row: any) {
  router.push(`/user/detail/${row.id}`)
}

function handleAdjustPoints(row: any) {
  pointsForm.userId = row.id
  pointsForm.nickname = row.nickname
  pointsForm.currentPoints = row.points
  pointsForm.points = 0
  pointsForm.reason = ''
  pointsVisible.value = true
}

async function handlePointsSubmit() {
  const valid = await pointsFormRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await userApi.adjustPoints(pointsForm.userId!, pointsForm.points, pointsForm.reason)
    ElMessage.success('调整成功')
    pointsVisible.value = false
    fetchList()
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchMemberLevels()
})
</script>
