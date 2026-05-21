<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>会员等级配置</span>
          <el-button v-permission="'user:member'" type="primary" @click="handleAdd">新增等级</el-button>
        </div>
      </template>

      <el-table :data="levelList" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="等级名称" width="150" />
        <el-table-column prop="level" label="等级" width="80" />
        <el-table-column label="升级条件(消费金额)" width="150">
          <template #default="{ row }">¥{{ formatPrice(row.minSpent) }}</template>
        </el-table-column>
        <el-table-column label="折扣" width="80">
          <template #default="{ row }">{{ row.discount ? (row.discount * 100).toFixed(0) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="pointsRate" label="积分倍率" width="100">
          <template #default="{ row }">{{ row.pointsRate || 1 }}x</template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'user:member'" type="primary" link @click="handleEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="form.name" placeholder="如：银卡会员" />
        </el-form-item>
        <el-form-item label="等级" prop="level">
          <el-input-number v-model="form.level" :min="1" />
        </el-form-item>
        <el-form-item label="升级消费金额(元)" prop="minSpent">
          <el-input-number v-model="form.minSpent" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="折扣(0-1)">
          <el-input-number v-model="form.discount" :min="0" :max="1" :precision="2" :step="0.05" />
        </el-form-item>
        <el-form-item label="积分倍率">
          <el-input-number v-model="form.pointsRate" :min="1" :precision="1" :step="0.5" />
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { memberApi } from '@/api/member'
import { formatPrice, priceToFen } from '@/utils/format'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const levelList = ref<any[]>([])
const formRef = ref<FormInstance>()

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  level: 1,
  minSpent: 0,
  discount: 1,
  pointsRate: 1,
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入等级名称', trigger: 'blur' }],
  level: [{ required: true, message: '请输入等级', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑等级' : '新增等级'))

async function fetchList() {
  loading.value = true
  try {
    const res = await memberApi.getList()
    levelList.value = res.data || []
  } catch {} finally {
    loading.value = false
  }
}

function handleAdd() {
  form.id = undefined
  form.name = ''
  form.level = 1
  form.minSpent = 0
  form.discount = 1
  form.pointsRate = 1
  form.description = ''
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.level = row.level
  form.minSpent = row.minSpent / 100
  form.discount = row.discount || 1
  form.pointsRate = row.pointsRate || 1
  form.description = row.description || ''
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data = { ...form, minSpent: priceToFen(form.minSpent) }
    if (form.id) {
      await memberApi.update(data)
    } else {
      await memberApi.create(data)
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
