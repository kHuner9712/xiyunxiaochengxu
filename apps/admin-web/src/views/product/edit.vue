<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑商品' : '新增商品' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" style="max-width: 900px">
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="分类" prop="categoryId">
          <el-tree-select
            v-model="form.categoryId"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' } as any"
            placeholder="请选择分类"
            check-strictly
            @change="onCategoryChange"
          />
        </el-form-item>

        <el-form-item label="品牌">
          <el-select v-model="form.brandId" clearable>
            <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="供应商">
          <el-select v-model="form.supplierId" clearable filterable>
            <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="商品主图" prop="mainImage">
          <el-upload action="" :http-request="handleUploadImage" :show-file-list="false" accept="image/*">
            <el-image v-if="form.mainImage" :src="form.mainImage" style="width: 120px; height: 120px" fit="cover" />
            <el-icon v-else :size="28" style="width: 120px; height: 120px; line-height: 120px; border: 1px dashed #d9d9d9; text-align: center"><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-form-item label="商品图片">
          <el-upload action="" :http-request="handleUploadImage" list-type="picture-card" :file-list="imageFileList" :on-remove="handleRemoveImage" accept="image/*">
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>

        <el-form-item label="推荐" prop="isRecommend">
          <el-switch v-model="form.isRecommend" :active-value="1" :inactive-value="0" />
        </el-form-item>

        <el-divider content-position="left">规格与库存</el-divider>

        <el-form-item label="规格模式">
          <el-radio-group v-model="form.skuMode">
            <el-radio value="single">单规格（默认SKU）</el-radio>
            <el-radio value="multi">多规格</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="顶部价格(元)">
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="顶部原价(元)">
          <el-input-number v-model="form.originalPrice" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="顶部库存">
          <el-input-number v-model="form.stock" :min="0" />
        </el-form-item>

        <el-form-item label="规格设置">
          <el-button type="primary" size="small" @click="addSku">添加规格</el-button>
          <el-text type="info" style="margin-left: 8px">多规格以 SKU 表格为准；单规格会自动生成默认 SKU</el-text>
        </el-form-item>

        <el-table :data="form.skus" border style="margin-bottom: 20px; max-width: 900px">
          <el-table-column label="规格名称" min-width="180">
            <template #default="{ row }"><el-input v-model="row.name" placeholder="如：颜色-红 / 尺码-L" /></template>
          </el-table-column>
          <el-table-column label="价格(元)" width="150">
            <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :precision="2" size="small" /></template>
          </el-table-column>
          <el-table-column label="原价(元)" width="150">
            <template #default="{ row }"><el-input-number v-model="row.originalPrice" :min="0" :precision="2" size="small" /></template>
          </el-table-column>
          <el-table-column label="库存" width="120">
            <template #default="{ row }"><el-input-number v-model="row.stock" :min="0" size="small" /></template>
          </el-table-column>
          <el-table-column label="SKU图片" width="120">
            <template #default="{ row }">
              <el-upload action="" :http-request="(opt: any) => handleUploadSkuImage(opt, row)" :show-file-list="false" accept="image/*">
                <el-image v-if="row.image" :src="row.image" style="width: 40px; height: 40px" fit="cover" />
                <el-button v-else size="small">上传</el-button>
              </el-upload>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }"><el-button type="danger" link @click="form.skus.splice($index, 1)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">合规信息</el-divider>

        <el-form-item label="商品合规类型" required>
          <el-radio-group v-model="form.complianceType">
            <el-radio value="normal">普通商品/非特殊监管商品</el-radio>
            <el-radio value="food">食品/辅食/零食</el-radio>
            <el-radio value="health">保健食品/营养补充</el-radio>
            <el-radio value="infant">婴幼儿配方奶粉</el-radio>
            <el-radio value="advanced">多类型组合/高级模式</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-alert
          v-if="form.complianceType === 'normal'"
          type="warning"
          :closable="false"
          title="仅适用于非食品、非保健食品、非婴幼儿配方奶粉等非特殊监管商品"
          style="margin-bottom: 12px"
        />

        <el-form-item v-if="form.complianceType === 'advanced'" label="高级开关">
          <el-space>
            <el-switch v-model="form.compliance.isFood" active-text="食品" />
            <el-switch v-model="form.compliance.isHealthSupplement" active-text="保健食品" />
            <el-switch v-model="form.compliance.isInfantFormula" active-text="婴幼儿配方奶粉" />
          </el-space>
        </el-form-item>

        <el-form-item v-if="isRegulatedType" label="生产许可证编号"><el-input v-model="form.compliance.productionLicenseNo" /></el-form-item>
        <el-form-item v-if="isRegulatedType" label="食品经营/备案凭证编号"><el-input v-model="form.compliance.foodBusinessCertNo" /></el-form-item>
        <el-form-item v-if="form.complianceType === 'health' || (form.complianceType === 'advanced' && form.compliance.isHealthSupplement)" label="保健食品批准文号/备案号"><el-input v-model="form.compliance.healthSupplementApprovalNo" /></el-form-item>
        <el-form-item v-if="form.complianceType === 'infant' || (form.complianceType === 'advanced' && form.compliance.isInfantFormula)" label="奶粉产品配方注册号"><el-input v-model="form.compliance.infantFormulaRegNo" /></el-form-item>
        <el-form-item v-if="isRegulatedType" label="生产厂家"><el-input v-model="form.compliance.manufacturer" /></el-form-item>
        <el-form-item v-if="isRegulatedType" label="供应商名称"><el-input v-model="form.compliance.supplierName" /></el-form-item>
        <el-form-item v-if="isRegulatedType" label="保质期"><el-input v-model="form.compliance.shelfLife" /></el-form-item>
        <el-form-item v-if="isRegulatedType" label="贮存条件"><el-input v-model="form.compliance.storageCondition" /></el-form-item>
        <el-form-item v-if="form.complianceType === 'health' || (form.complianceType === 'advanced' && form.compliance.isHealthSupplement)" label="适用人群"><el-input v-model="form.compliance.suitableFor" /></el-form-item>
        <el-form-item v-if="form.complianceType === 'health' || (form.complianceType === 'advanced' && form.compliance.isHealthSupplement)" label="不适宜人群"><el-input v-model="form.compliance.notSuitableFor" /></el-form-item>
        <el-form-item v-if="form.complianceType === 'health' || (form.complianceType === 'advanced' && form.compliance.isHealthSupplement)" label="注意事项"><el-input v-model="form.compliance.precautions" type="textarea" :rows="2" /></el-form-item>

        <el-form-item v-if="isRegulatedType" label="资质图片">
          <el-upload action="" :http-request="handleUploadCertImage" list-type="picture-card" :file-list="certImageFileList" :on-remove="handleRemoveCertImage" accept="image/*">
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-divider content-position="left">商品详情</el-divider>
        <el-form-item label="商品描述"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="服务承诺(JSON)"><el-input v-model="servicePromiseText" type="textarea" :rows="4" placeholder='例如: {"delivery":"24小时发货"}' /></el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存商品</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { productApi } from '@/api/product'
