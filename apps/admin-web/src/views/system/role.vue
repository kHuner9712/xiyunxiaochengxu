<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="角色名称">
          <el-input v-model="searchForm.name" placeholder="请输入角色名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button v-permission="'system:role'" type="primary" @click="handleAdd">新增角色</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="角色名称" width="150" />
        <el-table-column prop="code" label="角色编码" width="150" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="权限数" width="80">
          <template #default="{ row }">{{ row.permissions?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'system:role'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'system:role'" type="danger" link :disabled="row.code === 'super_admin'" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="form.code" placeholder="如：admin, editor" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="权限配置" prop="permissions">
          <el-tree
            ref="permTreeRef"
            :data="permissionTree"
            :props="{ label: 'name', children: 'children' }"
            show-checkbox
            node-key="code"
            :default-checked-keys="form.permissions"
            check-strictly
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { roleApi } from '@/api/role'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const permissionTree = ref<any[]>([])
const formRef = ref<FormInstance>()
const permTreeRef = ref<any>()

const searchForm = reactive({ name: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  code: '',
  description: '',
  permissions: [] as string[],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑角色' : '新增角色'))

async function fetchList() {
  loading.value = true
  try {
    const res = await roleApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch {} finally {
    loading.value = false
  }
}

async function fetchPermissions() {
  try {
    const res = await roleApi.getPermissions()
    permissionTree.value = asArray(res.data)
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  handleSearch()
}

function handleAdd() {
  form.id = undefined
  form.name = ''
  form.code = ''
  form.description = ''
  form.permissions = []
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.code = row.code
  form.description = row.description || ''
  form.permissions = row.permissions || []
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  if (row.code === 'super_admin') {
    ElMessage.warning('超级管理员角色不可删除')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该角色吗？', '提示', { type: 'warning' })
    await roleApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const checkedKeys = permTreeRef.value?.getCheckedKeys() || []

  submitting.value = true
  try {
    const data = { ...form, permissions: checkedKeys }
    if (form.id) {
      await roleApi.update(data)
    } else {
      await roleApi.create(data)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchPermissions()
})
</script>
