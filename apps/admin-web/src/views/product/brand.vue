<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="品牌名称">
          <el-input v-model="searchForm.keyword" placeholder="请输入品牌名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button v-permission="'product:brand'" type="primary" @click="handleAdd">新增品牌</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="品牌Logo" width="100">
          <template #default="{ row }">
            <el-image v-if="row.logo" :src="row.logo" style="width: 50px; height: 50px" fit="cover" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="品牌名称" min-width="150" />
        <el-table-column prop="description" label="品牌描述" show-overflow-tooltip min-width="200" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'product:brand'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'product:brand'" type="danger" link @click="handleDelete(row)">删除</el-button>
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
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入品牌名称" />
        </el-form-item>
        <el-form-item label="品牌Logo">
          <el-upload action="" :http-request="handleUploadLogo" :show-file-list="false" accept="image/*">
            <el-image v-if="form.logo" :src="form.logo" style="width: 80px; height: 80px" fit="cover" />
            <el-button v-else size="small">上传Logo</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
        <el-form-item label="品牌描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入品牌描述" />
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
import { brandApi } from '@/api/brand'
import { uploadApi } from '@/api/upload'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  logo: '',
  sort: 0,
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入品牌名称', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑品牌' : '新增品牌'))

async function fetchList() {
  loading.value = true
  try {
    const res = await brandApi.getList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.keyword = ''
  handleSearch()
}

function handleAdd() {
  form.id = undefined
  form.name = ''
  form.logo = ''
  form.sort = 0
  form.description = ''
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.logo = row.logo || ''
  form.sort = row.sort
  form.description = row.description || ''
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该品牌吗？', '提示', { type: 'warning' })
    await brandApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

async function handleUploadLogo(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.logo = res.data.url
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (form.id) {
      await brandApi.update({ ...form })
    } else {
      await brandApi.create({ ...form })
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