import { categoryApi } from '@/api/category'
import { brandApi } from '@/api/brand'
import { supplierApi } from '@/api/supplier'
import { uploadApi } from '@/api/upload'
import { priceToFen } from '@/utils/format'
import { resolvePrivateFileUrl, resolvePrivateFileUrls, revokePrivateObjectUrls } from '@/utils/private-file'
import { asArray } from '@/utils/response'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const categoryTree = ref<any[]>([])
const brandList = ref<any[]>([])
const supplierList = ref<any[]>([])
const imageFileList = ref<any[]>([])
const certImageFileList = ref<any[]>([])
const currentCategoryName = ref('')
const servicePromiseText = ref('')

const isEdit = computed(() => !!route.params.id)
const isRegulatedType = computed(() => form.complianceType !== 'normal')

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  categoryId: undefined as number | undefined,
  brandId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  mainImage: '',
  images: [] as string[],
  price: 0,
  originalPrice: 0,
  stock: 0,
  sortOrder: 0,
  isRecommend: 0,
  description: '',
  skuMode: 'single' as 'single' | 'multi',
  skus: [] as { id?: number; skuCode?: string; name: string; price: number; originalPrice: number; stock: number; image: string }[],
  complianceType: 'normal' as 'normal' | 'food' | 'health' | 'infant' | 'advanced',
  compliance: {
    isRegulated: false,
    isFood: false,
    isHealthSupplement: false,
    isInfantFormula: false,
    productionLicenseNo: '',
    foodBusinessCertNo: '',
    healthSupplementApprovalNo: '',
    infantFormulaRegNo: '',
    manufacturer: '',
    supplierName: '',
    shelfLife: '',
    storageCondition: '',
    suitableFor: '',
    notSuitableFor: '',
    precautions: '',
    certImages: [] as string[],
  },
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  sortOrder: [{ required: true, message: '请输入排序', trigger: 'blur' }],
}

