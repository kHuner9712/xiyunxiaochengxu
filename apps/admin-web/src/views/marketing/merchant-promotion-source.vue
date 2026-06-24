<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="商家/推广码/联系人/场景" clearable />
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
        <el-button type="primary" @click="handleAdd">新增商家推广码</el-button>
        <el-alert
          type="info"
          :closable="false"
          style="margin-top: 8px"
        >
          第一版只管理商家推广来源，不做佣金、结算和复杂权限。正式路径：pages/home/index?ref=商家码 或 pages/product/detail?id=商品ID&amp;ref=商家码
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="商家名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="promotionCode" label="推广码" width="150">
          <template #default="{ row }">
            <el-tag type="warning">{{ row.promotionCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contactName" label="联系人" width="110" />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column prop="scene" label="推广场景" width="130" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="商家名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商家名称" />
        </el-form-item>
        <el-form-item label="推广码" prop="promotionCode">
          <el-input v-model="form.promotionCode" placeholder="例如：MOUTH001" @blur="normalizePromotionCode" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contactName" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="推广场景">
          <el-input v-model="form.scene" placeholder="例如：口腔门店、摄影门店、月子中心、线下海报" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { merchantPromotionSourceApi } from '@/api/merchant-promotion-source'
import { formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()

const searchForm = reactive({
  keyword: '',
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as string | number | undefined,
  name: '',
  promotionCode: '',
  contactName: '',
  contactPhone: '',
  scene: '',
  remark: '',
  status: 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入商家名称', trigger: 'blur' }],
  promotionCode: [{ required: true, message: '请输入推广码', trigger: 'blur' }],
}

const dialogTitle = computed(() => (form.id ? '编辑商家推广码' : '新增商家推广码'))

async function fetchList() {
  loading.value = true
  try {
    const res = await merchantPromotionSourceApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status,
    })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取商家推广码列表失败')
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

function resetForm() {
  form.id = undefined
  form.name = ''
  form.promotionCode = ''
  form.contactName = ''
  form.contactPhone = ''
  form.scene = ''
  form.remark = ''
  form.status = 1
}

function handleAdd() {
  resetForm()
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.name = row.name || ''
  form.promotionCode = row.promotionCode || ''
  form.contactName = row.contactName || ''
  form.contactPhone = row.contactPhone || ''
  form.scene = row.scene || ''
  form.remark = row.remark || ''
  form.status = row.status ?? 1
  dialogVisible.value = true
}

function normalizePromotionCode() {
  form.promotionCode = String(form.promotionCode || '').trim().toUpperCase()
}

async function handleSubmit() {
  normalizePromotionCode()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      id: form.id,
      name: form.name.trim(),
      promotionCode: form.promotionCode.trim().toUpperCase(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      scene: form.scene.trim(),
      remark: form.remark.trim(),
      status: form.status,
    }

    if (form.id) {
      await merchantPromotionSourceApi.update(payload)
    } else {
      await merchantPromotionSourceApi.create(payload)
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
  const nextStatus = row.status
  const oldStatus = nextStatus === 1 ? 0 : 1

  try {
    await merchantPromotionSourceApi.updateStatus(row.id, nextStatus)
    ElMessage.success(nextStatus === 1 ? '已启用' : '已停用')
  } catch (e: any) {
    row.status = oldStatus
    ElMessage.error(e?.response?.data?.message || e?.message || '状态更新失败')
  }
}

fetchList()
</script>
