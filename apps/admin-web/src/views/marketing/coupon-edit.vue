<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="header-row">
          <span>{{ isEdit ? '编辑优惠券' : '新增优惠券' }}</span>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </template>

      <el-alert
        v-if="issuedLocked"
        title="该优惠券已有用户领取。面值、门槛、有效期和适用范围已锁定；如需调整，请停用旧券并新建。"
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" style="max-width: 820px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="form.name" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type" :disabled="issuedLocked" @change="onTypeChange">
            <el-radio :value="1">满减券</el-radio>
            <el-radio :value="2">折扣券</el-radio>
            <el-radio :value="3">无门槛券</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.type === 2" label="折扣" prop="discount">
          <el-input-number v-model="form.discount" :min="0.1" :max="10" :precision="1" :step="0.1" :disabled="issuedLocked" />
          <span class="hint">例如 9.0 表示 9 折</span>
        </el-form-item>
        <el-form-item v-else label="优惠金额(元)" prop="amountYuan">
          <el-input-number v-model="form.amountYuan" :min="0.01" :precision="2" :step="1" :disabled="issuedLocked" />
        </el-form-item>

        <el-form-item v-if="form.type === 1" label="使用门槛(元)" prop="minAmountYuan">
          <el-input-number v-model="form.minAmountYuan" :min="0" :precision="2" :step="10" :disabled="issuedLocked" />
        </el-form-item>
        <el-form-item v-if="form.type === 2" label="最多优惠(元)">
          <el-input-number v-model="form.discountLimitYuan" :min="0" :precision="2" :step="10" :disabled="issuedLocked" />
          <span class="hint">0 表示不限制</span>
        </el-form-item>

        <el-form-item label="发行量" prop="totalCount">
          <el-input-number v-model="form.totalCount" :min="0" :step="100" />
          <span class="hint">0 表示不限总量；已领取 {{ receivedCount }} 张</span>
        </el-form-item>
        <el-form-item label="每人限领" prop="perLimit">
          <el-input-number v-model="form.perLimit" :min="1" :step="1" />
        </el-form-item>

        <el-form-item label="领取有效期" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            :disabled="issuedLocked"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="领取后有效天数">
          <el-input-number v-model="form.validDays" :min="0" :step="1" :disabled="issuedLocked" />
          <span class="hint">0 表示有效至活动结束时间</span>
        </el-form-item>

        <el-form-item label="适用范围">
          <el-select v-model="form.applicableType" :disabled="issuedLocked" style="width: 220px">
            <el-option label="全部商品" :value="0" />
            <el-option label="指定分类" :value="1" />
            <el-option label="指定商品" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.applicableType !== 0" :label="form.applicableType === 1 ? '分类ID' : '商品ID'">
          <el-input
            v-model="form.applicableIdsText"
            :disabled="issuedLocked"
            placeholder="多个 ID 使用英文逗号分隔，例如 12,15,18"
          />
          <div class="hint block">ID 按字符串处理，避免 BIGINT 精度丢失。</div>
        </el-form-item>

        <el-form-item label="仅新用户">
          <el-switch v-model="form.isNewUser" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="使用说明">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { couponApi, type CouponPayload, type CouponRecord } from '@/api/coupon'

const POSITIVE_ID = /^[1-9]\d*$/
const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const receivedCount = ref(0)

const couponId = computed(() => String(route.params.id || '').trim())
const isEdit = computed(() => POSITIVE_ID.test(couponId.value))
const issuedLocked = computed(() => isEdit.value && receivedCount.value > 0)

