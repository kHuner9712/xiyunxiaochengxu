<template>
  <div class="page-container">
    <el-card v-loading="loading">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>首页装修</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </template>

      <el-form label-width="120px">
        <el-divider content-position="left">搜索栏配置</el-divider>
        <el-form-item label="搜索热词">
          <el-tag v-for="(tag, idx) in config.hotKeywords" :key="tag" closable @close="config.hotKeywords.splice(idx, 1)" style="margin-right: 8px">
            {{ tag }}
          </el-tag>
          <el-input
            v-if="keywordInputVisible"
            ref="keywordInputRef"
            v-model="keywordInput"
            size="small"
            maxlength="20"
            style="width: 160px"
            placeholder="最多20字"
            @keyup.enter="addKeyword"
            @blur="addKeyword"
          />
          <el-button v-else size="small" :disabled="config.hotKeywords.length >= 20" @click="keywordInputVisible = true">+ 添加热词</el-button>
          <span class="hint">最多20个，每个最多20字</span>
        </el-form-item>

        <el-divider content-position="left">Banner配置</el-divider>
        <el-form-item label="Banner设置">
          <el-button size="small" @click="router.push('/marketing/banner')">前往Banner管理</el-button>
        </el-form-item>

        <el-divider content-position="left">导航图标配置</el-divider>
        <el-alert
          type="info"
          :closable="false"
          title="跳转地址请填写 /pages/... 小程序页面路径，或 gift / discount / points / member 内置入口。"
          style="margin-bottom: 12px"
        />
        <el-table :data="config.navIcons" border size="small" style="margin-bottom: 20px; max-width: 860px">
          <el-table-column label="图标" width="100">
            <template #default="{ row }">
              <el-upload action="" :http-request="(opt: any) => handleUploadNavIcon(opt, row)" :show-file-list="false" accept="image/*">
                <el-image v-if="row.icon" :src="row.icon" style="width: 40px; height: 40px" fit="cover" />
                <el-button v-else size="small">上传</el-button>
              </el-upload>
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" maxlength="30" />
            </template>
          </el-table-column>
          <el-table-column label="跳转链接" min-width="300">
            <template #default="{ row }">
              <el-input v-model="row.linkUrl" size="small" maxlength="200" placeholder="/pages/product/list 或内置入口" />
            </template>
          </el-table-column>
          <el-table-column label="排序" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.sort" size="small" :min="0" :max="9999" controls-position="right" />
            </template>
          </el-table-column>
          <el-table-column width="80">
            <template #default="{ $index }">
              <el-button type="danger" link @click="config.navIcons.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" :disabled="config.navIcons.length >= 20" @click="config.navIcons.push({ icon: '', name: '', linkUrl: '', sort: config.navIcons.length * 10 })">添加导航图标</el-button>

        <el-divider content-position="left">推荐位配置</el-divider>
        <el-form-item label="推荐位设置">
          <el-button size="small" @click="router.push('/marketing/recommendation')">前往推荐位管理</el-button>
        </el-form-item>

        <el-divider content-position="left">公告配置</el-divider>
        <el-form-item label="首页公告">
          <el-input v-model="config.announcement" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="请输入首页公告内容" />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { uploadApi } from '@/api/upload'

const HOME_ENTRY_LINK = /^(?:\/pages\/[A-Za-z0-9_./?=&%+\-]+|gift|discount|points|member)$/
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const keywordInputVisible = ref(false)
const keywordInput = ref('')
const keywordInputRef = ref<any>()

const config = reactive({
  hotKeywords: [] as string[],
  navIcons: [] as { icon: string; name: string; linkUrl: string; sort: number }[],
  announcement: '',
})

function addKeyword() {
  const keyword = keywordInput.value.trim()
  if (!keyword) {
    keywordInput.value = ''
    keywordInputVisible.value = false
    return
  }
  if (keyword.length > 20) {
    ElMessage.warning('搜索热词最多20个字符')
    return
  }
  if (config.hotKeywords.includes(keyword)) {
    ElMessage.info('该搜索热词已存在')
  } else if (config.hotKeywords.length >= 20) {
    ElMessage.warning('搜索热词最多20个')
  } else {
    config.hotKeywords.push(keyword)
  }
  keywordInput.value = ''
  keywordInputVisible.value = false
}

async function handleUploadNavIcon(options: any, row: any) {
  try {
    const res = await uploadApi.uploadImage(options.file, 'home-decor')
    row.icon = res.data.url
    options.onSuccess?.(res)
  } catch (e: any) {
    options.onError?.(e)
    ElMessage.error(e?.message || '导航图标上传失败')
  }
}

async function fetchConfig() {
  loading.value = true
  try {
    const res = await request.get('/admin/home-decor/config')
    Object.assign(config, {
      hotKeywords: Array.isArray(res.data?.hotKeywords) ? res.data.hotKeywords : [],
      navIcons: Array.isArray(res.data?.navIcons) ? res.data.navIcons : [],
      announcement: typeof res.data?.announcement === 'string' ? res.data.announcement : '',
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '首页装修配置加载失败')
  } finally {
    loading.value = false
  }
}

function validateBeforeSave() {
  if (config.hotKeywords.length > 20) throw new Error('搜索热词最多20个')
  const normalizedKeywords = config.hotKeywords.map((item) => item.trim()).filter(Boolean)
  if (normalizedKeywords.some((item) => item.length > 20)) throw new Error('搜索热词最多20个字符')
  if (new Set(normalizedKeywords).size !== normalizedKeywords.length) throw new Error('搜索热词不能重复')
  config.hotKeywords = normalizedKeywords

  if (config.navIcons.length > 20) throw new Error('导航入口最多20个')
  config.navIcons.forEach((item, index) => {
    item.icon = item.icon.trim()
    item.name = item.name.trim()
    item.linkUrl = item.linkUrl.trim()
    if (!item.icon) throw new Error(`第${index + 1}个导航入口请先上传图标`)
    if (!item.name || item.name.length > 30) throw new Error(`第${index + 1}个导航名称无效`)
    if (!HOME_ENTRY_LINK.test(item.linkUrl)) throw new Error(`第${index + 1}个导航跳转地址无效`)
    if (!Number.isSafeInteger(item.sort) || item.sort < 0 || item.sort > 9999) throw new Error(`第${index + 1}个导航排序无效`)
  })
  config.announcement = config.announcement.trim()
}

async function handleSave() {
  try {
    validateBeforeSave()
  } catch (e: any) {
    ElMessage.warning(e?.message || '请检查首页装修配置')
    return
  }

  saving.value = true
  try {
    await request.put('/admin/home-decor/config', config)
    ElMessage.success('保存成功')
    await fetchConfig()
  } catch (e: any) {
    ElMessage.error(e?.message || '首页装修配置保存失败')
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
</style>