function sanitizeUrl(url: unknown): string {
  return typeof url === 'string' && url.trim() && url.trim() !== 'undefined' ? url.trim() : ''
}

function sanitizeUrlList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values.map((item) => sanitizeUrl(item)).filter((item) => !!item)
}

function inferCategoryNameById(id?: number): string {
  if (!id) return ''
  const stack = [...categoryTree.value]
  while (stack.length) {
    const current = stack.shift()
    if (!current) continue
    if (Number(current.id) === Number(id)) return String(current.name || '')
    if (Array.isArray(current.children)) stack.push(...current.children)
  }
  return ''
}

function inferCategoryById(id?: number): any | null {
  if (!id) return null
  const stack = [...categoryTree.value]
  while (stack.length) {
    const current = stack.shift()
    if (!current) continue
    if (Number(current.id) === Number(id)) return current
    if (Array.isArray(current.children)) stack.push(...current.children)
  }
  return null
}

function onCategoryChange() {
  currentCategoryName.value = inferCategoryNameById(form.categoryId)
}

function addSku() {
  form.skuMode = 'multi'
  form.skus.push({ name: '', price: form.price, originalPrice: form.originalPrice, stock: 0, image: '' })
}

function normalizeSpecs(name: string) {
  if (!name.trim()) return { 默认: '默认规格' }
  const parts = name.split(/[\/|,，]/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return { 默认: '默认规格' }
  const specs: Record<string, string> = {}
  parts.forEach((value, idx) => { specs[`规格${idx + 1}`] = value })
  return specs
}

function generateSkuCode(productId?: number) {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  return `SKU-${productId || 'NEW'}-${randomPart.slice(0, 18).toUpperCase()}`
}

function ensureSkus() {
  if (form.skuMode === 'single' && form.skus.length === 0) {
    form.skus.push({
      name: '默认规格',
      price: form.price,
      originalPrice: form.originalPrice,
      stock: form.stock,
      image: form.mainImage,
    })
  }
}

function validateSkus(): boolean {
  ensureSkus()
  if (!form.skus.length) {
    ElMessage.error('请添加至少一个 SKU')
    return false
  }
  for (const sku of form.skus) {
    if (Number(sku.price) <= 0) {
      ElMessage.error('SKU 价格必须大于 0')
      return false
    }
    if (Number(sku.stock) < 0) {
      ElMessage.error('SKU 库存不能小于 0')
      return false
    }
  }
  return true
}

function applyComplianceTypeFromDetail(compliance: any) {
  if (compliance?.isRegulated === false) {
    form.complianceType = 'normal'
    return
  }
  const isFood = compliance?.isFood === true
  const isHealth = compliance?.isHealthSupplement === true
  const isInfant = compliance?.isInfantFormula === true
  const count = [isFood, isHealth, isInfant].filter(Boolean).length
  if (count > 1) form.complianceType = 'advanced'
  else if (isInfant) form.complianceType = 'infant'
  else if (isHealth) form.complianceType = 'health'
  else if (isFood) form.complianceType = 'food'
  else form.complianceType = 'normal'
}

function validateComplianceBeforeSave(): boolean {
  const category = inferCategoryById(form.categoryId)
  const categoryConfig = category?.complianceConfig || {}
  const hitRiskCategoryByConfig = categoryConfig.isFood || categoryConfig.isHealthSupplement || categoryConfig.isInfantFormula
  const hitRiskCategoryByKeyword = /食品|辅食|零食|奶粉|营养|保健/i.test(currentCategoryName.value)
  const hitRiskCategory = hitRiskCategoryByConfig || hitRiskCategoryByKeyword
  if (form.complianceType === 'normal' && hitRiskCategory) {
    ElMessage.error('当前类目疑似高合规商品，不能选择“普通商品”，请改为食品/保健/奶粉或高级模式')
    return false
  }

  const compliance = form.compliance
  if (form.complianceType === 'normal') {
    compliance.isRegulated = false
    compliance.isFood = false
    compliance.isHealthSupplement = false
    compliance.isInfantFormula = false
    return true
  }

  compliance.isRegulated = true
  if (form.complianceType !== 'advanced') {
    compliance.isFood = form.complianceType === 'food' || form.complianceType === 'health' || form.complianceType === 'infant'
    compliance.isHealthSupplement = form.complianceType === 'health'
    compliance.isInfantFormula = form.complianceType === 'infant'
  }

  const missing: string[] = []
  const isFood = compliance.isFood === true
  const isHealth = compliance.isHealthSupplement === true
  const isInfant = compliance.isInfantFormula === true
  const requiredComplianceFields: string[] = Array.isArray(categoryConfig.requiredComplianceFields)
    ? categoryConfig.requiredComplianceFields
    : []

  if (isFood) {
    if (!compliance.productionLicenseNo) missing.push('生产许可证编号')
    if (!compliance.foodBusinessCertNo) missing.push('食品经营/备案凭证编号')
    if (!compliance.manufacturer) missing.push('生产厂家')
    if (!compliance.shelfLife) missing.push('保质期')
    if (!compliance.storageCondition) missing.push('贮存条件')
    if (!Array.isArray(compliance.certImages) || compliance.certImages.length === 0) missing.push('资质图片')
  }
  if (isHealth) {
    if (!compliance.healthSupplementApprovalNo) missing.push('保健食品批准文号/备案号')
    if (!compliance.suitableFor) missing.push('适用人群')
    if (!compliance.notSuitableFor) missing.push('不适宜人群')
    if (!compliance.precautions) missing.push('注意事项')
    if (!Array.isArray(compliance.certImages) || compliance.certImages.length === 0) missing.push('资质图片')
  }
  if (isInfant) {
    if (!compliance.infantFormulaRegNo) missing.push('奶粉产品配方注册号')
    if (!compliance.manufacturer) missing.push('生产厂家')
    if (!compliance.shelfLife) missing.push('保质期')
    if (!compliance.storageCondition) missing.push('贮存条件')
    if (!Array.isArray(compliance.certImages) || compliance.certImages.length === 0) missing.push('资质图片')
  }

  if (missing.length > 0) {
    ElMessage.error(`合规信息不完整：${missing.join('、')}`)
    return false
  }

  for (const requiredField of requiredComplianceFields) {
    const value = (compliance as any)[requiredField]
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      ElMessage.error(`当前类目要求必填字段：${requiredField}`)
      return false
    }
  }
  return true
}

