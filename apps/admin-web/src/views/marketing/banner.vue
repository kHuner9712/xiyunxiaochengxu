<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>Banner管理</span>
          <el-button v-permission="'marketing:banner'" type="primary" @click="handleAdd">新增Banner</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="图片" width="160">
          <template #default="{ row }">
            <el-image :src="row.image" style="width: 120px; height: 60px" fit="cover" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column label="位置" width="100">
          <template #default="{ row }">{{ BANNER_POSITION_MAP[row.position] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="linkUrl" label="跳转链接" show-overflow-tooltip min-width="200" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:banner'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'marketing:banner'" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入Banner标题" />
        </el-form-item>
        <el-form-item label="图片" prop="image">
          <el-upload action="" :http-request="handleUploadImage" :show-file-list="false" accept="image/*">
            <el-image v-if="form.image" :src="form.image" style="width: 300px; height: 150px" fit="cover" />
            <el-button v-else size="small">上传图片</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="位置" prop="position">
          <el-select v-model="form.position" placeholder="请选择位置">
            <el-option label="首页" :value="1" />
            <el-option label="分类页" :value="2" />
            <el-option label="活动页" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="跳转链接" prop="linkUrl">
          <el-input v-model="form.linkUrl" placeholder="请输入跳转链接" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { bannerApi } from '@/api/banner'
import { uploadApi } from '@/api/upload'
import { asArray } from '@/utils/response'

const BANNER_POSITION_MAP: Record<number, string> = { 1: '首页', 2: '分类页', 3: '活动页' }
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()

const form = reactive({
  id: undefined as number | undefined,
  title: '',
  image: '',
  position: 1,
  linkUrl: '',
  sort: 0,
  status: 1,
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  image: [{ required: true, message: '请上传图片', trigger: 'change' }],
  position: [{ required: true, message: '请选择位置', trigger: 'change' }],
}

const dialogTitle = computed(() => (form.id ? '编辑Banner' : '新增Banner'))

async function fetchList() {
  loading.value = true
  try {
    const res = await bannerApi.getList({ page: 1, pageSize: 100 })
    tableData.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取Banner列表失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  form.id = undefined
  form.title = ''
  form.image = ''
  form.position = 1
  form.linkUrl = ''
  form.sort = 0
  form.status = 1
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.title = row.title
  form.image = row.image
  form.position = row.position
  form.linkUrl = row.linkUrl || ''
  form.sort = row.sort
  form.status = row.status
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该Banner吗？', '提示', { type: 'warning' })
    await bannerApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch {}
}

async function handleUploadImage(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.image = res.data.url
  } catch (e: any) {
    ElMessage.error(e?.message || '图片上传失败')
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (form.id) {
      await bannerApi.update({ ...form })
    } else {
      await bannerApi.create({ ...form })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

fetchList()
</script>
