<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="header-row">
          <span>会员等级配置</span>
          <el-button v-permission="'user:member'" type="primary" @click="handleAdd">新增等级</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        title="成长值区间必须从 0 开始、连续且不重叠；最后一级必须无上限。保存后系统会按新规则重新匹配用户等级。"
        style="margin-bottom: 16px"
      />

      <el-table :data="levelList" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="name" label="等级名称" width="140" />
        <el-table-column prop="level" label="序号" width="70" />
        <el-table-column label="成长值区间" width="190">
          <template #default="{ row }">
            {{ row.minGrowthValue }} - {{ row.maxGrowthValue === null ? '无上限' : row.maxGrowthValue }}
          </template>
        </el-table-column>
        <el-table-column label="会员价比例" width="110">
          <template #default="{ row }">{{ row.discountRate ? `${row.discountRate}%` : '无折扣' }}</template>
        </el-table-column>
        <el-table-column label="积分倍率" width="100">
          <template #default="{ row }">{{ (Number(row.pointsRate || 10) / 10).toFixed(1) }}x</template>
        </el-table-column>
        <el-table-column prop="description" label="权益摘要" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'user:member'" type="primary" link @click="handleEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="150px">
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="form.name" maxlength="20" />
        </el-form-item>
        <el-form-item label="最低成长值" prop="minGrowthValue">
          <el-input-number v-model="form.minGrowthValue" :min="0" :step="100" />
        </el-form-item>
        <el-form-item label="最高成长值">
          <el-input-number v-model="form.maxGrowthValue" :min="form.minGrowthValue" :step="100" clearable />
          <span class="hint">最后一级留空表示无上限</span>
        </el-form-item>
        <el-form-item label="会员价比例(%)">
          <el-input-number v-model="form.discountRate" :min="1" :max="100" :step="1" clearable />
          <span class="hint">98 表示按原价 98% 结算；留空表示不设置会员折扣</span>
        </el-form-item>
        <el-form-item label="积分倍率(x)">
          <el-input-number v-model="form.pointsMultiplier" :min="0.1" :precision="1" :step="0.5" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="权益JSON">
          <el-input
            v-model="form.benefits"
            type="textarea"
            :rows="8"
            placeholder='可留空使用默认权益；自定义格式示例：[ { "name": "会员价", "icon": "/static/tab/cart.png", "description": "会员专享" } ]'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { memberApi, type MemberLevelPayload } from '@/api/member'
import { asArray } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const levelList = ref<any[]>([])
const formRef = ref<FormInstance>()

const form = reactive({
  id: '' as string,
  name: '',
  minGrowthValue: 0,
  maxGrowthValue: null as number | null,
  discountRate: null as number | null,
  pointsMultiplier: 1,
  sortOrder: 0,
  status: 1 as 0 | 1,
  benefits: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入等级名称', trigger: 'blur' }],
  minGrowthValue: [{ required: true, message: '请输入最低成长值', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑等级' : '新增等级'))

async function fetchList() {
  loading.value = true
  try {
    const res = await memberApi.getList()
    levelList.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取会员等级失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    id: '',
    name: '',
    minGrowthValue: 0,
    maxGrowthValue: null,
    discountRate: null,
    pointsMultiplier: 1,
    sortOrder: 0,
    status: 1,
    benefits: '',
  })
}

function handleAdd() {
  resetForm()
  dialogVisible.value = true
}

function handleEdit(row: any) {
  Object.assign(form, {
    id: String(row.id),
    name: row.name || '',
    minGrowthValue: Number(row.minGrowthValue || 0),
    maxGrowthValue: row.maxGrowthValue === null || row.maxGrowthValue === undefined ? null : Number(row.maxGrowthValue),
    discountRate: row.discountRate === null || row.discountRate === undefined ? null : Number(row.discountRate),
    pointsMultiplier: Number(row.pointsRate || 10) / 10,
    sortOrder: Number(row.sortOrder || 0),
    status: row.status === 0 ? 0 : 1,
    benefits: row.benefits || '',
  })
  dialogVisible.value = true
}

function buildPayload(): MemberLevelPayload {
  if (!Number.isInteger(form.minGrowthValue) || form.minGrowthValue < 0) throw new Error('最低成长值无效')
  if (form.maxGrowthValue !== null && (!Number.isInteger(form.maxGrowthValue) || form.maxGrowthValue < form.minGrowthValue)) {
    throw new Error('最高成长值不能低于最低成长值')
  }
  const pointsRate = Math.round(form.pointsMultiplier * 10)
  if (!Number.isSafeInteger(pointsRate) || pointsRate < 1) throw new Error('积分倍率无效')
  if (form.benefits.trim()) {
    let parsed: unknown
    try { parsed = JSON.parse(form.benefits) } catch { throw new Error('权益JSON格式无效') }
    if (!Array.isArray(parsed)) throw new Error('权益JSON必须是数组')
  }
  return {
    name: form.name.trim(),
    minGrowthValue: form.minGrowthValue,
    maxGrowthValue: form.maxGrowthValue,
    discountRate: form.discountRate,
    pointsRate,
    sortOrder: form.sortOrder,
    status: form.status,
    benefits: form.benefits.trim() || undefined,
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  let payload: MemberLevelPayload
  try {
    payload = buildPayload()
  } catch (e: any) {
    ElMessage.warning(e?.message || '请检查等级配置')
    return
  }

  submitting.value = true
  try {
    if (form.id) await memberApi.update(form.id, payload)
    else await memberApi.create(payload)
    ElMessage.success('保存成功，用户等级已按新规则重新匹配')
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

fetchList()
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