async function handleUploadImage(options: any) {
  const res = await uploadApi.uploadImage(options.file)
  const uploadedUrl = sanitizeUrl(res?.data?.url)
  if (!uploadedUrl) return
  if (!form.mainImage) form.mainImage = uploadedUrl
  else {
    form.images.push(uploadedUrl)
    imageFileList.value.push({ url: uploadedUrl })
  }
}

function handleRemoveImage(file: any) {
  const idx = form.images.indexOf(file.url)
  if (idx > -1) form.images.splice(idx, 1)
}

async function handleUploadSkuImage(options: any, row: any) {
  const res = await uploadApi.uploadImage(options.file)
  row.image = sanitizeUrl(res?.data?.url)
}

async function handleUploadCertImage(options: any) {
  const res = await uploadApi.uploadImage(options.file, 'cert')
  const uploadedUrl = sanitizeUrl(res?.data?.url)
  if (!uploadedUrl) return
  form.compliance.certImages.push(uploadedUrl)
  certImageFileList.value.push({ url: await resolvePrivateFileUrl(uploadedUrl), rawUrl: uploadedUrl })
}

function handleRemoveCertImage(file: any) {
  const rawUrl = file.rawUrl || file.url
  const idx = form.compliance.certImages.indexOf(rawUrl)
  if (idx > -1) form.compliance.certImages.splice(idx, 1)
  if (file.url) revokePrivateObjectUrls([file.url])
}

