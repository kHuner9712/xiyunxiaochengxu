<template>
  <div class="page-container">
    <el-card v-loading="loading">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>客服配置</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        </div>
      </template>

      <el-form ref="formRef" :model="form" label-width="160px" style="max-width: 760px">
        <el-divider content-position="left">基础配置</el-divider>

        <el-form-item label="启用客服">
          <el-switch v-model="form.enabled" active-value="true" inactive-value="false" />
        </el-form-item>

        <el-form-item label="客服类型">
          <el-radio-group v-model="form.type">
            <el-radio value="phone">电话客服</el-radio>
            <el-radio value="wechat">微信客服</el-radio>
            <el-radio value="both">电话+微信</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.type === 'phone' || form.type === 'both'" label="客服电话" :required="form.enabled === 'true'">
          <el-input v-model="form.phone" maxlength="40" placeholder="请输入客服电话" />
        </el-form-item>

        <el-form-item label="服务时间">
          <el-input v-model="form.serviceTime" maxlength="100" placeholder="如：周一至周五 9:00-18:00" />
        </el-form-item>

        <template v-if="form.type === 'wechat' || form.type === 'both'">
          <el-divider content-position="left">微信客服</el-divider>

          <el-form-item label="微信客服二维码">
            <el-upload action="" :http-request="handleUploadQrCode" :show-file-list="false" accept="image/*">
              <el-image v-if="form.wechatQrCode" :src="form.wechatQrCode" style="width: 160px; height: 160px" fit="cover" />
              <el-button v-else size="small">上传二维码</el-button>
            </el-upload>
            <div class="hint">二维码为辅助入口；小程序内“微信客服”按钮仍使用微信原生客服能力。</div>
          </el-form-item>
        </template>

        <el-divider content-position="left">内容配置</el-divider>

        <el-form-item label="自动回复文本">
          <el-input v-model="form.autoReplyText" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="客服繁忙时的自动回复" />
        </el-form-item>

        <el-form-item label="客服公告">
          <el-input v-model="form.notice" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="展示在客服页面顶部的公告" />
        </el-form-item>

        <el-divider content-position="left">常见问题</el-divider>

        <el-form-item label="常见问题">
          <div style="width: 100%">
            <div v-for="(item, index) in faqList" :key="index" class="faq-editor-item">
              <div class="faq-editor-header">
                <span>问题 {{ index + 1 }}</span>
                <el-button type="danger" link @click="removeFaq(index)">删除</el-button>
              </div>
              <el-input v-model="item.question" maxlength="200" show-word-limit placeholder="问题" style="margin-bottom: 8px" />
              <el-input v-model="item.answer" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="回答" />
            </div>
            <el-button type="primary" link :disabled="faqList.length >= 50" @click="addFaq">+ 添加问题</el-button>
            <span class="hint">最多50条；问题最多200字，回答最多2000字。</span>
          </div>
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

const loading = ref(false)
const saving = ref(false)

const form = reactive({
  enabled: 'true',
  type: 'phone' as 'phone' | 'wechat' | 'both',
  phone: '',
  wechatQrCode: '',
  serviceTime: '',
  autoReplyText: '',
  faqContent: '',
  notice: '',
})

interface FaqItem {
  question: string
  answer: string
}

const faqList = ref<FaqItem[]>([])

async function fetchConfig() {
  loading.value = true
  try {
    const res = await systemApi.getCustomerServiceConfig()
    const d = res.data || res || {}
    const type = ['phone', 'wechat', 'both'].includes(String(d.type)) ? d.type : 'phone'
    Object.assign(form, {
      enabled: d.enabled === false || d.enabled === 'false' ? 'false' : 'true',
      type,
      phone: String(d.phone || ''),
      wechatQrCode: String(d.wechatQrCode || ''),
      serviceTime: String(d.serviceTime || ''),
      autoReplyText: String(d.autoReplyText || ''),
      faqContent: String(d.faqContent || '[]'),
      notice: String(d.notice || ''),
    })
    try {
      const parsed = JSON.parse(form.faqContent || '[]')
      faqList.value = (Array.isArray(parsed) ? parsed : [])
        .map((item: any) => ({ question: String(item?.question || ''), answer: String(item?.answer || '') }))
        .filter((item) => item.question && item.answer)
        .slice(0, 50)
    } catch {
      faqList.value = []
      ElMessage.warning('历史客服FAQ格式异常，已忽略无效内容；保存后将写回规范格式')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '客服配置加载失败')
  } finally {
    loading.value = false
  }
}

async function handleUploadQrCode(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file, 'customer-service')
    form.wechatQrCode = res.data.url
    options.onSuccess?.(res)
  } catch (e: any) {
    options.onError?.(e)
    ElMessage.error(e?.message || '客服二维码上传失败')
  }
}

function addFaq() {
  if (faqList.value.length >= 50) {
    ElMessage.warning('常见问题最多50条')
    return
  }
  faqList.value.push({ question: '', answer: '' })
}

function removeFaq(index: number) {
  faqList.value.splice(index, 1)
}

function buildPayload() {
  const enabled = form.enabled === 'true'
  const phone = form.phone.trim()
  if (enabled && (form.type === 'phone' || form.type === 'both') && !phone) {
    throw new Error('启用电话客服时必须填写客服电话')
  }
  if (faqList.value.length > 50) throw new Error('常见问题最多50条')

  const normalizedFaq = faqList.value.map((item, index) => {
    const question = item.question.trim()
    const answer = item.answer.trim()
    if (!question || !answer) throw new Error(`第${index + 1}条常见问题必须同时填写问题和回答`)
    if (question.length > 200) throw new Error(`第${index + 1}条问题最多200字`)
    if (answer.length > 2000) throw new Error(`第${index + 1}条回答最多2000字`)
    return { question, answer }
  })

  return {
    enabled: String(enabled),
    type: form.type,
    phone,
    wechatQrCode: form.wechatQrCode.trim(),
    serviceTime: form.serviceTime.trim(),
    autoReplyText: form.autoReplyText.trim(),
    faqContent: JSON.stringify(normalizedFaq),
    notice: form.notice.trim(),
  }
}

async function handleSave() {
  let data
  try {
    data = buildPayload()
  } catch (e: any) {
    ElMessage.warning(e?.message || '请检查客服配置')
    return
  }

  saving.value = true
  try {
    await systemApi.updateCustomerServiceConfig(data)
    ElMessage.success('保存成功')
    await fetchConfig()
  } catch (e: any) {
    ElMessage.error(e?.message || '客服配置保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fetchConfig)
</script>

<style scoped>
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.faq-editor-item {
  margin-bottom: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
}
.faq-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}
</style>
