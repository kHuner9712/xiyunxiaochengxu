<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑活动' : '新增活动' }}</span>
      </template>

      <el-alert
        v-if="legacyUnsupportedType"
        title="该历史活动类型没有完整结算规则，不能继续启用。请改为限时折扣、满减活动或新人优惠后重新配置商品。"
        type="warning"
        :closable="false"
        style="margin-bottom: 18px"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 900px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" maxlength="100" />
        </el-form-item>

        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择活动类型" style="width: 260px">
            <el-option label="限时折扣" value="1" />
            <el-option label="满减活动" value="2" />
            <el-option label="新人优惠" value="5" />
          </el-select>
          <span class="hint">只展示已经接入真实订单结算链的活动类型。</span>
        </el-form-item>

        <el-form-item label="活动时间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item v-if="form.type === '2'" label="满减规则">
          <div class="rules-editor">
            <div v-for="(rule, idx) in form.fullReductionRules" :key="idx" class="rule-row">
              <span>满</span>
              <el-input-number v-model="rule.fullAmount" :min="0.01" :precision="2" size="small" />
              <span>元减</span>
              <el-input-number v-model="rule.reduceAmount" :min="0.01" :precision="2" size="small" />
              <span>元</span>
              <el-button type="danger" link @click="form.fullReductionRules.splice(idx, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="form.fullReductionRules.push({ fullAmount: 100, reduceAmount: 10 })">添加规则</el-button>
          </div>
        </el-form-item>

        <el-form-item label="活动商品">
          <div style="width: 100%">
            <el-button size="small" @click="selectProductVisible = true">选择商品</el-button>
            <el-table :data="form.products" stripe size="small" style="margin-top: 10px; width: 100%">
              <el-table-column prop="name" label="商品名称" min-width="160" show-overflow-tooltip />
              <el-table-column label="活动 SKU" min-width="210">
                <template #default="{ row }">
                  <el-select v-model="row.skuId" placeholder="必须选择具体SKU" filterable style="width: 100%" @change="onSkuChange(row)">
                    <el-option
                      v-for="sku in row.skuOptions"
                      :key="sku.id"
                      :label="sku.label"
                      :value="sku.id"
                      :disabled="sku.status !== 1 || sku.stock <= 0"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="SKU原价" width="105">
                <template #default="{ row }">¥{{ formatPrice(row.originalPrice) }}</template>
              </el-table-column>
              <el-table-column v-if="form.type !== '2'" label="活动价(元)" width="140">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.activityPriceYuan"
                    :min="0"
                    :max="row.originalPrice / 100"
                    :precision="2"
                    size="small"
                  />
                </template>
              </el-table-column>
              <el-table-column v-else label="结算方式" width="120">
                <template #default>按满减规则</template>
              </el-table-column>
              <el-table-column label="活动库存" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.activityStock" :min="1" :max="row.stock" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="每人限购" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.limitPerUser" :min="form.type === '5' ? 1 : 0" :max="99" size="small" />
                </template>
              </el-table-column>
              <el-table-column width="70">
                <template #default="{ $index }">
                  <el-button type="danger" link @click="form.products.splice($index, 1)">移除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="hint block-hint">活动库存和价格均针对选中的具体 SKU；新人优惠默认至少每人限购 1 件。</div>
          </div>
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
        <el-table-column label="起售价" width="110"><template #default="{ row }">¥{{ formatPrice(row.price) }}</template></el-table-column>
        <el-table-column prop="stock" label="总库存" width="90" />
      </el-table>
      <template #footer>
        <el-button @click="selectProductVisible = false">取消</el-button>
        <el-button type="primary" :loading="loadingSelectedProducts" @click="confirmProductSelect">确定</el-button>
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
const EXECUTABLE_TYPES = new Set(['1', '2', '5'])
const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const selectProductVisible = ref(false)
const loadingSelectedProducts = ref(false)
const productList = ref<any[]>([])
const selectedProducts = ref<any[]>([])
const legacyUnsupportedType = ref(false)
const activityId = computed(() => String(route.params.id || '').trim())
const isEdit = computed(() => POSITIVE_ID.test(activityId.value))

