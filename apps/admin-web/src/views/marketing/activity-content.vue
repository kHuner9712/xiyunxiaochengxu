<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="标题/副标题/摘要" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部" clearable style="width: 140px">
            <el-option label="图文" value="article" />
            <el-option label="视频" value="video" />
            <el-option label="商品推荐" value="product" />
          </el-select>
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
        <el-button type="primary" @click="handleAdd">新增活动内容</el-button>
        <el-alert
          type="info"
          :closable="false"
          style="margin-top: 8px"
        >
          MVP 第一版仅支持图文/视频/商品推荐三类活动内容。视频类型需填写视频地址；商品推荐类型需关联商品 ID。删除为软删除，不物理删除。
        </el-alert>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="封面" width="100">
          <template #default="{ row }">
            <el-image
              v-if="row.coverImage"
              :src="row.coverImage"
              fit="cover"
              style="width: 70px; height: 50px; border-radius: 4px"
              :preview-src-list="[row.coverImage]"
              preview-teleported
            />
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">{{ formatType(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联商品" width="120">
          <template #default="{ row }">
            <span v-if="row.linkedProductId">{{ row.linkedProductId }}</span>
            <span v-else style="color: #999">-</span>
          </template>
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
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column prop="viewCount" label="浏览量" width="90" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" placeholder="请输入副标题" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type" @change="handleTypeChange">
            <el-radio value="article">图文</el-radio>
            <el-radio value="video">视频</el-radio>
            <el-radio value="product">商品推荐</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="封面图 URL">
          <el-input v-model="form.coverImage" placeholder="请输入封面图 URL" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="请输入摘要" />
        </el-form-item>
        <el-form-item label="图文内容">
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="请输入图文内容（纯文本）" />
        </el-form-item>
        <el-form-item v-if="form.type === 'video'" label="视频 URL" prop="videoUrl">
          <el-input v-model="form.videoUrl" placeholder="请输入视频地址" />
        </el-form-item>
        <el-form-item v-if="form.type === 'product'" label="关联商品 ID" prop="linkedProductId">
          <el-input v-model="form.linkedProductId" placeholder="请输入关联商品 ID" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">上架</el-radio>
            <el-radio :value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="form.startsAt"
            type="datetime"
            placeholder="不填则不限开始时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="form.endsAt"
            type="datetime"
            placeholder="不填则不限结束时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
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
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { activityContentApi } from '@/api/activity-content'
import { formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<any[]>([])
const formRef = ref<FormInstance>()

const searchForm = reactive({
  keyword: '',
  type: '' as string,
  status: undefined as number | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: undefined as string | undefined,
  title: '',
  subtitle: '',
  type: 'article',
  coverImage: '',
  summary: '',
  content: '',
  videoUrl: '',
  linkedProductId: '',
  sortOrder: 0,
  status: 0,
  startsAt: '',
  endsAt: '',
})

const rules = computed<FormRules>(() => ({
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  videoUrl: form.type === 'video'
    ? [{ required: true, message: '视频类型必须填写视频地址', trigger: 'blur' }]
    : [],
  linkedProductId: form.type === 'product'
    ? [{ required: true, message: '商品推荐类型必须关联商品 ID', trigger: 'blur' }]
    : [],
}))

const dialogTitle = computed(() => (form.id ? '编辑活动内容' : '新增活动内容'))

async function fetchList() {
  loading.value = true
  try {
    const res = await activityContentApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      type: searchForm.type || undefined,
      status: searchForm.status,
    })
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '获取活动内容列表失败')
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
  searchForm.type = ''
  searchForm.status = undefined
  handleSearch()
}

function resetForm() {
  form.id = undefined
  form.title = ''
  form.subtitle = ''
  form.type = 'article'
  form.coverImage = ''
  form.summary = ''
  form.content = ''
  form.videoUrl = ''
  form.linkedProductId = ''
  form.sortOrder = 0
  form.status = 0
  form.startsAt = ''
  form.endsAt = ''
}

function handleAdd() {
  resetForm()
  dialogVisible.value = true
}

function handleEdit(row: any) {
  form.id = row.id
  form.title = row.title || ''
  form.subtitle = row.subtitle || ''
  form.type = row.type || 'article'
  form.coverImage = row.coverImage || ''
  form.summary = row.summary || ''
  form.content = row.content || ''
  form.videoUrl = row.videoUrl || ''
  form.linkedProductId = row.linkedProductId ? String(row.linkedProductId) : ''
  form.sortOrder = row.sortOrder ?? 0
  form.status = row.status ?? 0
  form.startsAt = row.startsAt ? formatDate(row.startsAt, 'YYYY-MM-DDTHH:mm:ss') : ''
  form.endsAt = row.endsAt ? formatDate(row.endsAt, 'YYYY-MM-DDTHH:mm:ss') : ''
  dialogVisible.value = true
}

function handleTypeChange() {
  // 类型变更时清理不相关字段，避免误提交
  if (form.type !== 'video') {
    // 保留 videoUrl 输入，不强制清空
  }
  if (form.type !== 'product') {
    // 保留 linkedProductId 输入，不强制清空
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload: any = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      type: form.type,
      coverImage: form.coverImage.trim(),
      summary: form.summary.trim(),
      content: form.content,
      videoUrl: form.videoUrl.trim(),
      linkedProductId: form.linkedProductId.trim(),
      sortOrder: form.sortOrder,
      status: form.status,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
    }

    if (form.id) {
      await activityContentApi.update(form.id, payload)
    } else {
      await activityContentApi.create(payload)
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
    await activityContentApi.updateStatus(row.id, nextStatus)
    ElMessage.success(nextStatus === 1 ? '已上架' : '已下架')
  } catch (e: any) {
    row.status = oldStatus
    ElMessage.error(e?.response?.data?.message || e?.message || '状态更新失败')
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.title}」吗？删除后小程序端不再展示。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await activityContentApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
  }
}

function formatType(type: string): string {
  if (type === 'article') return '图文'
  if (type === 'video') return '视频'
  if (type === 'product') return '商品推荐'
  return type
}

function getTypeTagType(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  if (type === 'video') return 'success'
  if (type === 'product') return 'warning'
  return 'info'
}

fetchList()
</script>
