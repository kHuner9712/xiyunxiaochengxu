<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑活动' : '新增活动' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 700px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
        </el-form-item>

        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择活动类型">
            <el-option label="限时折扣" :value="1" />
            <el-option label="满减活动" :value="2" />
            <el-option label="满赠活动" :value="3" />
            <el-option label="组合套餐" :value="4" />
            <el-option label="新人礼包" :value="5" />
          </el-select>
        </el-form-item>

        <el-form-item label="活动时间" prop="dateRange">
          <el-date-picker v-model="form.dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>

        <el-form-item v-if="form.type === 2" label="满减规则">
          <div v-for="(rule, idx) in form.fullReductionRules" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
            <span>满</span>
            <el-input-number v-model="rule.fullAmount" :min="0" :precision="2" size="small" />
            <span>元减</span>
            <el-input-number v-model="rule.reduceAmount" :min="0" :precision="2" size="small" />
            <span>元</span>
            <el-button type="danger" link @click="form.fullReductionRules.splice(idx, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="form.fullReductionRules.push({ fullAmount: 0, reduceAmount: 0 })">添加规则</el-button>
        </el-form-item>

        <el-form-item label="活动商品">
          <el-button size="small" @click="selectProductVisible = true">选择商品</el-button>
          <el-table :data="form.products" stripe size="small" style="margin-top: 8px; max-width: 600px">
            <el-table-column prop="name" label="商品名称" show-overflow-tooltip />
            <el-table-column label="原价" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.originalPrice) }}</template>
            </el-table-column>
            <el-table-column label="活动价(元)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.activityPrice" :min="0" :precision="2" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="活动库存" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.activityStock" :min="0" size="small" />
              </template>
            </el-table-column>
            <el-table-column width="80">
              <template #default="{ $index }">
                <el-button type="danger" link @click="form.products.splice($index, 1)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-form-item label="活动规则说明">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="请输入活动规则说明" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="selectProductVisible" title="选择商品" width="700px" destroy-on-close>
      <el-table :data="productList" stripe size="small" @selection-change="handleProductSelect">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="商品名称" show-overflow-tooltip />
        <el-table-column label="价格" width="100">
          <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" />
      </el-table>
      <template #footer>
        <el-button @click="selectProductVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmProductSelect">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { activityApi } from '@/api/activity'
import { productApi } from '@/api/product'
import { formatPrice, priceToFen } from '@/utils/format'
import { asArray } from '@/utils/response'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const selectProductVisible = ref(false)
const productList = ref<any[]>([])
const selectedProducts = ref<any[]>([])

const isEdit = computed(() => !!route.params.id)

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  type: 1,
  dateRange: [] as string[],
  fullReductionRules: [] as { fullAmount: number; reduceAmount: number }[],
  products: [] as any[],
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  dateRange: [{ required: true, message: '请选择活动时间', trigger: 'change' }],
}

async function fetchProducts() {
  try {
    const res = await productApi.getList({ page: 1, pageSize: 100, status: 1 })
    productList.value = asArray(res.data)
  } catch {}
}

function handleProductSelect(rows: any[]) {
  selectedProducts.value = rows
}

function confirmProductSelect() {
  const existing = new Set(form.products.map((p) => p.productId))
  for (const p of selectedProducts.value) {
    if (!existing.has(p.id)) {
      form.products.push({
        productId: p.id,
        name: p.name,
        originalPrice: p.price,
        activityPrice: p.price / 100,
        activityStock: p.stock,
      })
    }
  }
  selectProductVisible.value = false
}

async function fetchDetail(id: number) {
  try {
    const res = await activityApi.getDetail(id)
    const d = res.data
    Object.assign(form, {
      id: d.id,
      name: d.name,
      type: d.type,
      dateRange: [d.startTime, d.endTime],
      fullReductionRules: asArray(d.fullReductionRules).map((r: any) => ({
        fullAmount: r.fullAmount / 100,
        reduceAmount: r.reduceAmount / 100,
      })),
      products: asArray(d.products).map((p: any) => ({
        ...p,
        originalPrice: p.originalPrice,
        activityPrice: p.activityPrice / 100,
      })),
      description: d.description || '',
    })
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data: any = {
      ...form,
      startTime: form.dateRange[0],
      endTime: form.dateRange[1],
      fullReductionRules: form.fullReductionRules.map((r) => ({
        fullAmount: priceToFen(r.fullAmount),
        reduceAmount: priceToFen(r.reduceAmount),
      })),
      products: form.products.map((p) => ({
        ...p,
        activityPrice: priceToFen(p.activityPrice),
      })),
    }
    delete data.dateRange

    if (isEdit.value) {
      await activityApi.update(data)
    } else {
      await activityApi.create(data)
    }
    ElMessage.success('保存成功')
    router.push('/marketing/activity-list')
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchProducts()
  if (route.params.id) {
    fetchDetail(Number(route.params.id))
  }
})
</script>