async function fetchDetail(id: number) {
  const res = await productApi.getDetail(id)
  const d = res.data
  const skus = asArray(d.skus).filter((s: any) => s.status === 1 || s.status === undefined)
  const firstSku = skus[0]

  Object.assign(form, {
    id: Number(d.id),
    name: d.name || '',
    categoryId: d.categoryId ? Number(d.categoryId) : undefined,
    brandId: d.brandId ? Number(d.brandId) : undefined,
    supplierId: d.supplierId ? Number(d.supplierId) : undefined,
    mainImage: sanitizeUrl(d.mainImage),
    images: sanitizeUrlList(d.images),
    price: Number(((d.minPrice ?? firstSku?.price ?? 0) / 100).toFixed(2)),
    originalPrice: Number((((firstSku?.originalPrice ?? d.minPrice ?? 0) as number) / 100).toFixed(2)),
    stock: Number(d.stock ?? 0),
    sortOrder: Number(d.sortOrder ?? 0),
    isRecommend: Number(d.isRecommend ?? 0),
    description: d.description || '',
    skus: skus.map((s: any) => ({
      id: s.id ? Number(s.id) : undefined,
      skuCode: s.skuCode || undefined,
      name: Object.values(s.specs || {}).join('/'),
      price: Number((s.price / 100).toFixed(2)),
      originalPrice: Number((((s.originalPrice ?? s.price) as number) / 100).toFixed(2)),
      stock: s.stock ?? 0,
      image: sanitizeUrl(s.image),
    })),
  })

  form.skuMode = form.skus.length > 1 ? 'multi' : 'single'
  form.compliance = {
    ...form.compliance,
    ...(d.attributes?.compliance || {}),
    certImages: sanitizeUrlList(d.attributes?.compliance?.certImages),
  }
  applyComplianceTypeFromDetail(form.compliance)
  servicePromiseText.value = d.servicePromise ? JSON.stringify(d.servicePromise, null, 2) : ''
  imageFileList.value = form.images.map((url) => ({ url }))
  revokePrivateObjectUrls(certImageFileList.value.map((item: any) => item.url))
  certImageFileList.value = (await resolvePrivateFileUrls(form.compliance.certImages))
    .map((url: string, index: number) => ({ url, rawUrl: form.compliance.certImages[index] }))
  onCategoryChange()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!validateSkus()) return
  if (!validateComplianceBeforeSave()) return

  let servicePromise: any = undefined
  if (servicePromiseText.value.trim()) {
    try { servicePromise = JSON.parse(servicePromiseText.value) } catch { ElMessage.error('服务承诺必须是合法 JSON'); return }
  }

  submitting.value = true
  try {
    const payload = {
      name: form.name,
      categoryId: form.categoryId,
      brandId: form.brandId,
      supplierId: form.supplierId,
      mainImage: sanitizeUrl(form.mainImage),
      images: sanitizeUrlList(form.images),
      description: form.description,
      sortOrder: form.sortOrder,
      isRecommend: form.isRecommend,
      servicePromise,
      skus: form.skus.map((s, _index) => ({
        skuCode: s.skuCode || generateSkuCode(form.id),
        specs: normalizeSpecs(s.name),
        price: priceToFen(s.price),
        originalPrice: priceToFen(s.originalPrice || s.price),
        stock: Number(s.stock || 0),
        image: sanitizeUrl(s.image || form.mainImage),
      })),
      attributes: {
        detailContent: form.description,
        compliance: {
          ...form.compliance,
          certImages: sanitizeUrlList(form.compliance.certImages),
        },
      },
    }

    if (isEdit.value) {
      if (!form.id) return
      await productApi.update(form.id, payload)
    } else {
      await productApi.create(payload)
    }

    ElMessage.success('保存成功（商品状态请在列表页进行上架/下架）')
    router.push('/product/list')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const [catRes, brandRes, supplierRes] = await Promise.all([
    categoryApi.getTree(),
    brandApi.getList({ page: 1, pageSize: 100 }),
    supplierApi.getList({ page: 1, pageSize: 100 }),
  ])
  categoryTree.value = asArray(catRes.data)
  brandList.value = asArray(brandRes.data)
  supplierList.value = asArray(supplierRes.data)

  if (route.params.id) await fetchDetail(Number(route.params.id))
})

onUnmounted(() => {
  revokePrivateObjectUrls(certImageFileList.value.map((item: any) => item.url))
})
</script>
