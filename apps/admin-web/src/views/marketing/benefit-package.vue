<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="权益包名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px">
        <el-button type="primary" @click="handleAdd">新增权益包</el-button>
        <el-alert type="info" :closable="false" style="margin-top: 8px">
          权益包绑定一个商品后，用户购买该商品支付成功即发放权益卡。真实支付仍走现有商品/订单流程，本模块只做权益到账与核销。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="name" label="权益包名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productId" label="绑定商品ID" width="130" show-overflow-tooltip />
        <el-table-column label="展示价" width="100">
          <template #default="{ row }">{{ row.price != null ? '¥' + formatPrice(row.price) : '-' }}</template>
        </el-table-column>
        <el-table-column label="有效期" width="160">
          <template #default="{ row }">{{ formatValid(row) }}</template>
        </el-table-column>
        <el-table-column label="权益项" width="90">
          <template #default="{ row }">{{ row.itemCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-text="上架"
              inactive-text="下架"
              inline-prompt
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="860px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="权益包名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：宝宝成长超级权益卡" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" placeholder="一句话简介" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.coverImage" placeholder="封面图 URL" />
        </el-form-item>
        <el-form-item label="绑定商品ID">
          <el-input v-model="form.productId" placeholder="绑定的商品ID（可选，留空不绑定）" />
        </el-form-item>
        <el-form-item label="展示价(分)">
          <el-input-number v-model="form.price" :min="0" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">仅展示，实际以商品/订单价格为准</span>
        </el-form-item>
        <el-form-item label="有效天数">
          <el-input-number v-model="form.validDays" :min="1" controls-position="right" />
          <span style="margin-left: 8px; color: #909399">购买后 N 天有效，与固定截止时间二选一</span>
        </el-form-item>
        <el-form-item label="固定有效起止">
          <el-date-picker
            v-model="form.validRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">上架</el-radio>
            <el-radio :value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="权益包说明" />
        </el-form-item>

        <el-divider>权益项配置</el-divider>
        <div v-for="(item, idx) in form.items" :key="idx" class="item-block">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="权益名称" :prop="`items.${idx}.name`" :rules="{ required: true, message: '请输入权益名称', trigger: 'blur' }">
                <el-input v-model="item.name" placeholder="如：口腔检查一次" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="类型" label-width="80px">
                <el-select v-model="item.itemType" style="width: 100%">
                  <el-option label="服务" value="service" />
                  <el-option label="实物" value="physical" />
                  <el-option label="优惠券" value="coupon" />
                  <el-option label="其他" value="other" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="次数" label-width="60px">
                <el-input-number v-model="item.quantity" :min="1" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="价值(分)" label-width="80px">
                <el-input-number v-model="item.originalValue" :min="0" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="2" style="text-align: right; padding-top: 4px">
              <el-button type="danger" link @click="removeItem(idx)">删除</el-button>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="商家推广ID" label-width="100px">
                <el-input v-model="item.merchantPromotionSourceId" placeholder="可选" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="核销门店ID" label-width="100px">
                <el-input v-model="item.pickupStoreId" placeholder="可选" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="需核销" label-width="80px">
                <el-switch v-model="item.verifyRequired" :active-value="1" :inactive-value="0" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="启用" label-width="60px">
                <el-switch v-model="item.status" :active-value="1" :inactive-value="0" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="权益说明" label-width="100px">
            <el-input v-model="item.description" type="textarea" :rows="2" placeholder="权益项说明" />
          </el-form-item>
        </div>
        <el-button type="primary" plain @click="addItem">+ 添加权益项</el-button>
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
import { benefitPackageApi } from '@/api/benefit-package'
import { formatDate, formatPrice } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '', status: undefined as number | undefined })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

interface ItemForm {
  id?: string
  name: string
  itemType: string
  quantity: number
  originalValue: number | undefined
  merchantPromotionSourceId: string
  pickupStoreId: string
  verifyRequired: number
  status: number
  description: string
}

const form = reactive({
  id: undefined as string | undefined,
  name: '',
  subtitle: '',
  coverImage: '',
  productId: '',
  price: undefined as number | undefined,
  validDays: undefined as number | undefined,
  validRange: [] as string[],
  sortOrder: 0,
  status: 0,
  description: '',
  items: [] as ItemForm[],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入权益包名称', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑权益包' : '新增权益包'))