const form = reactive({
  name: '',
  type: 1 as 1 | 2 | 3,
  amountYuan: 10,
  discount: 9,
  minAmountYuan: 0,
  discountLimitYuan: 0,
  totalCount: 100,
  perLimit: 1,
  dateRange: [] as string[],
  validDays: 0,
  applicableType: 0 as 0 | 1 | 2,
  applicableIdsText: '',
  description: '',
  isNewUser: false,
  status: 1 as 0 | 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  totalCount: [{ required: true, message: '请输入发行量', trigger: 'blur' }],
  perLimit: [{ required: true, message: '请输入每人限领数量', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择有效期', trigger: 'change' }],
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toLocalPicker(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function localPickerToIso(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) throw new Error('优惠券时间格式无效')
  return date.toISOString()
}

function yuanToFen(value: number) {
  const fen = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(fen) || fen < 0) throw new Error('金额无效')
  return fen
}

function parseApplicableIds() {
  if (form.applicableType === 0) return []
  const ids = form.applicableIdsText.split(',').map(item => item.trim()).filter(Boolean)
  if (ids.length === 0 || ids.some(id => !POSITIVE_ID.test(id) || id.length > 19)) {
    throw new Error(form.applicableType === 1 ? '请输入有效的分类ID' : '请输入有效的商品ID')
  }
  return Array.from(new Set(ids))
}

function onTypeChange() {
  if (form.type === 3) form.minAmountYuan = 0
}

async function fetchDetail() {
  if (!isEdit.value) return
  try {
    const res = await couponApi.getDetail(couponId.value)
    const d = res.data as CouponRecord
    receivedCount.value = Number(d.receivedCount || 0)
    form.name = d.name || ''
    form.type = ([1, 2, 3].includes(Number(d.type)) ? Number(d.type) : 1) as 1 | 2 | 3
    if (form.type === 2) {
      form.discount = Number(d.value || 0) / 10
      form.amountYuan = 0
    } else {
      form.amountYuan = Number(d.value || 0) / 100
    }
    form.minAmountYuan = Number(d.minAmount || 0) / 100
    form.discountLimitYuan = Number(d.discountLimit || 0) / 100
    form.totalCount = Number(d.totalCount || 0)
    form.perLimit = Number(d.perLimit || 1)
    form.dateRange = [toLocalPicker(d.startTime), toLocalPicker(d.endTime)]
    form.validDays = Number(d.validDays || 0)
    form.applicableType = ([0, 1, 2].includes(Number(d.applicableType)) ? Number(d.applicableType) : 0) as 0 | 1 | 2
    form.applicableIdsText = Array.isArray(d.applicableIds) ? d.applicableIds.join(',') : ''
    form.description = d.description || ''
    form.isNewUser = d.isNewUser === 1
    form.status = d.status === 0 ? 0 : 1
  } catch (e: any) {
    ElMessage.error(e?.message || '加载优惠券失败')
  }
}

function buildPayload(): CouponPayload {
  const name = form.name.trim()
  if (!name) throw new Error('请输入优惠券名称')
  if (!Array.isArray(form.dateRange) || form.dateRange.length !== 2) throw new Error('请选择完整有效期')
  const startTime = localPickerToIso(form.dateRange[0])
  const endTime = localPickerToIso(form.dateRange[1])
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) throw new Error('结束时间必须晚于开始时间')

  const value = form.type === 2 ? Math.round(Number(form.discount) * 10) : yuanToFen(form.amountYuan)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('优惠值必须大于0')
  if (form.type === 2 && (value < 1 || value > 100)) throw new Error('折扣必须在0.1折到10折之间')
  if (!Number.isInteger(form.totalCount) || form.totalCount < 0) throw new Error('发行数量无效')
  if (!Number.isInteger(form.perLimit) || form.perLimit < 1) throw new Error('每人限领数量无效')
  if (!Number.isInteger(form.validDays) || form.validDays < 0) throw new Error('有效天数无效')

  return {
    name,
    type: form.type,
    value,
    minAmount: form.type === 1 ? yuanToFen(form.minAmountYuan) : 0,
    discountLimit: form.type === 2 ? yuanToFen(form.discountLimitYuan) : 0,
    totalCount: form.totalCount,
    perLimit: form.perLimit,
    startTime,
    endTime,
    validDays: form.validDays,
    applicableType: form.applicableType,
    applicableIds: parseApplicableIds(),
    description: form.description.trim(),
    isNewUser: form.isNewUser ? 1 : 0,
    status: form.status,
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  let data: CouponPayload
  try {
    data = buildPayload()
  } catch (e: any) {
    ElMessage.warning(e?.message || '请检查优惠券配置')
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await couponApi.update(couponId.value, data)
    } else {
      await couponApi.create(data)
    }
    ElMessage.success('保存成功')
    router.push('/marketing/coupon-list')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(fetchDetail)
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.hint.block {
  display: block;
  margin-left: 0;
  margin-top: 4px;
}
</style>
