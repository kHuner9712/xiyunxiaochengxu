<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>推荐位管理</span>
          <el-button v-permission="'marketing:recommendation'" type="primary" @click="handleAdd">新增推荐位</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="推荐位名称" min-width="150" />
        <el-table-column prop="code" label="推荐位编码" width="150" />
        <el-table-column label="推荐类型" width="100">
          <template #default="{ row }">{{ RECOMMENDATION_TYPE_MAP[row.type] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:recommendation'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'marketing:recommendation'" type="primary" link @click="handleManageItems(row)">管理推荐项</el-button>
            <el-button v-permission="'marketing:recommendation'" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="推荐位名称" prop="name">
          <el-input v-model="form.name" placeholder="如：首页精选" />
        </el-form-item>
        <el-form-item label="推荐位编码" prop="code">
          <el-input v-model="form.code" placeholder="如：home_featured" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="推荐类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择">
            <el-option label="商品" :value="1" />
            <el-option label="活动" :value="2" />
            <el-option label="内容" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialogVisible" title="管理推荐项" width="700px" destroy-on-close>
      <div style="margin-bottom: 12px">
        <el-button type="primary" size="small" @click="addItemVisible = true">添加推荐项</el-button>
      </div>
      <el-table :data="items" stripe size="small">
        <el-table-column prop="targetName" label="名称" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="操作" width="100">
          <template #default="{ $index }">
            <el-button type="danger" link @click="items.splice($index, 1)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveItems">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import request from '@/utils/request'
import { asArray } from '@/utils/response'

const RECOMMENDATION_TYPE_MAP: Record<number, string> = { 1: '商品', 2: '活动', 3: '内容' }
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const itemDialogVisible = ref(false)
const addItemVisible = ref(false)
const tableData = ref<any[]>([])
const items = ref<any[]>([])
const formRef = ref<FormInstance>()
const currentId = ref<number>(0)

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  code: '',
  type: 1,
  sort: 0,
  status: 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入推荐位名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入推荐位编码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择推荐类型', trigger: 'change' }],
}

const dialogTitle = computed(() => (form.id ? '编辑推荐位' : '新增推荐位'))

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get('/admin/recommendation/list', { params: { page: 1, pageSize: 100 } })
    tableData.value = asArray(res.data)
  } catch {} finally {
    loading.value = false
  }
}

function handleAdd() {
  form.id = undefined
  form.name = ''
  form.code = ''
  form.type = 1
  form.sort = 0
  form.status = 1
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.code = row.code
  form.type = row.type
  form.sort = row.sort
  form.status = row.status
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该推荐位吗？', '提示', { type: 'warning' })
    await request.delete(`/admin/recommendation/delete/${row.id}`)
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
      await request.put(`/admin/recommendation/update/${form.id}`, form)
    } else {
      await request.post('/admin/recommendation/create', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch {} finally {
    submitting.value = false
  }
}

async function handleManageItems(row: any) {
  currentId.value = row.id
  try {
    const res = await request.get(`/admin/recommendation/items/${row.id}`)
    items.value = asArray(res.data)
  } catch {}
  itemDialogVisible.value = true
}

async function handleSaveItems() {
  try {
    await request.put(`/admin/recommendation/items/${currentId.value}`, { items: items.value })
    ElMessage.success('保存成功')
    itemDialogVisible.value = false
  } catch {}
}

fetchList()
</script>
