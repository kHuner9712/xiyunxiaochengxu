<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>自提点管理</span>
          <el-button type="primary" @click="handleAdd">新增自提点</el-button>
        </div>
      </template>

      <el-form :inline="true" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchKeyword" placeholder="门店名称" clearable @clear="loadList" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchStatus" placeholder="全部" clearable @change="loadList">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="门店名称" min-width="150" />
        <el-table-column prop="fullAddress" label="地址" min-width="200" />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column prop="businessHours" label="营业时间" width="150" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadList"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="showDialog" :title="isEdit ? '编辑自提点' : '新增自提点'" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="门店名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入门店名称" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="省份" prop="province">
          <el-input v-model="form.province" placeholder="省" />
        </el-form-item>
        <el-form-item label="城市" prop="city">
          <el-input v-model="form.city" placeholder="市" />
        </el-form-item>
        <el-form-item label="区/县" prop="district">
          <el-input v-model="form.district" placeholder="区/县" />
        </el-form-item>
        <el-form-item label="详细地址" prop="address">
          <el-input v-model="form.address" placeholder="详细地址" />
        </el-form-item>
        <el-form-item label="营业时间">
          <el-input v-model="form.businessHours" placeholder="如：周一至周五 9:00-18:00" />
        </el-form-item>
        <el-form-item label="自提须知">
          <el-input v-model="form.pickupNotice" type="textarea" :rows="2" placeholder="自提注意事项" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="2">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { pickupStoreApi } from '@/api/pickup-store'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const searchKeyword = ref('')
const searchStatus = ref<number | undefined>(undefined)
const showDialog = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  businessHours: '',
  pickupNotice: '',
  sortOrder: 0,
  status: 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入门店名称', trigger: 'blur' }],
  province: [{ required: true, message: '请输入省份', trigger: 'blur' }],
  city: [{ required: true, message: '请输入城市', trigger: 'blur' }],
  district: [{ required: true, message: '请输入区/县', trigger: 'blur' }],
  address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
}

async function loadList() {
  loading.value = true
  try {
    const res = await pickupStoreApi.getList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      status: searchStatus.value,
    })
    const data = res.data || res
    tableData.value = data.list || []
    total.value = data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleAdd() {
  isEdit.value = false
  Object.assign(form, { id: undefined, name: '', contactPhone: '', province: '', city: '', district: '', address: '', businessHours: '', pickupNotice: '', sortOrder: 0, status: 1 })
  showDialog.value = true
}

function handleEdit(row: any) {
  isEdit.value = true
  Object.assign(form, row)
  showDialog.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (isEdit.value && form.id) {
      await pickupStoreApi.update(form.id, form)
    } else {
      await pickupStoreApi.create(form)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadList()
  } catch {} finally {
    submitting.value = false
  }
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 1 ? 2 : 1
  const action = newStatus === 1 ? '启用' : '停用'
  await ElMessageBox.confirm(`确定${action}该自提点吗？`, '提示')
  try {
    await pickupStoreApi.updateStatus(row.id, newStatus)
    ElMessage.success(`${action}成功`)
    loadList()
  } catch {}
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确定删除该自提点吗？删除后不可恢复。', '提示')
  try {
    await pickupStoreApi.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {}
}

onMounted(() => loadList())
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-form {
  margin-bottom: 16px;
}
</style>
