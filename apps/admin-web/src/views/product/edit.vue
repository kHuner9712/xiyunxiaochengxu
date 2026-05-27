<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑商品' : '新增商品' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 800px">
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商品名称" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="分类" prop="categoryId">
          <el-tree-select
            v-model="form.categoryId"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' } as any"
            placeholder="请选择分类"
            check-strictly
          />
        </el-form-item>

        <el-form-item label="品牌" prop="brandId">
          <el-select v-model="form.brandId" placeholder="请选择品牌" clearable>
            <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="供应商" prop="supplierId">
          <el-select v-model="form.supplierId" placeholder="请选择供应商" clearable filterable>
            <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="商品主图" prop="mainImage">
          <el-upload
            class="avatar-uploader"
            action=""
            :http-request="handleUploadImage"
            :show-file-list="false"
            accept="image/*"
          >
            <el-image v-if="form.mainImage" :src="form.mainImage" style="width: 120px; height: 120px" fit="cover" />
            <el-icon v-else :size="28" style="width: 120px; height: 120px; line-height: 120px; border: 1px dashed #d9d9d9; text-align: center"><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-form-item label="商品图片">
          <el-upload
            action=""
            :http-request="handleUploadImage"
            list-type="picture-card"
            :file-list="imageFileList"
            :on-remove="handleRemoveImage"
            accept="image/*"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-form-item label="价格(元)" prop="price">
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="1" />
        </el-form-item>

        <el-form-item label="原价(元)">
          <el-input-number v-model="form.originalPrice" :min="0" :precision="2" :step="1" />
        </el-form-item>

        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="form.stock" :min="0" />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">上架</el-radio>
            <el-radio :label="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">SKU管理</el-divider>

        <el-form-item label="规格设置">
          <el-button type="primary" size="small" @click="addSku">添加规格</el-button>
        </el-form-item>

        <el-table :data="form.skus" border style="margin-bottom: 20px; max-width: 800px">
          <el-table-column label="规格名称" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="如：红色/XL" />
            </template>
          </el-table-column>
          <el-table-column label="价格(元)" width="150">
            <template #default="{ row }">
              <el-input-number v-model="row.price" :min="0" :precision="2" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="库存" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.stock" :min="0" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="SKU图片" width="120">
            <template #default="{ row }">
              <el-upload
                action=""
                :http-request="(opt: any) => handleUploadSkuImage(opt, row)"
                :show-file-list="false"
                accept="image/*"
              >
                <el-image v-if="row.image" :src="row.image" style="width: 40px; height: 40px" fit="cover" />
                <el-button v-else size="small">上传</el-button>
              </el-upload>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button type="danger" link @click="form.skus.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">合规信息（食品/保健品/奶粉）</el-divider>

        <el-form-item label="是否食品">
          <el-switch v-model="form.compliance.isFood" />
        </el-form-item>

        <el-form-item label="是否保健食品">
          <el-switch v-model="form.compliance.isHealthSupplement" />
        </el-form-item>

        <el-form-item label="是否奶粉/婴幼儿配方乳粉">
          <el-switch v-model="form.compliance.isInfantFormula" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="生产许可证编号">
          <el-input v-model="form.compliance.productionLicenseNo" placeholder="请输入生产许可证编号" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="食品经营/备案凭证编号">
          <el-input v-model="form.compliance.foodBusinessCertNo" placeholder="请输入食品经营许可证或备案凭证编号" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isHealthSupplement" label="保健食品批准文号/备案号">
          <el-input v-model="form.compliance.healthSupplementApprovalNo" placeholder="请输入蓝帽批准文号或备案号" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isInfantFormula" label="奶粉产品配方注册号">
          <el-input v-model="form.compliance.infantFormulaRegNo" placeholder="请输入婴幼儿配方乳粉产品配方注册号" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="生产厂家">
          <el-input v-model="form.compliance.manufacturer" placeholder="请输入生产厂家名称" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="供应商名称">
          <el-input v-model="form.compliance.supplierName" placeholder="请输入供应商名称" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="保质期">
          <el-input v-model="form.compliance.shelfLife" placeholder="如：12个月" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="贮存条件">
          <el-input v-model="form.compliance.storageCondition" placeholder="如：常温避光保存" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="适用人群">
          <el-input v-model="form.compliance.suitableFor" placeholder="请输入适用人群" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="不适宜人群">
          <el-input v-model="form.compliance.notSuitableFor" placeholder="请输入不适宜人群" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="注意事项">
          <el-input v-model="form.compliance.precautions" type="textarea" :rows="2" placeholder="请输入注意事项" />
        </el-form-item>

        <el-form-item v-if="form.compliance.isFood || form.compliance.isHealthSupplement || form.compliance.isInfantFormula" label="资质图片">
          <el-upload
            action=""
            :http-request="handleUploadCertImage"
            list-type="picture-card"
            :file-list="certImageFileList"
            :on-remove="handleRemoveCertImage"
            accept="image/*"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-divider content-position="left">商品详情</el-divider>

        <el-form-item label="商品描述">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="请输入商品描述" />
        </el-form-item>

        <el-form-item label="详情内容">
          <el-input v-model="form.detailContent" type="textarea" :rows="8" placeholder="请输入商品详情（富文本HTML）" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { productApi } from '@/api/product'
