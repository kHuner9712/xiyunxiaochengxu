<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="供应商名称">
          <el-input v-model="searchForm.name" placeholder="请输入供应商名称" clearable />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="searchForm.contactPhone" placeholder="请输入联系电话" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button v-permission="'supplier:create'" type="primary" @click="handleAdd">新增供应商</el-button>
        <el-alert type="info" :closable="false" style="margin-top: 8px">供应商管理（仅内部管理，供应商不登录后台）</el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="供应商名称" min-width="150" />
        <el-table-column prop="contactName" label="联系人" width="100" />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column prop="email" label="联系邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="address" label="地址" show-overflow-tooltip min-width="200" />
        <el-table-column label="合作状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '合作中' : '已停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商品数" width="80">
          <template #default="{ row }">{{ row.productCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'supplier:edit'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-permission="'supplier:delete'"
              type="danger"
              link
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id))"
              @click="handleDelete(row)"
            >删除</el-button>
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

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入供应商名称" maxlength="100" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactName">
          <el-input v-model="form.contactName" placeholder="请输入联系人" maxlength="50" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" maxlength="20" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="联系邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入联系邮箱" maxlength="100" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入地址" maxlength="300" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="合作状态">
          <el-radio-group v-model="form.status" :disabled="submitting">
            <el-radio :value="1">合作中</el-radio>
            <el-radio :value="0">已停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="请输入备注" :disabled="submitting" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { supplierApi } from '@/api/supplier'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()
const deleteBusyIds = reactive(new Set<string>())
let listLoadSeq = 0

const searchForm = reactive({ name: '', contactPhone: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as string | undefined,
  clientRequestId: '',
  name: '',
  contactName: '',
  contactPhone: '',
  email: '',
  address: '',
  status: 1,
  remark: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
}

const dialogTitle = computed(() => (form.id ? '编辑供应商' : '新增供应商'))

function createSupplierRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

async function fetchList() {
  const requestSeq = ++listLoadSeq
  loading.value = true
  try {
    const res = await supplierApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    if (requestSeq !== listLoadSeq) return
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    if (requestSeq === listLoadSeq) ElMessage.error(e?.message || '加载供应商列表失败')
  } finally {
    if (requestSeq === listLoadSeq) loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.contactPhone = ''
  handleSearch()
}

function resetForm() {
  form.id = undefined
  form.clientRequestId = ''
  form.name = ''
  form.contactName = ''
  form.contactPhone = ''
  form.email = ''
  form.address = ''
  form.status = 1
  form.remark = ''
}

function handleAdd() {
  if (submitting.value) return
  resetForm()
  form.clientRequestId = createSupplierRequestId()
  dialogVisible.value = true
}

function handleEdit(row: any) {
  if (submitting.value) return
  form.id = String(row.id)
  form.clientRequestId = ''
  form.name = row.name || ''
  form.contactName = row.contactName || ''
  form.contactPhone = row.contactPhone || ''
  form.email = row.email || ''
  form.address = row.address || ''
  form.status = row.status === 0 ? 0 : 1
  form.remark = row.remark || ''
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  const id = String(row.id)
  if (deleteBusyIds.has(id)) return
  deleteBusyIds.add(id)
  try {
    await ElMessageBox.confirm('确定删除该供应商吗？', '提示', { type: 'warning' })
    await supplierApi.delete(id)
    ElMessage.success('删除成功')
    await fetchList()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '删除供应商失败')
  } finally {
    deleteBusyIds.delete(id)
  }
}

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      status: form.status,
      remark: form.remark.trim() || undefined,
      ...(!form.id ? { clientRequestId: form.clientRequestId } : {}),
    }
    if (form.id) {
      await supplierApi.update(form.id, payload)
    } else {
      if (!form.clientRequestId) throw new Error('供应商创建请求标识缺失，请重新打开新增窗口')
      await supplierApi.create(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存供应商失败')
  } finally {
    submitting.value = false
  }
}

fetchList()
</script>
