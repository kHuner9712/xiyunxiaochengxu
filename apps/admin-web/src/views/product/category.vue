<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>分类管理</span>
          <el-button v-permission="'product:category'" type="primary" @click="handleAdd(null)">添加一级分类</el-button>
        </div>
      </template>

      <el-table :data="categoryTree" row-key="id" border default-expand-all v-loading="loading" :tree-props="{ children: 'children' }">
        <el-table-column prop="name" label="分类名称" min-width="200" />
        <el-table-column prop="id" label="ID" width="80" />
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
            <el-button v-permission="'product:category'" type="primary" link @click="handleAdd(row)">添加子分类</el-button>
            <el-button v-permission="'product:category'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'product:category'" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-input :value="parentName" disabled />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="分类图标">
          <el-upload
            action=""
            :http-request="handleUploadIcon"
            :show-file-list="false"
            accept="image/*"
          >
            <el-image v-if="form.icon" :src="form.icon" style="width: 60px; height: 60px" fit="cover" />
            <el-button v-else size="small">上传图标</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.isShow">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-divider content-position="left">类目合规配置</el-divider>
        <el-form-item label="食品类目">
          <el-switch v-model="form.complianceConfig.isFood" />
        </el-form-item>
        <el-form-item label="保健类目">
          <el-switch v-model="form.complianceConfig.isHealthSupplement" />
        </el-form-item>
        <el-form-item label="奶粉类目">
          <el-switch v-model="form.complianceConfig.isInfantFormula" />
        </el-form-item>
        <el-form-item label="需资质图片">
          <el-switch v-model="form.complianceConfig.requiresCertImages" />
        </el-form-item>
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { categoryApi } from '@/api/category'
import { uploadApi } from '@/api/upload'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const categoryTree = ref<any[]>([])
const formRef = ref<FormInstance>()
const parentName = ref('')

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  parentId: 0,
  sortOrder: 0,
  icon: '',
  isShow: 1,
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

async function fetchTree() {
  loading.value = true
  try {
    const res = await categoryApi.getTree()
    categoryTree.value = res.data || []
  } catch {} finally {
    loading.value = false
  }
}

function handleAdd(row: any) {
  form.id = undefined
  form.name = ''
  form.parentId = row ? row.id : 0
  form.sortOrder = 0
  form.icon = ''
  form.isShow = 1
  form.complianceConfig = {
    isFood: false,
    isHealthSupplement: false,
    isInfantFormula: false,
    requiresCertImages: false,
    requiredComplianceFields: [],
  }
  parentName.value = row ? row.name : '无（一级分类）'
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.parentId = row.parentId || 0
  form.sortOrder = row.sortOrder
  form.icon = row.icon || ''
  form.isShow = row.isShow
  form.complianceConfig = {
    isFood: row.complianceConfig?.isFood === true,
    isHealthSupplement: row.complianceConfig?.isHealthSupplement === true,
    isInfantFormula: row.complianceConfig?.isInfantFormula === true,
    requiresCertImages: row.complianceConfig?.requiresCertImages === true,
    requiredComplianceFields: Array.isArray(row.complianceConfig?.requiredComplianceFields) ? row.complianceConfig.requiredComplianceFields : [],
  }
  parentName.value = row.parentName || '无（一级分类）'
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  if (row.children?.length) {
    ElMessage.warning('请先删除子分类')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该分类吗？', '提示', { type: 'warning' })
    await categoryApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchTree()
  } catch {}
}

async function handleUploadIcon(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.icon = res.data.url
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      name: form.name,
      parentId: form.parentId,
      sortOrder: form.sortOrder,
      icon: form.icon,
      isShow: form.isShow,
      complianceConfig: {
        isFood: form.complianceConfig.isFood,
        isHealthSupplement: form.complianceConfig.isHealthSupplement,
        isInfantFormula: form.complianceConfig.isInfantFormula,
        requiresCertImages: form.complianceConfig.requiresCertImages,
        requiredComplianceFields: form.complianceConfig.requiredComplianceFields,
      },
    }
    if (form.id) {
      await categoryApi.update(form.id, payload)
    } else {
      await categoryApi.create(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchTree()
  } catch {} finally {
    submitting.value = false
  }
}

fetchTree()
</script>
