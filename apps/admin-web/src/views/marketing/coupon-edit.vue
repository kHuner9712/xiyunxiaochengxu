<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑优惠券' : '新增优惠券' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 700px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入优惠券名称" />
        </el-form-item>

        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio :label="1">满减券</el-radio>
            <el-radio :label="2">折扣券</el-radio>
            <el-radio :label="3">无门槛券</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.type === 2" label="折扣" prop="discount">
          <el-input-number v-model="form.discount" :min="0.01" :max="0.99" :precision="2" :step="0.05" />
          <span style="margin-left: 8px; color: #909399">如0.9表示9折</span>
        </el-form-item>

        <el-form-item v-if="form.type !== 2" label="面额(元)" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" />
        </el-form-item>

        <el-form-item v-if="form.type === 1" label="使用门槛(元)" prop="minAmount">
          <el-input-number v-model="form.minAmount" :min="0" :precision="2" />
          <span style="margin-left: 8px; color: #909399">0表示无门槛</span>
        </el-form-item>

        <el-form-item label="发行量" prop="totalCount">
          <el-input-number v-model="form.totalCount" :min="1" />
        </el-form-item>

        <el-form-item label="每人限领" prop="limitPerUser">
          <el-input-number v-model="form.limitPerUser" :min="1" />
        </el-form-item>

        <el-form-item label="有效期" prop="dateRange">
          <el-date-picker v-model="form.dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入优惠券描述" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { couponApi } from '@/api/coupon'
import { priceToFen } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const isEdit = computed(() => !!route.params.id)

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  type: 1,
  amount: 0,
  discount: 0.9,
  minAmount: 0,
  totalCount: 100,
  limitPerUser: 1,
  dateRange: [] as string[],
  status: 1,
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入面额', trigger: 'blur' }],
  totalCount: [{ required: true, message: '请输入发行量', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择有效期', trigger: 'change' }],
}

async function fetchDetail(id: number) {
  try {
    const res = await couponApi.getDetail(id)
    const d = res.data
    Object.assign(form, {
      id: d.id,
      name: d.name,
      type: d.type,
      amount: d.amount / 100,
      discount: d.discount || 0.9,
      minAmount: (d.minAmount || 0) / 100,
      totalCount: d.totalCount,
      limitPerUser: d.limitPerUser,
      dateRange: [d.startTime, d.endTime],
      status: d.status,
      description: d.description || '',
    })
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!form.dateRange?.length) {
    ElMessage.warning('请选择有效期')
    return
  }

  submitting.value = true
  try {
    const data: any = {
      ...form,
      amount: priceToFen(form.amount),
      minAmount: priceToFen(form.minAmount),
      startTime: form.dateRange[0],
      endTime: form.dateRange[1],
    }
    delete data.dateRange

    if (isEdit.value) {
      await couponApi.update(data)
    } else {
      await couponApi.create(data)
    }
    ElMessage.success('保存成功')
    router.push('/marketing/coupon-list')
  } catch {} finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (route.params.id) {
    fetchDetail(Number(route.params.id))
  }
})
</script>
