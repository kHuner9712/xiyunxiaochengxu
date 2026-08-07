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

      <el-table :data="displayRows" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="name" label="角色名称" width="150" />
        <el-table-column prop="code" label="角色编码" width="150" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="权限数" width="80">
          <template #default="{ row }">{{ row.adminRolePermissions?.length || 0 }}</template>
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
          :total="filteredRows.length"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入角色名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="form.code" placeholder="如：admin_editor" :disabled="!!form.id" maxlength="50" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" />
        </el-form-item>
        <el-form-item label="权限配置" prop="permissionIds">
          <el-tree
            ref="permTreeRef"
            :data="permissionTree"
            :props="{ label: 'name', children: 'children' }"
            show-checkbox
            node-key="id"
            :default-checked-keys="form.permissionIds"
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
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { roleApi, type RolePayload } from '@/api/role'
import { asArray } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const permissionTree = ref<any[]>([])
const formRef = ref<FormInstance>()
const permTreeRef = ref<any>()

const searchForm = reactive({ name: '' })
const pagination = reactive({ page: 1, pageSize: 10 })
const form = reactive({
  id: '',
  name: '',
  code: '',
  description: '',
  permissionIds: [] as string[],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]{1,49}$/, message: '只能使用小写字母、数字和下划线', trigger: 'blur' },
  ],
  permissionIds: [{ required: true, message: '请至少选择一个权限', trigger: 'change', type: 'array' }],
}

const dialogTitle = computed(() => (form.id ? '编辑角色' : '新增角色'))
const filteredRows = computed(() => {
  const keyword = searchForm.name.trim().toLowerCase()
  if (!keyword) return tableData.value
  return tableData.value.filter(row => String(row.name || '').toLowerCase().includes(keyword))
})
const displayRows = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return filteredRows.value.slice(start, start + pagination.pageSize)
})

async function fetchList() {
  loading.value = true
  try {
    const res = await roleApi.getList()
    tableData.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取角色列表失败')
  } finally {
    loading.value = false
  }
}

async function fetchPermissions() {
  try {
    const res = await roleApi.getPermissions()
    permissionTree.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取权限树失败')
  }
}

function handleSearch() {
  pagination.page = 1
}

function resetSearch() {
  searchForm.name = ''
  pagination.page = 1
}

function handleAdd() {
  Object.assign(form, { id: '', name: '', code: '', description: '', permissionIds: [] })
  dialogVisible.value = true
  nextTick(() => permTreeRef.value?.setCheckedKeys([]))
}

function handleEdit(row: any) {
  const permissionIds = Array.isArray(row.adminRolePermissions)
    ? row.adminRolePermissions.map((item: any) => String(item.permissionId))
    : []
  Object.assign(form, {
    id: String(row.id),
    name: row.name || '',
    code: row.code || '',
    description: row.description || '',
    permissionIds,
  })
  dialogVisible.value = true
  nextTick(() => permTreeRef.value?.setCheckedKeys(permissionIds))
}

async function handleDelete(row: any) {
  if (row.code === 'super_admin') {
    ElMessage.warning('超级管理员角色不可删除')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该角色吗？绑定该角色的管理员将立即失去对应权限。', '提示', { type: 'warning' })
    await roleApi.delete(String(row.id))
    ElMessage.success('删除成功')
    await fetchList()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '删除失败')
  }
}

async function handleSubmit() {
  const checkedKeys = (permTreeRef.value?.getCheckedKeys() || []).map(String)
  form.permissionIds = checkedKeys
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: RolePayload = {
    name: form.name.trim(),
    description: form.description.trim(),
    permissionIds: checkedKeys,
  }
  if (!form.id) payload.code = form.code.trim()

  submitting.value = true
  try {
    if (form.id) await roleApi.update(form.id, payload)
    else await roleApi.create(payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchPermissions()
})
</script>
