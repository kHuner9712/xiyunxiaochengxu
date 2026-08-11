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
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column label="图片" width="160">
          <template #default="{ row }"><el-image :src="row.image" style="width: 120px; height: 60px" fit="cover" /></template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column label="跳转类型" width="110">
          <template #default="{ row }">{{ BANNER_LINK_TYPE_MAP[row.linkType ?? 0] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="linkValue" label="跳转目标" show-overflow-tooltip min-width="200" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="标题" prop="title"><el-input v-model="form.title" maxlength="100" /></el-form-item>
        <el-form-item label="图片" prop="image">
          <el-upload action="" :http-request="handleUploadImage" :show-file-list="false" accept="image/*">
            <el-image v-if="form.image" :src="form.image" style="width: 300px; height: 150px" fit="cover" />
            <el-button v-else size="small">上传图片</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="跳转类型" prop="linkType">
          <el-select v-model="form.linkType" style="width: 100%">
            <el-option label="不跳转" :value="0" />
            <el-option label="商品详情" :value="1" />
            <el-option label="活动详情" :value="2" />
            <el-option label="小程序页面" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.linkType !== 0" label="跳转目标" prop="linkValue">
          <el-input v-model="form.linkValue" :placeholder="linkPlaceholder" maxlength="200" />
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status"><el-radio :value="1">启用</el-radio><el-radio :value="0">禁用</el-radio></el-radio-group>
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
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { bannerApi, type BannerPayload } from '@/api/banner'
import { uploadApi } from '@/api/upload'
import { asArray } from '@/utils/response'

const BANNER_LINK_TYPE_MAP: Record<number, string> = { 0: '不跳转', 1: '商品详情', 2: '活动详情', 3: '小程序页面' }
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()
const form = reactive({ id: '', title: '', image: '', linkType: 0 as 0 | 1 | 2 | 3, linkValue: '', sortOrder: 0, status: 1 as 0 | 1 })

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  image: [{ required: true, message: '请上传图片', trigger: 'change' }],
  linkType: [{ required: true, message: '请选择跳转类型', trigger: 'change' }],
}
const dialogTitle = computed(() => (form.id ? '编辑Banner' : '新增Banner'))
const linkPlaceholder = computed(() => form.linkType === 1 ? '商品ID' : form.linkType === 2 ? '活动ID' : '/pages/xxx/index')

async function fetchList() {
  loading.value = true
  try { const res = await bannerApi.getList(); tableData.value = asArray(res.data) }
  catch (e: any) { ElMessage.error(e?.message || '获取Banner列表失败') }
  finally { loading.value = false }
}

function handleAdd() { Object.assign(form, { id: '', title: '', image: '', linkType: 0, linkValue: '', sortOrder: 0, status: 1 }); dialogVisible.value = true }
function handleEdit(row: any) { Object.assign(form, { id: String(row.id), title: row.title || '', image: row.image || '', linkType: Number(row.linkType ?? 0), linkValue: row.linkValue || '', sortOrder: Number(row.sortOrder || 0), status: row.status === 0 ? 0 : 1 }); dialogVisible.value = true }

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm('确定删除该Banner吗？', '提示', { type: 'warning' }); await bannerApi.delete(String(row.id)); ElMessage.success('删除成功'); await fetchList() }
  catch (e: any) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '删除失败') }
}

async function handleUploadImage(options: any) {
  try { const res = await uploadApi.uploadImage(options.file, 'marketing-banner'); form.image = res.data.url }
  catch (e: any) { ElMessage.error(e?.message || '图片上传失败') }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return
  const linkValue = form.linkValue.trim()
  if (form.linkType !== 0 && !linkValue) { ElMessage.warning('请输入跳转目标'); return }
  if ((form.linkType === 1 || form.linkType === 2) && !/^[1-9]\d*$/.test(linkValue)) { ElMessage.warning('商品/活动跳转目标必须是有效ID'); return }
  if (form.linkType === 3 && !linkValue.startsWith('/pages/')) { ElMessage.warning('小程序页面路径必须以 /pages/ 开头'); return }
  const payload: BannerPayload = { title: form.title.trim(), image: form.image, linkType: form.linkType, linkValue: form.linkType === 0 ? '' : linkValue, sortOrder: form.sortOrder, status: form.status }
  submitting.value = true
  try { if (form.id) await bannerApi.update(form.id, payload); else await bannerApi.create(payload); ElMessage.success('保存成功'); dialogVisible.value = false; await fetchList() }
  catch (e: any) { ElMessage.error(e?.message || '保存失败') }
  finally { submitting.value = false }
}

fetchList()
</script>