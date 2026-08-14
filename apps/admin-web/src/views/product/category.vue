<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="header-row">
          <span>分类管理</span>
          <el-button v-permission="'product:category'" type="primary" :disabled="operationBusy" @click="handleAdd(null)">添加一级分类</el-button>
        </div>
      </template>

      <el-table :data="categoryTree" row-key="id" border default-expand-all v-loading="loading" :tree-props="{ children: 'children' }">
        <el-table-column prop="name" label="分类名称" min-width="200" />
        <el-table-column prop="id" label="ID" min-width="130" show-overflow-tooltip />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="合规标签" min-width="220">
          <template #default="{ row }">
            <el-space wrap>
              <el-tag v-if="row.complianceConfig?.isFood" size="small">食品</el-tag>
              <el-tag v-if="row.complianceConfig?.isHealthSupplement" size="small" type="warning">保健</el-tag>
              <el-tag v-if="row.complianceConfig?.isInfantFormula" size="small" type="danger">奶粉</el-tag>
              <el-tag v-if="row.complianceConfig?.requiresCertImages" size="small" type="info">需资质图</el-tag>
              <span v-if="!row.complianceConfig || Object.keys(row.complianceConfig).length === 0">-</span>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="图标" width="80">
          <template #default="{ row }">
            <el-image v-if="row.icon" :src="row.icon" style="width: 30px; height: 30px" fit="cover" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isShow === 1 ? 'success' : 'info'" size="small">
              {{ row.isShow === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'product:category'" type="primary" link :disabled="operationBusy" @click="handleAdd(row)">添加子分类</el-button>
            <el-button v-permission="'product:category'" type="primary" link :disabled="operationBusy" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-permission="'product:category'"
              type="danger"
              link
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id)) || operationBusy"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      destroy-on-close
      :close-on-click-modal="!operationBusy"
      :close-on-press-escape="!operationBusy"
      :show-close="!operationBusy"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="operationBusy">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-input :model-value="parentName" disabled />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="分类图标">
          <el-upload action="" :http-request="handleUploadIcon" :show-file-list="false" :disabled="operationBusy" accept="image/*">
            <el-image v-if="form.icon" :src="form.icon" style="width: 60px; height: 60px" fit="cover" />
            <el-button v-else size="small" :loading="uploading">{{ uploading ? '上传中…' : '上传图标' }}</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.isShow">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-divider content-position="left">类目合规配置</el-divider>
        <el-form-item label="食品类目"><el-switch v-model="form.complianceConfig.isFood" /></el-form-item>
        <el-form-item label="保健类目"><el-switch v-model="form.complianceConfig.isHealthSupplement" /></el-form-item>
        <el-form-item label="奶粉类目"><el-switch v-model="form.complianceConfig.isInfantFormula" /></el-form-item>
        <el-form-item label="需资质图片"><el-switch v-model="form.complianceConfig.requiresCertImages" /></el-form-item>
        <el-form-item label="附加必填字段">
          <el-select v-model="form.complianceConfig.requiredComplianceFields" multiple filterable clearable>
            <el-option label="生产许可证编号" value="productionLicenseNo" />
            <el-option label="食品经营/备案凭证编号" value="foodBusinessCertNo" />
            <el-option label="保健食品批准文号/备案号" value="healthSupplementApprovalNo" />
            <el-option label="奶粉产品配方注册号" value="infantFormulaRegNo" />
            <el-option label="生产厂家" value="manufacturer" />
            <el-option label="保质期" value="shelfLife" />
            <el-option label="贮存条件" value="storageCondition" />
            <el-option label="适用人群" value="suitableFor" />
            <el-option label="不适宜人群" value="notSuitableFor" />
            <el-option label="注意事项" value="precautions" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="operationBusy" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="operationBusy" @click="handleSubmit">
          {{ uploading ? '图标上传中…' : '确定' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { categoryApi, type CategoryPayload, type CategoryRecord } from '@/api/category'
import { uploadApi } from '@/api/upload'
import { asArray } from '@/utils/response'

const POSITIVE_ID = /^[1-9]\d*$/
const loading = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const dialogVisible = ref(false)
const categoryTree = ref<CategoryRecord[]>([])
const formRef = ref<FormInstance>()
const parentName = ref('')
const deleteBusyIds = reactive(new Set<string>())
let treeLoadSeq = 0

const form = reactive({
  id: '' as string,
  clientRequestId: '',
  name: '',
  parentId: '0' as string,
  sortOrder: 0,
  icon: '',
  isShow: 1 as 0 | 1,
  complianceConfig: {
    isFood: false,
    isHealthSupplement: false,
    isInfantFormula: false,
    requiresCertImages: false,
    requiredComplianceFields: [] as string[],
  },
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
}
const dialogTitle = computed(() => (form.id ? '编辑分类' : '添加分类'))
const operationBusy = computed(() => submitting.value || uploading.value)

function createCategoryRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function normalizeTree(rows: any[]): CategoryRecord[] {
  return rows.map((row) => ({
    ...row,
    id: String(row.id || ''),
    parentId: String(row.parentId ?? '0'),
    children: Array.isArray(row.children) ? normalizeTree(row.children) : [],
  }))
}

async function fetchTree() {
  const requestSeq = ++treeLoadSeq
  loading.value = true
  try {
    const res = await categoryApi.getTree()
    if (requestSeq !== treeLoadSeq) return
    categoryTree.value = normalizeTree(asArray(res.data))
  } catch (e: any) {
    if (requestSeq === treeLoadSeq) ElMessage.error(e?.message || '加载分类失败')
  } finally {
    if (requestSeq === treeLoadSeq) loading.value = false
  }
}

function resetCompliance(row?: CategoryRecord | null) {
  form.complianceConfig = {
    isFood: row?.complianceConfig?.isFood === true,
    isHealthSupplement: row?.complianceConfig?.isHealthSupplement === true,
    isInfantFormula: row?.complianceConfig?.isInfantFormula === true,
    requiresCertImages: row?.complianceConfig?.requiresCertImages === true,
    requiredComplianceFields: Array.isArray(row?.complianceConfig?.requiredComplianceFields)
      ? [...row!.complianceConfig!.requiredComplianceFields!]
      : [],
  }
}

function handleAdd(row: CategoryRecord | null) {
  if (operationBusy.value) return
  form.id = ''
  form.clientRequestId = createCategoryRequestId()
  form.name = ''
  form.parentId = row?.id || '0'
  form.sortOrder = 0
  form.icon = ''
  form.isShow = 1
  resetCompliance()
  parentName.value = row?.name || '无（一级分类）'
  dialogVisible.value = true
}

function findCategoryName(id: string, rows = categoryTree.value): string {
  if (id === '0') return '无（一级分类）'
  for (const row of rows) {
    if (row.id === id) return row.name
    const childName = findCategoryName(id, row.children || [])
    if (childName !== '无（一级分类）' && childName !== '') return childName
  }
  return ''
}

function handleEdit(row: CategoryRecord) {
  if (operationBusy.value) return
  form.id = row.id
  form.clientRequestId = ''
  form.name = row.name
  form.parentId = row.parentId || '0'
  form.sortOrder = Number(row.sortOrder || 0)
  form.icon = row.icon || ''
  form.isShow = row.isShow === 0 ? 0 : 1
  resetCompliance(row)
  parentName.value = findCategoryName(form.parentId) || '父级分类已不可用'
  dialogVisible.value = true
}

async function handleDelete(row: CategoryRecord) {
  const id = String(row.id)
  if (operationBusy.value || deleteBusyIds.has(id)) return
  if ((row.children || []).length > 0) {
    ElMessage.warning('请先删除或移动子分类')
    return
  }
  deleteBusyIds.add(id)
  try {
    await ElMessageBox.confirm(`确定删除分类“${row.name}”吗？`, '提示', { type: 'warning' })
    await categoryApi.delete(id)
    ElMessage.success('删除成功')
    await fetchTree()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close' && e?.message) ElMessage.error(e.message)
  } finally {
    deleteBusyIds.delete(id)
  }
}

async function handleUploadIcon(options: any) {
  if (operationBusy.value) return
  uploading.value = true
  try {
    const res = await uploadApi.uploadImage(options.file, 'category-icon')
    const url = res?.data?.url
    if (!url) throw new Error('上传成功但未返回图标地址')
    form.icon = url
    options.onSuccess?.(res)
  } catch (e: any) {
    options.onError?.(e)
    ElMessage.error(e?.message || '图标上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  if (submitting.value) return
  if (uploading.value) {
    ElMessage.warning('图标仍在上传，请等待上传完成后再保存分类')
    return
  }
  submitting.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    if (form.parentId !== '0' && !POSITIVE_ID.test(form.parentId)) {
      ElMessage.warning('父级分类ID无效，请刷新分类树后重试')
      return
    }
    if (form.id && !POSITIVE_ID.test(form.id)) {
      ElMessage.warning('分类ID无效，请刷新分类树后重试')
      return
    }

    const payload: CategoryPayload = {
      name: form.name.trim(),
      parentId: form.parentId,
      sortOrder: form.sortOrder,
      icon: form.icon.trim(),
      isShow: form.isShow,
      complianceConfig: {
        ...form.complianceConfig,
        requiredComplianceFields: [...form.complianceConfig.requiredComplianceFields],
      },
      ...(!form.id ? { clientRequestId: form.clientRequestId } : {}),
    }

    if (form.id) {
      await categoryApi.update(form.id, payload)
    } else {
      if (!form.clientRequestId) throw new Error('分类创建请求标识缺失，请重新打开新增窗口')
      await categoryApi.create(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await fetchTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

fetchTree()
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
