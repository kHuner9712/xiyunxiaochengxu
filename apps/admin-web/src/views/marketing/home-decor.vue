<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>首页装修</span>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </template>

      <el-form label-width="120px">
        <el-divider content-position="left">搜索栏配置</el-divider>
        <el-form-item label="搜索热词">
          <el-tag v-for="(tag, idx) in config.hotKeywords" :key="idx" closable @close="config.hotKeywords.splice(idx, 1)" style="margin-right: 8px">
            {{ tag }}
          </el-tag>
          <el-input v-if="keywordInputVisible" ref="keywordInputRef" v-model="keywordInput" size="small" style="width: 120px" @keyup.enter="addKeyword" @blur="addKeyword" />
          <el-button v-else size="small" @click="keywordInputVisible = true">+ 添加热词</el-button>
        </el-form-item>

        <el-divider content-position="left">Banner配置</el-divider>
        <el-form-item label="Banner设置">
          <el-button size="small" @click="router.push('/marketing/banner')">前往Banner管理</el-button>
        </el-form-item>

        <el-divider content-position="left">导航图标配置</el-divider>
        <el-table :data="config.navIcons" border size="small" style="margin-bottom: 20px; max-width: 700px">
          <el-table-column label="图标" width="100">
            <template #default="{ row }">
              <el-upload action="" :http-request="(opt: any) => handleUploadNavIcon(opt, row)" :show-file-list="false" accept="image/*">
                <el-image v-if="row.icon" :src="row.icon" style="width: 40px; height: 40px" fit="cover" />
                <el-button v-else size="small">上传</el-button>
              </el-upload>
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="跳转链接" min-width="200">
            <template #default="{ row }">
              <el-input v-model="row.linkUrl" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="排序" width="80">
            <template #default="{ row }">
              <el-input-number v-model="row.sort" size="small" :min="0" controls-position="right" />
            </template>
          </el-table-column>
          <el-table-column width="80">
            <template #default="{ $index }">
              <el-button type="danger" link @click="config.navIcons.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" @click="config.navIcons.push({ icon: '', name: '', linkUrl: '', sort: 0 })">添加导航图标</el-button>

        <el-divider content-position="left">推荐位配置</el-divider>
        <el-form-item label="推荐位设置">
          <el-button size="small" @click="router.push('/marketing/recommendation')">前往推荐位管理</el-button>
        </el-form-item>

        <el-divider content-position="left">公告配置</el-divider>
        <el-form-item label="首页公告">
          <el-input v-model="config.announcement" type="textarea" :rows="2" placeholder="请输入首页公告内容" />
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

const router = useRouter()
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
  if (keywordInput.value && !config.hotKeywords.includes(keywordInput.value)) {
    config.hotKeywords.push(keywordInput.value)
  }
  keywordInput.value = ''
  keywordInputVisible.value = false
}

async function handleUploadNavIcon(options: any, row: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    row.icon = res.data.url
  } catch {}
}

async function fetchConfig() {
  try {
    const res = await request.get('/admin/home-decor/config')
    if (res.data) {
      Object.assign(config, {
        hotKeywords: res.data.hotKeywords || [],
        navIcons: res.data.navIcons || [],
        announcement: res.data.announcement || '',
      })
    }
  } catch {}
}

async function handleSave() {
  saving.value = true
  try {
    await request.put('/admin/home-decor/config', config)
    ElMessage.success('保存成功')
  } catch {} finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>
