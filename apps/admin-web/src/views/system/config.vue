<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="header-row">
          <span>系统配置</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        </div>
      </template>

      <el-alert
        title="这里的订单、运费、积分与售后配置会直接影响新的业务操作，请确认数值后再保存。"
        type="warning"
        :closable="false"
        style="margin-bottom: 18px"
      />

      <el-form ref="formRef" :model="form" label-width="180px" style="max-width: 760px">
        <el-divider content-position="left">基础配置</el-divider>

        <el-form-item label="商城名称">
          <el-input v-model="form.siteName" maxlength="80" placeholder="请输入商城名称" />
        </el-form-item>

        <el-form-item label="商城 Logo">
          <el-upload action="" :http-request="handleUploadLogo" :show-file-list="false" accept="image/*">
            <el-image v-if="form.siteLogo" :src="form.siteLogo" style="width: 80px; height: 80px" fit="cover" />
            <el-button v-else size="small">上传 Logo</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="客服电话">
          <el-input v-model="form.servicePhone" maxlength="40" placeholder="请输入客服电话" />
        </el-form-item>

        <el-divider content-position="left">订单与售后</el-divider>

        <el-form-item label="未付款自动取消(分钟)">
          <el-input-number v-model="form.autoCancelMinutes" :min="5" :max="1440" :step="5" />
        </el-form-item>

        <el-form-item label="发货后自动确认(天)">
          <el-input-number v-model="form.autoConfirmDays" :min="1" :max="365" />
        </el-form-item>

        <el-form-item label="售后申请期限(天)">
          <el-input-number v-model="form.aftersaleDays" :min="1" :max="365" />
        </el-form-item>

        <el-divider content-position="left">运费配置</el-divider>

        <el-form-item label="默认运费(元)">
          <el-input-number v-model="form.defaultFreight" :min="0" :max="100000" :precision="2" :step="1" />
        </el-form-item>

        <el-form-item label="满额包邮(元)">
          <el-input-number v-model="form.freeShippingAmount" :min="0" :max="10000000" :precision="2" :step="10" />
          <span class="hint">0 表示所有普通地区订单免基础运费；偏远地区附加规则仍按系统固定规则执行。</span>
        </el-form-item>

        <el-divider content-position="left">积分抵扣</el-divider>

        <el-form-item label="抵扣 1 元所需积分">
          <el-input-number v-model="form.pointsDeductRate" :min="1" :max="1000000" :step="10" />
          <span class="hint">例如 100 表示 100 积分抵扣 1 元。</span>
        </el-form-item>

        <el-form-item label="单笔抵扣上限(%)">
          <el-input-number v-model="form.pointsDeductLimit" :min="0" :max="100" />
          <span class="hint">订单商品金额最多可用积分抵扣的比例。</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi, type SystemConfigEntry } from '@/api/system'
import { uploadApi } from '@/api/upload'
import { priceToFen } from '@/utils/format'

const saving = ref(false)

const form = reactive({
  siteName: '',
  siteLogo: '',
  servicePhone: '',
  autoCancelMinutes: 30,
  autoConfirmDays: 15,
  aftersaleDays: 7,
  defaultFreight: 10,
  freeShippingAmount: 99,
  pointsDeductRate: 100,
  pointsDeductLimit: 30,
})

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function fetchConfig() {
  try {
    const res = await systemApi.getConfig()
    const grouped = (res.data || {}) as Record<string, Record<string, unknown>>
    form.siteName = String(grouped.basic?.shop_name ?? '')
    form.siteLogo = String(grouped.basic?.shop_logo ?? '')
    form.servicePhone = String(grouped.basic?.customer_service_phone ?? '')
    form.autoCancelMinutes = numberValue(grouped.payment?.order_auto_close_minutes, 30)
    form.autoConfirmDays = numberValue(grouped.logistics?.order_auto_complete_days, 15)
    form.aftersaleDays = numberValue(grouped.order?.aftersale_apply_days, 7)
    form.defaultFreight = numberValue(grouped.logistics?.default_freight, 1000) / 100
    form.freeShippingAmount = numberValue(grouped.logistics?.free_shipping_amount, 9900) / 100
    form.pointsDeductRate = numberValue(grouped.points?.points_deduct_rate, 100)
    form.pointsDeductLimit = numberValue(grouped.points?.points_deduct_max_percent, 30)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载系统配置失败')
  }
}

async function handleUploadLogo(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.siteLogo = res.data.url
  } catch (e: any) {
    ElMessage.error(e?.message || 'Logo 上传失败')
  }
}

function buildConfigEntries(): SystemConfigEntry[] {
  const integerRules = [
    ['自动取消时间', form.autoCancelMinutes, 5, 1440],
    ['自动确认收货天数', form.autoConfirmDays, 1, 365],
    ['售后申请期限', form.aftersaleDays, 1, 365],
    ['积分抵扣比率', form.pointsDeductRate, 1, 1000000],
    ['积分抵扣上限', form.pointsDeductLimit, 0, 100],
  ] as const
  for (const [label, value, min, max] of integerRules) {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${label}必须为 ${min}-${max} 的整数`)
    }
  }

  const defaultFreight = priceToFen(form.defaultFreight)
  const freeShippingAmount = priceToFen(form.freeShippingAmount)
  if (!Number.isSafeInteger(defaultFreight) || defaultFreight < 0) throw new Error('默认运费无效')
  if (!Number.isSafeInteger(freeShippingAmount) || freeShippingAmount < 0) throw new Error('满额包邮金额无效')

  return [
    { groupName: 'basic', configKey: 'shop_name', configValue: form.siteName.trim(), valueType: 'string' },
    { groupName: 'basic', configKey: 'shop_logo', configValue: form.siteLogo.trim(), valueType: 'string' },
    { groupName: 'basic', configKey: 'customer_service_phone', configValue: form.servicePhone.trim(), valueType: 'string' },
    { groupName: 'payment', configKey: 'order_auto_close_minutes', configValue: String(form.autoCancelMinutes), valueType: 'number' },
    { groupName: 'logistics', configKey: 'order_auto_complete_days', configValue: String(form.autoConfirmDays), valueType: 'number' },
    { groupName: 'order', configKey: 'aftersale_apply_days', configValue: String(form.aftersaleDays), valueType: 'number' },
    { groupName: 'logistics', configKey: 'default_freight', configValue: String(defaultFreight), valueType: 'number' },
    { groupName: 'logistics', configKey: 'free_shipping_amount', configValue: String(freeShippingAmount), valueType: 'number' },
    { groupName: 'points', configKey: 'points_deduct_rate', configValue: String(form.pointsDeductRate), valueType: 'number' },
    { groupName: 'points', configKey: 'points_deduct_max_percent', configValue: String(form.pointsDeductLimit), valueType: 'number' },
  ]
}

async function handleSave() {
  let configs: SystemConfigEntry[]
  try {
    configs = buildConfigEntries()
  } catch (e: any) {
    ElMessage.warning(e?.message || '请检查系统配置')
    return
  }

  saving.value = true
  try {
    await systemApi.updateConfig(configs)
    ElMessage.success('保存成功，新业务操作将使用最新配置')
    await fetchConfig()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fetchConfig)
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
