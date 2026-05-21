<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>积分规则配置</span>
          <el-button v-permission="'user:points'" type="primary" @click="handleAdd">新增规则</el-button>
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
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'user:points'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'user:points'" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="如：签到积分" />
        </el-form-item>
        <el-form-item label="规则编码" prop="code">
          <el-input v-model="form.code" placeholder="如：sign_in" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="积分值" prop="points">
          <el-input-number v-model="form.points" :min="0" />
        </el-form-item>
        <el-form-item label="每日上限">
          <el-input-number v-model="form.dailyLimit" :min="0" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">0表示无限制</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
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
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { pointsApi } from '@/api/points'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const ruleList = ref<any[]>([])
const formRef = ref<FormInstance>()

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  code: '',
  points: 0,
  dailyLimit: 0,
  status: 1,
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
  points: [{ required: true, message: '请输入积分值', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑规则' : '新增规则'))

async function fetchList() {
  loading.value = true
  try {
    const res = await pointsApi.getList()
    ruleList.value = res.data || []
  } catch {} finally {
    loading.value = false
  }
}

function handleAdd() {
  form.id = undefined
  form.name = ''
  form.code = ''
  form.points = 0
  form.dailyLimit = 0
  form.status = 1
  form.description = ''
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.code = row.code
  form.points = row.points
  form.dailyLimit = row.dailyLimit
  form.status = row.status
  form.description = row.description || ''
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该规则吗？', '提示', { type: 'warning' })
    await pointsApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (form.id) {
      await pointsApi.update({ ...form })
    } else {
      await pointsApi.create({ ...form })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch {} finally {
    submitting.value = false
  }
}

fetchList()
</script>