function formatValid(row: any) {
  if (row.validDays) return `${row.validDays}天`
  if (row.validEndAt) return `至 ${formatDate(row.validEndAt)}`
  return '长期'
}

async function fetchList() {
  loading.value = true
  try {
    const res = await benefitPackageApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status,
    })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}
function resetSearch() {
  searchForm.keyword = ''
  searchForm.status = undefined
  handleSearch()
}

function emptyItem(): ItemForm {
  return {
    name: '',
    itemType: 'service',
    quantity: 1,
    originalValue: undefined,
    merchantPromotionSourceId: '',
    pickupStoreId: '',
    verifyRequired: 1,
    status: 1,
    description: '',
  }
}

function resetForm() {
  form.id = undefined
  form.name = ''
  form.subtitle = ''
  form.coverImage = ''
  form.productId = ''
  form.price = undefined
  form.validDays = undefined
  form.validRange = []
  form.sortOrder = 0
  form.status = 0
  form.description = ''
  form.items = []
}

function handleAdd() {
  resetForm()
  dialogVisible.value = true
}

async function handleEdit(row: any) {
  resetForm()
  try {
    const res = await benefitPackageApi.getDetail(row.id)
    const d = res.data
    form.id = d.id
    form.name = d.name || ''
    form.subtitle = d.subtitle || ''
    form.coverImage = d.coverImage || ''
    form.productId = d.productId ?? ''
    form.price = d.price
    form.validDays = d.validDays
    form.sortOrder = d.sortOrder ?? 0
    form.status = d.status ?? 0
    form.description = d.description || ''
    form.validRange = d.validStartAt && d.validEndAt
      ? [formatDate(d.validStartAt), formatDate(d.validEndAt)]
      : []
    form.items = (asArray(d.items) as any[]).map((it) => ({
      id: it.id,
      name: it.name || '',
      itemType: it.itemType || 'service',
      quantity: it.quantity ?? 1,
      originalValue: it.originalValue,
      merchantPromotionSourceId: it.merchantPromotionSourceId ?? '',
      pickupStoreId: it.pickupStoreId ?? '',
      verifyRequired: it.verifyRequired ?? 1,
      status: it.status ?? 1,
      description: it.description || '',
    }))
    dialogVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取详情失败')
  }
}

function addItem() {
  form.items.push(emptyItem())
}
function removeItem(idx: number) {
  form.items.splice(idx, 1)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: any = {
    name: form.name.trim(),
    subtitle: form.subtitle || undefined,
    coverImage: form.coverImage || undefined,
    productId: form.productId || undefined,
    price: form.price,
    validDays: form.validDays,
    validStartAt: form.validRange?.[0] || undefined,
    validEndAt: form.validRange?.[1] || undefined,
    sortOrder: form.sortOrder ?? 0,
    status: form.status,
    description: form.description || undefined,
    items: form.items.map((it) => ({
      id: it.id || undefined,
      name: it.name.trim(),
      itemType: it.itemType,
      quantity: it.quantity,
      originalValue: it.originalValue,
      merchantPromotionSourceId: it.merchantPromotionSourceId || undefined,
      pickupStoreId: it.pickupStoreId || undefined,
      verifyRequired: it.verifyRequired,
      status: it.status,
      description: it.description || undefined,
    })),
  }

  submitting.value = true
  try {
    if (form.id) {
      await benefitPackageApi.update(form.id, payload)
    } else {
      await benefitPackageApi.create(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleStatusChange(row: any) {
  const next = row.status
  const old = next === 1 ? 0 : 1
  try {
    await benefitPackageApi.updateStatus(row.id, next)
    ElMessage.success(next === 1 ? '已上架' : '已下架')
  } catch (e: any) {
    row.status = old
    ElMessage.error(e?.response?.data?.message || e?.message || '状态更新失败')
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除权益包「${row.name}」？此操作为软删除。`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await benefitPackageApi.remove(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
  }
}

fetchList()
</script>

<style scoped>
.item-block {
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafafa;
}
</style>
