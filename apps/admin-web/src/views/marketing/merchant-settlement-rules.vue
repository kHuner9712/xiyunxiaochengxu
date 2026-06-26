<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="规则名称" clearable />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="searchForm.ruleType" placeholder="全部" clearable style="width: 160px">
            <el-option label="销售分佣" value="sales_referral" />
            <el-option label="服务结算" value="service_verification" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
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
        <el-button type="primary" @click="handleAdd">新增规则</el-button>
        <el-alert type="info" :closable="false" style="margin-top: 8px">
          销售分佣在订单支付成功后自动入账（订单 sourceType=merchant_referral）；服务结算在权益核销成功后自动入账。规则按 priority 降序匹配，多条命中取优先级最高的。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="name" label="规则名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.ruleType === 'sales_referral' ? 'primary' : 'success'" size="small">
              {{ row.ruleType === 'sales_referral' ? '销售分佣' : '服务结算' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="计算方式" width="120">
          <template #default="{ row }">
            {{ row.calculationType === 'percent'
              ? `比例 ${formatPercent(row.commissionRate)}`
              : `固定 ¥${formatPrice(row.commissionAmount)}` }}
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="生效时间" width="200">
          <template #default="{ row }">
            <div v-if="row.effectiveStartAt || row.effectiveEndAt">
              <div>{{ row.effectiveStartAt ? formatDate(row.effectiveStartAt) : '不限' }}</div>
              <div>至 {{ row.effectiveEndAt ? formatDate(row.effectiveEndAt) : '不限' }}</div>
            </div>
            <span v-else>长期</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="(val) => handleStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="searchForm.page"
          v-model:page-size="searchForm.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editing.id ? '编辑规则' : '新增规则'" width="720px">
      <el-form ref="formRef" :model="editing" label-width="140px">
        <el-form-item label="规则名称" required>
          <el-input v-model="editing.name" placeholder="如：A商家销售分佣10%" />
        </el-form-item>
        <el-form-item label="规则类型" required>
          <el-radio-group v-model="editing.ruleType">
            <el-radio value="sales_referral">销售分佣</el-radio>
            <el-radio value="service_verification">服务结算</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="商家推广来源ID">
          <el-input v-model="editing.merchantPromotionSourceId" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item label="自提门店ID">
          <el-input v-model="editing.pickupStoreId" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item v-if="editing.ruleType === 'service_verification'" label="权益包ID">
          <el-input v-model="editing.benefitPackageId" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item v-if="editing.ruleType === 'service_verification'" label="权益项ID">
          <el-input v-model="editing.benefitPackageItemId" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item label="计算方式" required>
          <el-radio-group v-model="editing.calculationType">
            <el-radio value="percent">比例</el-radio>
            <el-radio value="fixed_amount">固定金额</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editing.calculationType === 'percent'" label="比例（%）">
          <el-input-number
            v-model="percentInput"
            :min="0"
            :max="100"
            :precision="2"
            :step="0.5"
            @change="onPercentChange"
          />
          <span style="margin-left: 8px; color: #909399">存为 basis points（10% = 1000）</span>
        </el-form-item>
        <el-form-item v-if="editing.calculationType === 'fixed_amount'" label="固定金额（元）">
          <el-input-number
            v-model="amountInput"
            :min="0"
            :precision="2"
            :step="1"
            @change="onAmountChange"
          />
        </el-form-item>
        <el-form-item label="最低分佣（元）">
          <el-input-number
            v-model="minInput"
            :min="0"
            :precision="2"
            @change="onMinChange"
          />
        </el-form-item>
        <el-form-item label="最高分佣（元）">
          <el-input-number
            v-model="maxInput"
            :min="0"
            :precision="2"
            @change="onMaxChange"
          />
        </el-form-item>
        <el-form-item label="生效开始">
          <el-date-picker v-model="editing.effectiveStartAt" type="datetime" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item label="生效结束">
          <el-date-picker v-model="editing.effectiveEndAt" type="datetime" placeholder="留空表示不限" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="editing.priority" :min="0" :step="1" />
          <span style="margin-left: 8px; color: #909399">数字越大越优先</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editing.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editing.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { merchantSettlementApi } from '@/api/merchant-settlement'
import { formatPrice, formatDate, formatPercent } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)

const searchForm = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  ruleType: '',
  status: undefined as number | undefined,
})

const percentInput = ref(0)
const amountInput = ref(0)
const minInput = ref(0)
const maxInput = ref(0)

