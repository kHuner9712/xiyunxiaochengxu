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
    })
    imageFileList.value = (d.images || []).map((url: string) => ({ url }))
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data = {
      ...form,
      price: priceToFen(form.price),
      originalPrice: priceToFen(form.originalPrice),
      skus: form.skus.map((s) => ({ ...s, price: priceToFen(s.price) })),
    }
    if (isEdit.value) {
      await productApi.update(data)
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
