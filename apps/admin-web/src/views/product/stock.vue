<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="商品名称">
          <el-input v-model="searchForm.name" placeholder="请输入商品名称" clearable />
        </el-form-item>
        <el-form-item label="库存状态">
          <el-select v-model="searchForm.stockStatus" placeholder="请选择" clearable>
            <el-option label="库存不足" value="low" />
            <el-option label="无库存" value="zero" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="商品名称" show-overflow-tooltip min-width="200" />
        <el-table-column prop="skuName" label="规格" width="150" />
        <el-table-column prop="stock" label="当前库存" width="100" />
        <el-table-column label="价格" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column label="库存状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.stock <= 0 ? 'danger' : row.stock <= 10 ? 'warning' : 'success'" size="small">
              {{ row.stock <= 0 ? '无库存' : row.stock <= 10 ? '库存不足' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'product:stock'" type="primary" link @click="handleAdjust(row)">调整库存</el-button>
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

    <el-dialog v-model="adjustVisible" title="调整库存" width="400px" destroy-on-close>
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="100px">
        <el-form-item label="商品">{{ adjustForm.productName }}</el-form-item>
        <el-form-item label="当前库存">{{ adjustForm.currentStock }}</el-form-item>
        <el-form-item label="调整类型" prop="type">
          <el-radio-group v-model="adjustForm.type">
            <el-radio value="in">入库</el-radio>
            <el-radio value="out">出库</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="调整数量" prop="quantity">
          <el-input-number v-model="adjustForm.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="adjustForm.reason" type="textarea" :rows="2" placeholder="请输入调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdjustSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-card style="margin-top: 20px">
      <template #header><span>库存调整日志</span></template>
      <el-table :data="logData" stripe size="small">
        <el-table-column prop="productName" label="商品" min-width="150" />
        <el-table-column label="调整类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'in' ? 'success' : 'danger'" size="small">{{ row.type === 'in' ? '入库' : '出库' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="beforeStock" label="调整前" width="80" />
        <el-table-column prop="afterStock" label="调整后" width="80" />
        <el-table-column prop="reason" label="原因" min-width="150" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import request from '@/utils/request'
import { formatPrice, formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const adjustVisible = ref(false)
const tableData = ref<any[]>([])
const logData = ref<any[]>([])
const adjustFormRef = ref<FormInstance>()

const searchForm = reactive({ name: '', stockStatus: undefined as string | undefined })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const adjustForm = reactive({
  productId: undefined as number | undefined,
  skuId: undefined as number | undefined,
  productName: '',
  currentStock: 0,
  type: 'in',
  quantity: 1,
  reason: '',
})

const adjustRules: FormRules = {
  type: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入调整数量', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
}

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get('/admin/stock/list', { params: { page: pagination.page, pageSize: pagination.pageSize, ...searchForm } })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch {} finally {
    loading.value = false
  }
}

async function fetchLogs() {
  try {
    const res = await request.get('/admin/stock/logs', { params: { page: 1, pageSize: 20 } })
    logData.value = asArray(res.data)
  } catch {}
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.stockStatus = undefined
  handleSearch()
}

function handleAdjust(row: any) {
  adjustForm.productId = row.productId
  adjustForm.skuId = row.skuId
  adjustForm.productName = row.name
  adjustForm.currentStock = row.stock
  adjustForm.type = 'in'
  adjustForm.quantity = 1
  adjustForm.reason = ''
  adjustVisible.value = true
}

async function handleAdjustSubmit() {
  const valid = await adjustFormRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await request.post('/admin/stock/adjust', adjustForm)
    ElMessage.success('调整成功')
    adjustVisible.value = false
    fetchList()
    fetchLogs()
  } catch {} finally {
    submitting.value = false
  }
}

fetchList()
fetchLogs()
</script>