const editing = reactive<any>({
  id: null,
  name: '',
  ruleType: 'sales_referral',
  merchantPromotionSourceId: '',
  pickupStoreId: '',
  benefitPackageId: '',
  benefitPackageItemId: '',
  calculationType: 'percent',
  commissionRate: 0,
  commissionAmount: 0,
  minCommissionAmount: null,
  maxCommissionAmount: null,
  effectiveStartAt: null,
  effectiveEndAt: null,
  status: 1,
  priority: 0,
  remark: '',
})

function onPercentChange(val: number | undefined) {
  editing.commissionRate = Math.round((val ?? 0) * 100)
}
function onAmountChange(val: number | undefined) {
  editing.commissionAmount = Math.round((val ?? 0) * 100)
}
function onMinChange(val: number | undefined) {
  editing.minCommissionAmount = val ? Math.round(val * 100) : null
}
function onMaxChange(val: number | undefined) {
  editing.maxCommissionAmount = val ? Math.round(val * 100) : null
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await merchantSettlementApi.getRules(searchForm)
    tableData.value = asArray(res.data)
    total.value = paginationTotal(res.data)
  } catch (e) {
    // 错误已由 request 拦截器处理
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  searchForm.page = 1
  loadList()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.ruleType = ''
  searchForm.status = undefined
  searchForm.page = 1
  loadList()
}

function resetEditing() {
  Object.assign(editing, {
    id: null,
    name: '',
    ruleType: 'sales_referral',
    merchantPromotionSourceId: '',
    pickupStoreId: '',
    benefitPackageId: '',
    benefitPackageItemId: '',
    calculationType: 'percent',
    commissionRate: 0,
    commissionAmount: 0,
    minCommissionAmount: null,
    maxCommissionAmount: null,
    effectiveStartAt: null,
    effectiveEndAt: null,
    status: 1,
    priority: 0,
    remark: '',
  })
  percentInput.value = 0
  amountInput.value = 0
  minInput.value = 0
  maxInput.value = 0
}

function handleAdd() {
  resetEditing()
  dialogVisible.value = true
}

async function handleEdit(row: any) {
  resetEditing()
  const res: any = await merchantSettlementApi.getRuleDetail(row.id)
  const data = res.data || {}
  Object.assign(editing, {
    id: data.id,
    name: data.name,
    ruleType: data.ruleType,
    merchantPromotionSourceId: data.merchantPromotionSourceId ?? '',
    pickupStoreId: data.pickupStoreId ?? '',
    benefitPackageId: data.benefitPackageId ?? '',
    benefitPackageItemId: data.benefitPackageItemId ?? '',
    calculationType: data.calculationType,
    commissionRate: data.commissionRate ?? 0,
    commissionAmount: data.commissionAmount ?? 0,
    minCommissionAmount: data.minCommissionAmount,
    maxCommissionAmount: data.maxCommissionAmount,
    effectiveStartAt: data.effectiveStartAt,
    effectiveEndAt: data.effectiveEndAt,
    status: data.status,
    priority: data.priority ?? 0,
    remark: data.remark ?? '',
  })
  percentInput.value = (editing.commissionRate ?? 0) / 100
  amountInput.value = (editing.commissionAmount ?? 0) / 100
  minInput.value = editing.minCommissionAmount ? editing.minCommissionAmount / 100 : 0
  maxInput.value = editing.maxCommissionAmount ? editing.maxCommissionAmount / 100 : 0
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!editing.name) {
    ElMessage.warning('请填写规则名称')
    return
  }
  try {
    if (editing.id) {
      await merchantSettlementApi.updateRule(editing.id, { ...editing })
    } else {
      await merchantSettlementApi.createRule({ ...editing })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch (e) {
    // 错误已处理
  }
}

async function handleStatusChange(row: any, val: string | number | boolean) {
  const numVal = Number(val)
  try {
    await merchantSettlementApi.updateRuleStatus(row.id, numVal)
    ElMessage.success(numVal === 1 ? '已启用' : '已停用')
  } catch (e) {
    row.status = numVal === 1 ? 0 : 1
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除规则「${row.name}」吗？`, '提示', {
      type: 'warning',
    })
    await merchantSettlementApi.deleteRule(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch (e) {
    // 取消或错误
  }
}

onMounted(() => loadList())
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.table-card { background: #fff; padding: 16px; border-radius: 8px; }
.pagination-wrap { margin-top: 16px; text-align: right; }
</style>
