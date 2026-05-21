<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>系统配置</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        </div>
      </template>

      <el-form ref="formRef" :model="form" label-width="160px" style="max-width: 700px">
        <el-divider content-position="left">基础配置</el-divider>

        <el-form-item label="商城名称">
          <el-input v-model="form.siteName" placeholder="请输入商城名称" />
        </el-form-item>

        <el-form-item label="商城Logo">
          <el-upload action="" :http-request="handleUploadLogo" :show-file-list="false" accept="image/*">
            <el-image v-if="form.siteLogo" :src="form.siteLogo" style="width: 80px; height: 80px" fit="cover" />
            <el-button v-else size="small">上传Logo</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="客服电话">
          <el-input v-model="form.servicePhone" placeholder="请输入客服电话" />
        </el-form-item>

        <el-form-item label="客服微信">
          <el-input v-model="form.serviceWechat" placeholder="请输入客服微信号" />
        </el-form-item>

        <el-divider content-position="left">订单配置</el-divider>

        <el-form-item label="自动取消时间(分钟)">
          <el-input-number v-model="form.autoCancelMinutes" :min="5" />
        </el-form-item>

        <el-form-item label="自动确认收货(天)">
          <el-input-number v-model="form.autoConfirmDays" :min="1" />
        </el-form-item>

        <el-form-item label="售后申请期限(天)">
          <el-input-number v-model="form.aftersaleDays" :min="1" />
        </el-form-item>

        <el-divider content-position="left">运费配置</el-divider>

        <el-form-item label="默认运费(元)">
          <el-input-number v-model="form.defaultFreight" :min="0" :precision="2" />
        </el-form-item>

        <el-form-item label="满额包邮(元)">
          <el-input-number v-model="form.freeShippingAmount" :min="0" :precision="2" />
        </el-form-item>

        <el-divider content-position="left">积分配置</el-divider>

        <el-form-item label="积分抵扣比例">
          <el-input-number v-model="form.pointsDiscountRate" :min="0" :max="1" :precision="2" :step="0.01" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">1积分可抵扣的金额比例</span>
        </el-form-item>

        <el-form-item label="积分抵扣上限(%)">
          <el-input-number v-model="form.pointsDiscountLimit" :min="0" :max="100" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">订单金额最多可抵扣百分比</span>
        </el-form-item>

        <el-divider content-position="left">其他配置</el-divider>

        <el-form-item label="用户协议">
          <el-input v-model="form.userAgreement" type="textarea" :rows="4" placeholder="请输入用户协议内容" />
        </el-form-item>

        <el-form-item label="隐私政策">
          <el-input v-model="form.privacyPolicy" type="textarea" :rows="4" placeholder="请输入隐私政策内容" />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api/system'
import { uploadApi } from '@/api/upload'
import { priceToFen } from '@/utils/format'

const saving = ref(false)

const form = reactive({
  siteName: '',
  siteLogo: '',
  servicePhone: '',
  serviceWechat: '',
  autoCancelMinutes: 30,
  autoConfirmDays: 15,
  aftersaleDays: 7,
  defaultFreight: 0,
  freeShippingAmount: 0,
  pointsDiscountRate: 0.01,
  pointsDiscountLimit: 30,
  userAgreement: '',
  privacyPolicy: '',
})

async function fetchConfig() {
  try {
    const res = await systemApi.getConfig()
    const d = res.data || {}
    Object.assign(form, {
      ...d,
      defaultFreight: (d.defaultFreight || 0) / 100,
      freeShippingAmount: (d.freeShippingAmount || 0) / 100,
    })
  } catch {}
}

async function handleUploadLogo(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.siteLogo = res.data.url
  } catch {}
}

async function handleSave() {
  saving.value = true
  try {
    await systemApi.updateConfig({
      ...form,
      defaultFreight: priceToFen(form.defaultFreight),
      freeShippingAmount: priceToFen(form.freeShippingAmount),
    })
    ElMessage.success('保存成功')
  } catch {} finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>