import { categoryApi } from '@/api/category'
import { brandApi } from '@/api/brand'
import { supplierApi } from '@/api/supplier'
import { uploadApi } from '@/api/upload'
import { priceToFen } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const categoryTree = ref<any[]>([])
const brandList = ref<any[]>([])
const supplierList = ref<any[]>([])
const imageFileList = ref<any[]>([])
const certImageFileList = ref<any[]>([])

const isEdit = computed(() => !!route.params.id)

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
  sort: 0,
  status: 1,
  description: '',
  detailContent: '',
  skus: [] as { name: string; price: number; stock: number; image: string }[],
  compliance: {
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
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  stock: [{ required: true, message: '请输入库存', trigger: 'blur' }],
}

function addSku() {
  form.skus.push({ name: '', price: form.price, stock: 0, image: '' })
}

async function handleUploadImage(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    if (!form.mainImage) {
      form.mainImage = res.data.url
    } else {
      form.images.push(res.data.url)
      imageFileList.value.push({ url: res.data.url })
    }
  } catch {}
}

function handleRemoveImage(file: any) {
  const idx = form.images.indexOf(file.url)
  if (idx > -1) form.images.splice(idx, 1)
}

async function handleUploadSkuImage(options: any, row: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    row.image = res.data.url
  } catch {}
}

async function handleUploadCertImage(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.compliance.certImages.push(res.data.url)
    certImageFileList.value.push({ url: res.data.url })
  } catch {}
}

function handleRemoveCertImage(file: any) {
  const idx = form.compliance.certImages.indexOf(file.url)
  if (idx > -1) form.compliance.certImages.splice(idx, 1)
}

async function fetchDetail(id: number) {
  try {
    const res = await productApi.getDetail(id)
    const d = res.data
    Object.assign(form, {
      id: d.id,
      name: d.name,
      categoryId: d.categoryId,
      brandId: d.brandId,
      supplierId: d.supplierId,
      mainImage: d.mainImage,
      images: d.images || [],
      price: d.price / 100,
      originalPrice: (d.originalPrice || 0) / 100,
      stock: d.stock,
      sort: d.sort,
      status: d.status,
      description: d.description,
      detailContent: d.detailContent,
      skus: (d.skus || []).map((s: any) => ({ ...s, price: s.price / 100 })),
      compliance: d.attributes?.compliance || {
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
        certImages: [],
      },
    })
    imageFileList.value = (d.images || []).map((url: string) => ({ url }))
    certImageFileList.value = (d.attributes?.compliance?.certImages || []).map((url: string) => ({ url }))
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data = {
      name: form.name,
      categoryId: form.categoryId,
      brandId: form.brandId,
      supplierId: form.supplierId,
      mainImage: form.mainImage,
      images: form.images,
      description: form.description,
      skus: form.skus.map((s) => ({
        specs: { name: s.name },
        price: priceToFen(s.price),
        stock: s.stock,
        image: s.image || '',
      })),
      attributes: {
        compliance: form.compliance,
      },
    }
    if (isEdit.value) {
      if (!form.id) {
        ElMessage.error('商品ID缺失，无法更新')
        return
      }
      await productApi.update(form.id, data)
    } else {
      await productApi.create(data)
    }
    ElMessage.success('保存成功')
    router.push('/product/list')
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const [catRes, brandRes, supplierRes] = await Promise.all([
      categoryApi.getTree(),
      brandApi.getList({ page: 1, pageSize: 1000 }),
      supplierApi.getList({ page: 1, pageSize: 999 }),
    ])
    categoryTree.value = catRes.data || []
    brandList.value = (brandRes.data as any)?.list || brandRes.data || []
    supplierList.value = (supplierRes.data as any)?.list || supplierRes.data || []
  } catch {}

  if (route.params.id) {
    fetchDetail(Number(route.params.id))
  }
})
</script>
