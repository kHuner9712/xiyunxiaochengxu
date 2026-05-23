<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between">
        <span style="font-size: 14px; color: #909399">待发货订单列表</span>
        <el-button v-permission="'order:delivery'" type="primary" :disabled="!selectedOrders.length" @click="handleBatchDeliver">批量发货</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="userName" label="用户" width="120" />
        <el-table-column label="订单金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="收货人" width="100">
          <template #default="{ row }">{{ row.consignee }}</template>
        </el-table-column>
        <el-table-column label="收货电话" width="130">
          <template #default="{ row }">{{ row.phone }}</template>
        </el-table-column>
        <el-table-column label="收货地址" show-overflow-tooltip min-width="200">
          <template #default="{ row }">{{ row.address }}</template>
        </el-table-column>
        <el-table-column label="下单时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'order:delivery'" type="primary" link @click="handleDeliver(row)">发货</el-button>
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

    <el-dialog v-model="deliverVisible" :title="batchMode ? '批量发货' : '发货'" width="500px" destroy-on-close>
      <div v-if="batchMode">
        <p style="margin-bottom: 10px">已选择 {{ selectedOrders.length }} 个订单</p>
      </div>
      <el-form ref="deliverFormRef" :model="deliverForm" :rules="deliverRules" label-width="100px">
        <el-form-item label="物流公司" prop="logisticsCompany">
          <el-select v-model="deliverForm.logisticsCompany" placeholder="请选择物流公司" filterable>
            <el-option label="顺丰速运" value="顺丰速运" />
            <el-option label="中通快递" value="中通快递" />
            <el-option label="圆通速递" value="圆通速递" />
            <el-option label="韵达快递" value="韵达快递" />
            <el-option label="申通快递" value="申通快递" />
            <el-option label="极兔速递" value="极兔速递" />
            <el-option label="京东物流" value="京东物流" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号" prop="logisticsNo">
          <el-input v-model="deliverForm.logisticsNo" placeholder="请输入物流单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliverVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitDeliver">确认发货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi } from '@/api/order'
import { formatPrice, formatDate } from '@/utils/format'

const loading = ref(false)
const submitting = ref(false)
const deliverVisible = ref(false)
const batchMode = ref(false)
const tableData = ref<any[]>([])
const selectedOrders = ref<any[]>([])
const deliverFormRef = ref<FormInstance>()

const searchForm = reactive({ orderNo: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const deliverForm = reactive({
  orderId: undefined as number | undefined,
  logisticsCompany: '',
  logisticsNo: '',
})

const deliverRules: FormRules = {
  logisticsCompany: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
  logisticsNo: [{ required: true, message: '请输入物流单号', trigger: 'blur' }],
}

async function fetchList() {
  loading.value = true
  try {
    const res = await orderApi.getDeliveryList({ page: pagination.page, pageSize: pagination.pageSize, ...searchForm })
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '获取发货列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.orderNo = ''
  handleSearch()
}

function handleSelectionChange(rows: any[]) {
  selectedOrders.value = rows
}

function handleDeliver(row: any) {
  batchMode.value = false
  deliverForm.orderId = row.id
  deliverForm.logisticsCompany = ''
  deliverForm.logisticsNo = ''
  deliverVisible.value = true
}

function handleBatchDeliver() {
  batchMode.value = true
  deliverForm.logisticsCompany = ''
  deliverForm.logisticsNo = ''
  deliverVisible.value = true
}

async function handleSubmitDeliver() {
  const valid = await deliverFormRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    const actionText = batchMode.value ? `确认为 ${selectedOrders.value.length} 个订单批量发货？` : '确认发货？'
    await ElMessageBox.confirm(actionText, '发货确认', { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' })
  } catch {
    return
  }

  submitting.value = true
  try {
    if (batchMode.value) {
      const orders = selectedOrders.value.map((o) => ({
        orderId: o.id,
        logisticsCompany: deliverForm.logisticsCompany,
        logisticsNo: deliverForm.logisticsNo,
      }))
      await orderApi.batchDeliver({ orders })
    } else {
      await orderApi.deliver(deliverForm as any)
    }
    ElMessage.success('发货成功')
    deliverVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    submitting.value = false
  }
}

fetchList()
</script>
