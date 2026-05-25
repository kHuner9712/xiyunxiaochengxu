<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>客服配置</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        </div>
      </template>

      <el-form ref="formRef" :model="form" label-width="160px" style="max-width: 700px">
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

        <el-form-item label="客服电话">
          <el-input v-model="form.phone" placeholder="请输入客服电话" />
        </el-form-item>

        <el-form-item label="服务时间">
          <el-input v-model="form.serviceTime" placeholder="如：周一至周五 9:00-18:00" />
        </el-form-item>

        <el-divider content-position="left">微信客服</el-divider>

        <el-form-item label="微信客服二维码">
          <el-upload action="" :http-request="handleUploadQrCode" :show-file-list="false" accept="image/*">
            <el-image v-if="form.wechatQrCode" :src="form.wechatQrCode" style="width: 160px; height: 160px" fit="cover" />
            <el-button v-else size="small">上传二维码</el-button>
          </el-upload>
          <div style="margin-top: 8px; color: #909399; font-size: 12px">建议上传 200x200 以上的二维码图片</div>
        </el-form-item>

        <el-divider content-position="left">内容配置</el-divider>

        <el-form-item label="自动回复文本">
          <el-input v-model="form.autoReplyText" type="textarea" :rows="3" placeholder="客服繁忙时的自动回复" />
        </el-form-item>

        <el-form-item label="客服公告">
          <el-input v-model="form.notice" type="textarea" :rows="2" placeholder="展示在客服页面顶部的公告" />
        </el-form-item>

        <el-divider content-position="left">常见问题</el-divider>

        <el-form-item label="常见问题">
          <div style="width: 100%">
            <div v-for="(item, index) in faqList" :key="index" style="margin-bottom: 16px; border: 1px solid #eee; border-radius: 8px; padding: 16px">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
                <span style="font-size: 14px; font-weight: 500">问题 {{ index + 1 }}</span>
                <el-button type="danger" link @click="removeFaq(index)">删除</el-button>
              </div>
              <el-input v-model="item.question" placeholder="问题" style="margin-bottom: 8px" />
              <el-input v-model="item.answer" type="textarea" :rows="2" placeholder="回答" />
            </div>
            <el-button type="primary" link @click="addFaq">+ 添加问题</el-button>
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

const saving = ref(false)

const form = reactive({
  enabled: 'true',
  type: 'phone',
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
  try {
    const res = await systemApi.getCustomerServiceConfig()
    const d = res.data || res || {}
    Object.assign(form, {
      enabled: String(d.enabled ?? 'true'),
      type: d.type || 'phone',
      phone: d.phone || '',
      wechatQrCode: d.wechatQrCode || '',
      serviceTime: d.serviceTime || '',
      autoReplyText: d.autoReplyText || '',
      faqContent: d.faqContent || '',
      notice: d.notice || '',
    })
    if (d.faqContent) {
      try {
        faqList.value = JSON.parse(d.faqContent)
      } catch {
        faqList.value = []
      }
    }
  } catch {}
}

async function handleUploadQrCode(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.wechatQrCode = res.data.url
  } catch {}
}

function addFaq() {
  faqList.value.push({ question: '', answer: '' })
}

function removeFaq(index: number) {
  faqList.value.splice(index, 1)
}

async function handleSave() {
  saving.value = true
  try {
    const data = {
      ...form,
      faqContent: JSON.stringify(faqList.value),
    }
    await systemApi.updateCustomerServiceConfig(data)
    ElMessage.success('保存成功')
  } catch {} finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>
