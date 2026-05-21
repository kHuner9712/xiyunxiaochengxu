<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="请输入用户名" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button v-permission="'system:admin'" type="primary" @click="handleAdd">新增管理员</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="角色" min-width="150">
          <template #default="{ row }">
            <el-tag v-for="role in row.roles" :key="role.id" size="small" style="margin-right: 4px">{{ role.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
          <template #default="{ row }">{{ formatDate(row.lastLoginTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'system:admin'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'system:admin'" type="warning" link @click="handleResetPassword(row)">重置密码</el-button>
            <el-button v-permission="'system:admin'" :type="row.status === 1 ? 'danger' : 'success'" link @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button v-permission="'system:admin'" type="danger" link @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item v-if="!form.id" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="form.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-select v-model="form.roleIds" multiple placeholder="请选择角色">
            <el-option v-for="role in roleList" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
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
import { adminApi } from '@/api/admin'
import { roleApi } from '@/api/role'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const roleList = ref<any[]>([])
const formRef = ref<FormInstance>()

const searchForm = reactive({ username: '', status: undefined as number | undefined })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as number | undefined,
  username: '',
  password: '',
  realName: '',
  phone: '',
  roleIds: [] as number[],
  status: 1,
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  roleIds: [{ required: true, message: '请选择角色', trigger: 'change', type: 'array' }],
}

const dialogTitle = computed(() => (form.id ? '编辑管理员' : '新增管理员'))

async function fetchList() {
  loading.value = true
  try {
    const res = await adminApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

async function fetchRoleList() {
  try {
    const res = await roleApi.getList({ page: 1, pageSize: 1000 })
    roleList.value = (res.data as any)?.list || res.data || []
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.username = ''
  searchForm.status = undefined
  handleSearch()
}

function handleAdd() {
  form.id = undefined
  form.username = ''
  form.password = ''
  form.realName = ''
  form.phone = ''
  form.roleIds = []
  form.status = 1
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.username = row.username
  form.password = ''
  form.realName = row.realName
  form.phone = row.phone || ''
  form.roleIds = row.roles?.map((r: any) => r.id) || []
  form.status = row.status
  dialogVisible.value = true
}

async function handleResetPassword(_row: any) {
  ElMessage.info('请联系超级管理员重置密码')
}

async function handleToggleStatus(row: any) {
  try {
    await adminApi.updateStatus(row.id, row.status === 1 ? 0 : 1)
    ElMessage.success('操作成功')
    fetchList()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该管理员吗？', '提示', { type: 'warning' })
    await adminApi.delete(row.id)
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
      await adminApi.update({ ...form })
    } else {
      await adminApi.create({ ...form })
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
  fetchRoleList()
})
</script>
