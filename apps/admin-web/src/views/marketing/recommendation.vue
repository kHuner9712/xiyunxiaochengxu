<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>推荐位管理</span>
          <el-button v-permission="'marketing:recommendation'" type="primary" @click="handleAdd">新增推荐位</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="name" label="推荐位名称" min-width="150" />
        <el-table-column prop="code" label="推荐位编码" width="160" />
        <el-table-column label="推荐类型" width="100">
          <template #default="{ row }">{{ RECOMMENDATION_TYPE_MAP[row.type] || '-' }}</template>
        </el-table-column>
        <el-table-column label="推荐项" width="90">
          <template #default="{ row }">{{ Array.isArray(row.items) ? row.items.length : 0 }}</template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'marketing:recommendation'" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'marketing:recommendation'" type="primary" link @click="handleManageItems(row)">管理推荐项</el-button>
            <el-button
              v-permission="'marketing:recommendation'"
              type="danger"
              link
              :loading="deleteBusyIds.has(String(row.id))"
              :disabled="deleteBusyIds.has(String(row.id))"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="推荐位名称" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="如：首页精选" />
        </el-form-item>
        <el-form-item label="推荐位编码" prop="code">
          <el-input v-model="form.code" maxlength="50" placeholder="如：home_featured" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="推荐类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择" style="width: 100%">
            <el-option label="商品" :value="1" />
            <el-option label="活动" :value="2" />
            <el-option label="内容" :value="3" />
          </el-select>
          <div v-if="form.id" class="hint">修改类型会清空该推荐位原有推荐项，避免跨类型脏数据。</div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialogVisible" :title="`管理推荐项 · ${currentName}`" width="760px" destroy-on-close>
      <el-alert
        :title="`当前类型：${RECOMMENDATION_TYPE_MAP[currentType] || '-'}；最多 20 项。失效或下线目标会自动从小程序首页隐藏。`"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <div style="margin-bottom: 12px">
        <el-button type="primary" size="small" :disabled="savingItems" @click="openCandidateDialog">添加推荐项</el-button>
      </div>
      <el-table :data="items" stripe size="small" row-key="targetId">
        <el-table-column prop="targetName" label="名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="targetId" label="目标ID" width="170" />
        <el-table-column label="排序" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="0" :max="9999" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ $index }">
            <el-button type="danger" link :disabled="savingItems" @click="items.splice($index, 1)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button :disabled="savingItems" @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingItems" @click="handleSaveItems">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addItemVisible" :title="`选择${RECOMMENDATION_TYPE_MAP[currentType] || ''}`" width="760px" append-to-body destroy-on-close>
      <div class="candidate-toolbar">
        <el-input
          v-model="candidateKeyword"
          clearable
          placeholder="按名称搜索"
          style="width: 280px"
          @keyup.enter="fetchCandidates"
          @clear="fetchCandidates"
        />
        <el-button type="primary" :loading="candidateLoading" @click="fetchCandidates">搜索</el-button>
      </div>
      <el-table
        :data="candidateRows"
        stripe
        v-loading="candidateLoading"
        row-key="targetId"
        @selection-change="handleCandidateSelection"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="targetName" label="名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="targetId" label="目标ID" width="170" />
        <el-table-column label="信息" min-width="180">
          <template #default="{ row }">
            <span v-if="currentType === 1">¥{{ formatPrice(row.price || 0) }} · 销量 {{ row.sales || 0 }}</span>
            <span v-else-if="currentType === 2">{{ formatDate(row.startTime) }} 至 {{ formatDate(row.endTime) }}</span>
            <span v-else>{{ row.contentType || '内容' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="candidate-total">候选共 {{ candidateTotal }} 条，本次最多展示 100 条</div>
      <template #footer>
        <el-button @click="addItemVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCandidateSelection">加入推荐位</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'
import { formatDate, formatPrice } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const RECOMMENDATION_TYPE_MAP: Record<number, string> = { 1: '商品', 2: '活动', 3: '内容' }
const POSITIVE_ID = /^[1-9]\d*$/
const loading = ref(false)
const submitting = ref(false)
const savingItems = ref(false)
const dialogVisible = ref(false)
const itemDialogVisible = ref(false)
const addItemVisible = ref(false)
const candidateLoading = ref(false)
const tableData = ref<any[]>([])
const items = ref<Array<{ targetId: string; targetName: string; sort: number }>>([])
const candidateRows = ref<any[]>([])
const candidateSelection = ref<any[]>([])
const candidateKeyword = ref('')
const candidateTotal = ref(0)
const formRef = ref<FormInstance>()
const currentId = ref('')
const currentName = ref('')
const currentType = ref(1)
const deleteBusyIds = reactive(new Set<string>())
let manageLoadSeq = 0
let candidateLoadSeq = 0

const form = reactive({
  id: '' as string,
  name: '',
  code: '',
  type: 1,
  sort: 0,
  status: 1 as 0 | 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入推荐位名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入推荐位编码', trigger: 'blur' },
    { pattern: /^[a-z0-9][a-z0-9_-]*$/, message: '编码只能包含小写字母、数字、下划线和短横线', trigger: 'blur' },
  ],
  type: [{ required: true, message: '请选择推荐类型', trigger: 'change' }],
}

const dialogTitle = computed(() => (form.id ? '编辑推荐位' : '新增推荐位'))

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get('/admin/recommendation/list', { params: { page: 1, pageSize: 100 } })
    tableData.value = asArray(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载推荐位失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  Object.assign(form, { id: '', name: '', code: '', type: 1, sort: 0, status: 1 })
  dialogVisible.value = true
}

function handleEdit(row: any) {
  Object.assign(form, {
    id: String(row.id || ''),
    name: row.name || '',
    code: row.code || '',
    type: Number(row.type || 1),
    sort: Number(row.sort || 0),
    status: row.status === 0 ? 0 : 1,
  })
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  const id = String(row.id || '')
  if (!POSITIVE_ID.test(id) || deleteBusyIds.has(id)) return
  deleteBusyIds.add(id)
  try {
    await ElMessageBox.confirm('确定删除该推荐位吗？', '提示', { type: 'warning' })
    await runSingleFlight(`admin:recommendation:delete:${id}`, () =>
      request.delete(`/admin/recommendation/delete/${id}`),
    )
    ElMessage.success('删除成功')
    await fetchList()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close' && e?.message) ElMessage.error(e.message)
  } finally {
    deleteBusyIds.delete(id)
  }
}

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      sort: form.sort,
      status: form.status,
    }
    if (form.id) {
      await runSingleFlight(`admin:recommendation:update:${form.id}`, () =>
        request.put(`/admin/recommendation/update/${form.id}`, payload),
      )
    } else {
      await runSingleFlight('admin:recommendation:create', () =>
        request.post('/admin/recommendation/create', payload),
      )
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

async function handleManageItems(row: any) {
  const id = String(row.id || '')
  if (!POSITIVE_ID.test(id)) {
    ElMessage.error('推荐位ID无效，请刷新页面后重试')
    return
  }
  const requestSeq = ++manageLoadSeq
  candidateLoadSeq += 1
  candidateLoading.value = false
  try {
    const res = await request.get(`/admin/recommendation/items/${id}`)
    if (requestSeq !== manageLoadSeq) return
    currentId.value = id
    currentName.value = row.name || ''
    currentType.value = Number(row.type || 1)
    items.value = asArray(res.data).map((item: any) => ({
      targetId: String(item.targetId || ''),
      targetName: String(item.targetName || ''),
      sort: Number(item.sort || 0),
    })).filter((item) => POSITIVE_ID.test(item.targetId))
  } catch (e: any) {
    if (requestSeq === manageLoadSeq) ElMessage.error(e?.message || '加载推荐项失败')
    return
  }
  if (requestSeq === manageLoadSeq) itemDialogVisible.value = true
}

async function openCandidateDialog() {
  candidateKeyword.value = ''
  candidateSelection.value = []
  addItemVisible.value = true
  await fetchCandidates()
}

async function fetchCandidates() {
  const recommendationId = currentId.value
  if (!recommendationId) return
  const keyword = candidateKeyword.value.trim()
  const requestSeq = ++candidateLoadSeq
  candidateLoading.value = true
  try {
    const res = await request.get(`/admin/recommendation/candidates/${recommendationId}`, {
      params: { page: 1, pageSize: 100, keyword: keyword || undefined },
    })
    if (
      requestSeq !== candidateLoadSeq ||
      recommendationId !== currentId.value ||
      keyword !== candidateKeyword.value.trim()
    ) return
    candidateRows.value = asArray(res.data)
    candidateTotal.value = paginationTotal(res.data)
  } catch (e: any) {
    if (requestSeq === candidateLoadSeq) {
      candidateRows.value = []
      candidateTotal.value = 0
      ElMessage.error(e?.message || '加载候选目标失败')
    }
  } finally {
    if (requestSeq === candidateLoadSeq) candidateLoading.value = false
  }
}

function handleCandidateSelection(rows: any[]) {
  candidateSelection.value = rows
}

function confirmCandidateSelection() {
  if (candidateSelection.value.length === 0) {
    ElMessage.warning('请选择至少一个推荐目标')
    return
  }
  const existing = new Set(items.value.map((item) => item.targetId))
  let added = 0
  for (const candidate of candidateSelection.value) {
    const targetId = String(candidate.targetId || '')
    if (!POSITIVE_ID.test(targetId) || existing.has(targetId)) continue
    if (items.value.length >= 20) break
    items.value.push({
      targetId,
      targetName: String(candidate.targetName || ''),
      sort: items.value.length * 10,
    })
    existing.add(targetId)
    added += 1
  }
  addItemVisible.value = false
  if (added === 0) ElMessage.info(items.value.length >= 20 ? '推荐项最多 20 个' : '所选目标已在推荐位中')
}

async function handleSaveItems() {
  if (savingItems.value || !currentId.value) return
  const recommendationId = currentId.value
  const payload = items.value.map((item) => ({
    targetId: item.targetId,
    sort: Number(item.sort),
  }))
  if (payload.some((item) => !POSITIVE_ID.test(item.targetId) || !Number.isInteger(item.sort) || item.sort < 0 || item.sort > 9999)) {
    ElMessage.warning('推荐项ID或排序无效')
    return
  }
  savingItems.value = true
  try {
    const res = await runSingleFlight(`admin:recommendation:items:${recommendationId}`, () =>
      request.put(`/admin/recommendation/items/${recommendationId}`, { items: payload }),
    )
    if (recommendationId !== currentId.value) return
    items.value = asArray(res.data).map((item: any) => ({
      targetId: String(item.targetId || ''),
      targetName: String(item.targetName || ''),
      sort: Number(item.sort || 0),
    }))
    ElMessage.success('推荐项保存成功')
    itemDialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存推荐项失败')
  } finally {
    savingItems.value = false
  }
}

fetchList()
</script>

<style scoped>
.hint {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}
.candidate-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.candidate-total {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
}
</style>
