<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑活动' : '新增活动' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 760px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" maxlength="100" />
        </el-form-item>

        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择活动类型">
            <el-option label="限时折扣" value="1" />
            <el-option label="满减活动" value="2" />
            <el-option label="满赠活动" value="3" />
            <el-option label="组合套餐" value="4" />
            <el-option label="新人礼包" value="5" />
          </el-select>
        </el-form-item>

        <el-form-item label="活动时间" prop="dateRange">
          <el-date-picker v-model="form.dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>

        <el-form-item v-if="form.type === '2'" label="满减规则">
          <div v-for="(rule, idx) in form.fullReductionRules" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
            <span>满</span>
            <el-input-number v-model="rule.fullAmount" :min="0.01" :precision="2" size="small" />
            <span>元减</span>
            <el-input-number v-model="rule.reduceAmount" :min="0.01" :precision="2" size="small" />
            <span>元</span>
            <el-button type="danger" link @click="form.fullReductionRules.splice(idx, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="form.fullReductionRules.push({ fullAmount: 100, reduceAmount: 10 })">添加规则</el-button>
        </el-form-item>

        <el-form-item label="活动商品">
          <el-button size="small" @click="selectProductVisible = true">选择商品</el-button>
          <el-table :data="form.products" stripe size="small" style="margin-top: 8px; max-width: 680px">
            <el-table-column prop="name" label="商品名称" show-overflow-tooltip />
            <el-table-column label="原价" width="100">
              <template #default="{ row }">¥{{ formatPrice(row.originalPrice) }}</template>
            </el-table-column>
            <el-table-column label="活动价(元)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.activityPriceYuan" :min="0" :precision="2" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="活动库存" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.activityStock" :min="0" :max="row.stock" size="small" />
              </template>
            </el-table-column>
            <el-table-column width="80">
              <template #default="{ $index }"><el-button type="danger" link @click="form.products.splice($index, 1)">移除</el-button></template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-form-item label="活动规则说明">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="5000" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="selectProductVisible" title="选择商品" width="760px" destroy-on-close>
      <el-table :data="productList" stripe size="small" @selection-change="handleProductSelect">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="商品名称" show-overflow-tooltip />
        <el-table-column label="价格" width="100"><template #default="{ row }">¥{{ formatPrice(row.price) }}</template></el-table-column>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { activityApi, type ActivityPayload } from '@/api/activity'
import { productApi } from '@/api/product'
import { formatPrice, priceToFen } from '@/utils/format'
import { asArray } from '@/utils/response'

const POSITIVE_ID = /^[1-9]\d*$/
const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const selectProductVisible = ref(false)
const productList = ref<any[]>([])
const selectedProducts = ref<any[]>([])
const activityId = computed(() => String(route.params.id || '').trim())
const isEdit = computed(() => POSITIVE_ID.test(activityId.value))

const form = reactive({
  name: '',
  type: '1' as '1' | '2' | '3' | '4' | '5',
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

function pad(value: number) { return String(value).padStart(2, '0') }
function toLocalPicker(value: unknown) {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function pickerToIso(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) throw new Error('活动时间格式无效')
  return date.toISOString()
}

async function fetchProducts() {
  try {
    const res = await productApi.getList({ page: 1, pageSize: 100, status: 1 })
    productList.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取商品失败')
  }
}
function handleProductSelect(rows: any[]) { selectedProducts.value = rows }
function confirmProductSelect() {
  const existing = new Set(form.products.map((p) => String(p.productId)))
  for (const p of selectedProducts.value) {
    const id = String(p.id || '')
    if (!POSITIVE_ID.test(id) || existing.has(id)) continue
    form.products.push({
      productId: id,
      name: p.name,
      originalPrice: Number(p.price || 0),
      activityPriceYuan: Number(p.price || 0) / 100,
      activityStock: Number(p.stock || 0),
      stock: Number(p.stock || 0),
      limitPerUser: 0,
    })
    existing.add(id)
  }
  selectProductVisible.value = false
}

async function fetchDetail() {
  if (!isEdit.value) return
  try {
    const res = await activityApi.getDetail(activityId.value)
    const d = res.data
    const parsedRules = d?.rules && typeof d.rules === 'object' ? d.rules : {}
    Object.assign(form, {
      name: d.name || '',
      type: String(d.type || '1') as any,
      dateRange: [toLocalPicker(d.startTime), toLocalPicker(d.endTime)],
      fullReductionRules: asArray(parsedRules.fullReductionRules).map((r: any) => ({
        fullAmount: Number(r.fullAmount || 0) / 100,
        reduceAmount: Number(r.reduceAmount || 0) / 100,
      })),
      products: asArray(d.products).map((p: any) => ({
        productId: String(p.productId || p.id || ''),
        skuId: p.skuId ? String(p.skuId) : undefined,
        name: p.name || '',
        originalPrice: Number(p.originalPrice || p.price || 0),
        activityPriceYuan: Number(p.activityPrice ?? p.price ?? 0) / 100,
        activityStock: Number(p.stock ?? p.activityStock ?? 0),
        stock: Number(p.stock ?? p.activityStock ?? 0),
        limitPerUser: Number(p.limitPerUser || 0),
      })),
      description: d.description || '',
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载活动失败')
  }
}

function buildPayload(): ActivityPayload {
  if (form.dateRange.length !== 2) throw new Error('请选择完整活动时间')
  const startTime = pickerToIso(form.dateRange[0])
  const endTime = pickerToIso(form.dateRange[1])
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) throw new Error('活动结束时间必须晚于开始时间')

  const fullReductionRules = form.type === '2'
    ? form.fullReductionRules.map((r) => ({ fullAmount: priceToFen(r.fullAmount), reduceAmount: priceToFen(r.reduceAmount) }))
    : []
  if (form.type === '2' && fullReductionRules.some((r) => r.fullAmount <= 0 || r.reduceAmount <= 0 || r.reduceAmount >= r.fullAmount)) {
    throw new Error('满减规则必须满足“门槛>减免>0”')
  }

  return {
    name: form.name.trim(),
    type: form.type,
    startTime,
    endTime,
    description: form.description.trim(),
    rules: { fullReductionRules },
    products: form.products.map((p) => ({
      productId: String(p.productId),
      ...(p.skuId ? { skuId: String(p.skuId) } : {}),
      activityPrice: priceToFen(p.activityPriceYuan),
      activityStock: Number(p.activityStock || 0),
      limitPerUser: Number(p.limitPerUser || 0),
    })),
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  let payload: ActivityPayload
  try { payload = buildPayload() } catch (e: any) { ElMessage.warning(e?.message || '请检查活动配置'); return }
  submitting.value = true
  try {
    if (isEdit.value) await activityApi.update(activityId.value, payload)
    else await activityApi.create(payload)
    ElMessage.success('保存成功')
    router.push('/marketing/activity-list')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally { submitting.value = false }
}

onMounted(() => { fetchProducts(); fetchDetail() })
</script>
