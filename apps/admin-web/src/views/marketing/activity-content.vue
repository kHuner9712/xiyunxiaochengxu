<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="标题/摘要" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="(label, key) in TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="发布" :value="1" />
            <el-option label="草稿" :value="0" />
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
      </div>
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" show-overflow-tooltip />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ TYPE_LABELS[row.type] || row.type }}</template>
        </el-table-column>
        <el-table-column label="封面" width="100">
          <template #default="{ row }">
            <el-image v-if="row.coverImage" :src="row.coverImage" style="width: 56px; height: 40px" fit="cover" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="摘要" min-width="180" show-overflow-tooltip />
        <el-table-column label="关联商品" width="120">
          <template #default="{ row }">{{ row.linkedProductId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              :disabled="statusBusyIds.has(String(row.id))"
              active-text="发布"
              inactive-text="草稿"
              inline-prompt
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button
              type="danger"
              link
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id))"
              @click="handleDelete(row)"
            >删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" style="width: 220px">
            <el-option v-for="(label, key) in TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.coverImage" placeholder="封面图片 URL（可选）" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="form.content" type="textarea" :rows="6" maxlength="10000" show-word-limit />
        </el-form-item>
        <el-form-item label="视频地址">
          <el-input v-model="form.videoUrl" placeholder="视频 URL（类型为视频时填写）" />
        </el-form-item>
        <el-form-item label="关联商品ID">
          <el-input v-model="form.linkedProductId" placeholder="可选，必须为真实商品ID" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker
            v-model="form.startsAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="失效时间">
          <el-date-picker
            v-model="form.endsAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">发布</el-radio>
            <el-radio :value="0">草稿</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { activityContentApi, type ActivityContentItem } from '@/api/activity-content'
import { formatDate } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const TYPE_LABELS: Record<string, string> = {
  image_text: '图文',
  video: '视频',
  product_recommendation: '好物推荐',
  maternity_knowledge: '孕产知识',
  brand_story: '品牌故事',
}
const POSITIVE_ID = /^[1-9]\d*$/
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const tableData = ref<ActivityContentItem[]>([])
const formRef = ref<FormInstance>()
const statusBusyIds = reactive(new Set<string>())
const deleteBusyIds = reactive(new Set<string>())
let listLoadSeq = 0
let editLoadSeq = 0

const searchForm = reactive({ keyword: '', type: '', status: undefined as number | undefined })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  id: '' as string,
  title: '',
  subtitle: '',
  type: 'image_text',
  coverImage: '',
  summary: '',
  content: '',
  videoUrl: '',
  linkedProductId: '',
  status: 0,
  sortOrder: 0,
  startsAt: '',
  endsAt: '',
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}
const dialogTitle = computed(() => (form.id ? '编辑活动内容' : '新增活动内容'))

async function fetchList() {
  const requestSeq = ++listLoadSeq
  loading.value = true
  try {
    const res = await activityContentApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      type: searchForm.type || undefined,
      status: searchForm.status,
    })
    if (requestSeq !== listLoadSeq) return
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    if (requestSeq === listLoadSeq) ElMessage.error(e?.message || '获取活动内容失败')
  } finally {
    if (requestSeq === listLoadSeq) loading.value = false
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
  Object.assign(form, {
    id: '',
    title: '',
    subtitle: '',
    type: 'image_text',
    coverImage: '',
    summary: '',
    content: '',
    videoUrl: '',
    linkedProductId: '',
    status: 0,
    sortOrder: 0,
    startsAt: '',
    endsAt: '',
  })
}

function handleAdd() {
  editLoadSeq += 1
  resetForm()
  dialogVisible.value = true
}

async function handleEdit(row: ActivityContentItem) {
  const requestSeq = ++editLoadSeq
  resetForm()
  try {
    const res = await activityContentApi.getDetail(String(row.id))
    if (requestSeq !== editLoadSeq) return
    const d = res.data as ActivityContentItem
    Object.assign(form, {
      id: String(d.id),
      title: d.title || '',
      subtitle: d.subtitle || '',
      type: d.type || 'image_text',
      coverImage: d.coverImage || '',
      summary: d.summary || '',
      content: d.content || '',
      videoUrl: d.videoUrl || '',
      linkedProductId: d.linkedProductId || '',
      status: d.status ?? 0,
      sortOrder: d.sortOrder ?? 0,
      startsAt: d.startsAt ? formatDate(d.startsAt) : '',
      endsAt: d.endsAt ? formatDate(d.endsAt) : '',
    })
    dialogVisible.value = true
  } catch (e: any) {
    if (requestSeq === editLoadSeq) ElMessage.error(e?.message || '获取详情失败')
  }
}

function buildPayload() {
  const linkedProductId = form.linkedProductId.trim()
  if (linkedProductId && !POSITIVE_ID.test(linkedProductId)) {
    throw new Error('关联商品ID必须为有效正整数')
  }
  if (form.type === 'video' && !form.videoUrl.trim()) {
    throw new Error('视频类型必须填写视频地址')
  }
  if (form.startsAt && form.endsAt) {
    const start = new Date(form.startsAt.replace(' ', 'T'))
    const end = new Date(form.endsAt.replace(' ', 'T'))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new Error('失效时间必须晚于生效时间')
    }
  }

  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || undefined,
    type: form.type,
    coverImage: form.coverImage.trim() || undefined,
    summary: form.summary.trim() || undefined,
    content: form.content || undefined,
    videoUrl: form.videoUrl.trim() || undefined,
    linkedProductId: linkedProductId || undefined,
    status: form.status,
    sortOrder: form.sortOrder,
    startsAt: form.startsAt || undefined,
    endsAt: form.endsAt || undefined,
  }
}

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    const payload = buildPayload()
    if (form.id) {
      await activityContentApi.update(form.id, payload)
    } else {
      await activityContentApi.create(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleStatusChange(row: ActivityContentItem) {
  const id = String(row.id)
  const next = Number(row.status)
  const previous = next === 1 ? 0 : 1
  if (statusBusyIds.has(id)) {
    row.status = previous
    return
  }
  statusBusyIds.add(id)
  try {
    await activityContentApi.updateStatus(id, next)
    row.status = next
    ElMessage.success(next === 1 ? '已发布' : '已转为草稿')
  } catch (e: any) {
    row.status = previous
    ElMessage.error(e?.message || '状态更新失败')
  } finally {
    statusBusyIds.delete(id)
  }
}

async function handleDelete(row: ActivityContentItem) {
  const id = String(row.id)
  if (deleteBusyIds.has(id)) return
  deleteBusyIds.add(id)
  try {
    await ElMessageBox.confirm(`确认删除活动内容「${row.title}」？`, '提示', { type: 'warning' })
    await activityContentApi.delete(id)
    ElMessage.success('已删除')
    await fetchList()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '删除失败')
  } finally {
    deleteBusyIds.delete(id)
  }
}

fetchList()
</script>