interface SkuOption {
  id: string
  label: string
  price: number
  stock: number
  status: number
}

interface ActivityProductRow {
  productId: string
  name: string
  skuId: string
  skuOptions: SkuOption[]
  originalPrice: number
  activityPriceYuan: number
  activityStock: number
  stock: number
  limitPerUser: number
}

const form = reactive({
  name: '',
  type: '1',
  dateRange: [] as string[],
  fullReductionRules: [] as { fullAmount: number; reduceAmount: number }[],
  products: [] as ActivityProductRow[],
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

function skuLabel(sku: any) {
  let specText = ''
  if (typeof sku.specs === 'string') specText = sku.specs
  else if (sku.specs && typeof sku.specs === 'object') specText = Object.values(sku.specs).join(' / ')
  return `${specText || `SKU ${sku.id}`} · ¥${formatPrice(Number(sku.price || 0))} · 库存${Number(sku.stock || 0)}`
}

async function loadSkuOptions(productId: string): Promise<SkuOption[]> {
  const res = await productApi.getDetail(productId)
  return asArray(res.data?.skus)
    .map((sku: any) => ({
      id: String(sku.id || ''),
      label: skuLabel(sku),
      price: Number(sku.price || 0),
      stock: Number(sku.stock || 0),
      status: Number(sku.status ?? 1),
    }))
    .filter((sku) => POSITIVE_ID.test(sku.id))
}

function applySku(row: ActivityProductRow, skuId: string) {
  const sku = row.skuOptions.find((item) => item.id === skuId)
  if (!sku) return
  row.originalPrice = sku.price
  row.stock = sku.stock
  row.activityStock = Math.min(Math.max(1, row.activityStock || sku.stock), sku.stock)
  if (!Number.isFinite(row.activityPriceYuan) || row.activityPriceYuan > sku.price / 100) {
    row.activityPriceYuan = sku.price / 100
  }
}

function onSkuChange(row: ActivityProductRow) {
  applySku(row, row.skuId)
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

async function confirmProductSelect() {
  loadingSelectedProducts.value = true
  try {
    const existing = new Set(form.products.map((p) => p.productId))
    let needsSkuChoice = false
    for (const p of selectedProducts.value) {
      const productId = String(p.id || '')
      if (!POSITIVE_ID.test(productId) || existing.has(productId)) continue
      const skuOptions = await loadSkuOptions(productId)
      const sellable = skuOptions.filter((sku) => sku.status === 1 && sku.stock > 0)
      if (sellable.length === 0) {
        ElMessage.warning(`${p.name || '商品'}没有可售SKU，未加入活动`)
        continue
      }
      const selectedSku = sellable.length === 1 ? sellable[0] : null
      if (!selectedSku) needsSkuChoice = true
      form.products.push({
        productId,
        name: String(p.name || ''),
        skuId: selectedSku?.id || '',
        skuOptions,
        originalPrice: selectedSku?.price || 0,
        activityPriceYuan: selectedSku ? selectedSku.price / 100 : 0,
        activityStock: selectedSku?.stock || 1,
        stock: selectedSku?.stock || 1,
        limitPerUser: form.type === '5' ? 1 : 0,
      })
      existing.add(productId)
    }
    selectProductVisible.value = false
    if (needsSkuChoice) ElMessage.info('部分商品有多个规格，请在活动商品表中明确选择SKU')
  } catch (e: any) {
    ElMessage.error(e?.message || '读取商品SKU失败')
  } finally {
    loadingSelectedProducts.value = false
  }
}

async function fetchDetail() {
  if (!isEdit.value) return
  try {
    const res = await activityApi.getDetail(activityId.value)
    const d = res.data || {}
    const type = String(d.type || '')
    legacyUnsupportedType.value = !EXECUTABLE_TYPES.has(type)
    const parsedRules = d.rules && typeof d.rules === 'object' ? d.rules : {}
    const productRows = await Promise.all(asArray(d.products).map(async (p: any) => {
      const productId = String(p.productId || p.id || '')
      const skuOptions = POSITIVE_ID.test(productId) ? await loadSkuOptions(productId) : []
      const skuId = String(p.skuId || p.sku?.id || '')
      const sku = skuOptions.find((item) => item.id === skuId)
      return {
        productId,
        name: p.name || '',
        skuId,
        skuOptions,
        originalPrice: Number(sku?.price ?? p.originalPrice ?? p.price ?? 0),
        activityPriceYuan: Number(p.activityPrice ?? p.price ?? 0) / 100,
        activityStock: Number(p.activityStock ?? p.stock ?? 0),
        stock: Number(sku?.stock ?? p.stock ?? 0),
        limitPerUser: Number(p.limitPerUser || (type === '5' ? 1 : 0)),
      } as ActivityProductRow
    }))
    Object.assign(form, {
      name: d.name || '',
      type: EXECUTABLE_TYPES.has(type) ? type : '',
      dateRange: [toLocalPicker(d.startTime), toLocalPicker(d.endTime)],
      fullReductionRules: asArray((parsedRules as any).fullReductionRules).map((r: any) => ({
        fullAmount: Number(r.fullAmount || 0) / 100,
        reduceAmount: Number(r.reduceAmount || 0) / 100,
      })),
      products: productRows,
      description: d.description || '',
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载活动失败')
  }
}

function buildPayload(): ActivityPayload {
  if (!EXECUTABLE_TYPES.has(form.type)) throw new Error('请选择已开放真实结算的活动类型')
  if (form.dateRange.length !== 2) throw new Error('请选择完整活动时间')
  if (form.products.length === 0) throw new Error('请至少选择一个活动商品')
  const startTime = pickerToIso(form.dateRange[0])
  const endTime = pickerToIso(form.dateRange[1])
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) throw new Error('活动结束时间必须晚于开始时间')

  const fullReductionRules = form.type === '2'
    ? form.fullReductionRules.map((r) => ({ fullAmount: priceToFen(r.fullAmount), reduceAmount: priceToFen(r.reduceAmount) }))
    : []
  if (form.type === '2' && fullReductionRules.length === 0) throw new Error('满减活动至少需要一条满减规则')
  if (form.type === '2' && fullReductionRules.some((r) => r.fullAmount <= 0 || r.reduceAmount <= 0 || r.reduceAmount >= r.fullAmount)) {
    throw new Error('满减规则必须满足“门槛>减免>0”')
  }

  const products = form.products.map((p) => {
    if (!POSITIVE_ID.test(p.productId) || !POSITIVE_ID.test(p.skuId)) throw new Error(`${p.name || '活动商品'}必须选择具体SKU`)
    const sku = p.skuOptions.find((item) => item.id === p.skuId)
    if (!sku || sku.status !== 1 || sku.stock <= 0) throw new Error(`${p.name || '活动商品'}所选SKU已不可售`)
    if (!Number.isSafeInteger(p.activityStock) || p.activityStock <= 0 || p.activityStock > sku.stock) {
      throw new Error(`${p.name || '活动商品'}活动库存必须在1-${sku.stock}之间`)
    }
    const activityPrice = form.type === '2' ? sku.price : priceToFen(p.activityPriceYuan)
    if (!Number.isSafeInteger(activityPrice) || activityPrice < 0 || activityPrice > sku.price) {
      throw new Error(`${p.name || '活动商品'}活动价不能高于SKU当前价`)
    }
    const limitPerUser = form.type === '5' ? Math.max(1, Number(p.limitPerUser || 1)) : Number(p.limitPerUser || 0)
    if (!Number.isSafeInteger(limitPerUser) || limitPerUser < 0 || limitPerUser > 99) throw new Error('每人限购数量无效')
    return {
      productId: p.productId,
      skuId: p.skuId,
      activityPrice,
      activityStock: p.activityStock,
      limitPerUser,
    }
  })

  return {
    name: form.name.trim(),
    type: form.type as '1' | '2' | '5',
    startTime,
    endTime,
    description: form.description.trim(),
    rules: { fullReductionRules },
    products,
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

<style scoped>
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.block-hint {
  display: block;
  margin: 8px 0 0;
}
.rules-editor {
  width: 100%;
}
.rule-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
</style>
