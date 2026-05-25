<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑内容' : '新增内容' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width: 800px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="内容类型" prop="contentType">
          <el-radio-group v-model="form.contentType">
            <el-radio label="article">文章</el-radio>
            <el-radio label="video">视频</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="封面图">
          <el-upload action="" :http-request="handleUploadCover" :show-file-list="false" accept="image/*">
            <el-image v-if="form.coverImage" :src="form.coverImage" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else size="small">上传封面</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="分类">
          <el-select v-model="form.categoryId" placeholder="请选择分类" clearable>
            <el-option label="孕育知识" :value="1" />
            <el-option label="母婴好物" :value="2" />
            <el-option label="成长记录" :value="3" />
            <el-option label="专家问答" :value="4" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.contentType === 'video'" label="视频链接" prop="videoUrl">
          <el-input v-model="form.videoUrl" placeholder="请输入视频链接（MP4格式）" />
        </el-form-item>

        <el-form-item v-if="form.contentType === 'video'" label="视频封面">
          <el-upload action="" :http-request="handleUploadVideoCover" :show-file-list="false" accept="image/*">
            <el-image v-if="form.videoCover" :src="form.videoCover" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else size="small">上传视频封面</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item v-if="form.contentType === 'video'" label="视频时长">
          <el-input-number v-model="form.videoDuration" :min="0" placeholder="秒" />
          <span style="margin-left: 8px; color: #999">单位：秒</span>
        </el-form-item>

        <el-form-item label="投放位置">
          <el-checkbox-group v-model="form.placementList">
            <el-checkbox label="activity">活动板块</el-checkbox>
            <el-checkbox label="home">首页推荐</el-checkbox>
            <el-checkbox label="user_help">帮助中心</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="标签">
          <div class="tags-input">
            <el-tag
              v-for="tag in form.tagList"
              :key="tag"
              closable
              @close="removeTag(tag)"
              style="margin-right: 8px"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model="tagInputValue"
              size="small"
              style="width: 120px"
              @keyup.enter="addTag"
              @blur="addTag"
            />
            <el-button v-else size="small" @click="showTagInput">+ 添加标签</el-button>
          </div>
          <div style="color: #999; font-size: 12px; margin-top: 4px">最多5个标签</div>
        </el-form-item>

        <el-form-item label="关联商品">
          <el-input v-model="form.relatedProductIdsStr" placeholder="输入商品ID，多个用逗号分隔" />
          <div style="color: #999; font-size: 12px; margin-top: 4px">最多关联10个商品</div>
        </el-form-item>

        <el-form-item label="关联活动">
          <el-input-number v-model="form.relatedActivityId" :min="0" placeholder="活动ID" />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="请输入摘要" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="正文内容">
          <el-input v-model="form.content" type="textarea" :rows="10" placeholder="请输入正文内容（支持HTML）" />
        </el-form-item>

        <el-form-item label="推荐">
          <el-switch v-model="form.isFeatured" :active-value="1" :inactive-value="0" />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">发布</el-radio>
            <el-radio :label="2">草稿</el-radio>
          </el-radio-group>
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
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { contentApi } from '@/api/content'
import { uploadApi } from '@/api/upload'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const tagInputVisible = ref(false)
const tagInputValue = ref('')
const tagInputRef = ref<any>(null)

const isEdit = computed(() => !!route.params.id)

const form = reactive({
  id: undefined as number | undefined,
  title: '',
  contentType: 'article',
  coverImage: '',
  categoryId: undefined as number | undefined,
  videoUrl: '',
  videoCover: '',
  videoDuration: undefined as number | undefined,
  placementList: [] as string[],
  tagList: [] as string[],
  relatedProductIdsStr: '',
  relatedActivityId: undefined as number | undefined,
  summary: '',
  content: '',
  isFeatured: 0,
  sortOrder: 0,
  status: 2,
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  contentType: [{ required: true, message: '请选择内容类型', trigger: 'change' }],
  videoUrl: [{
    validator: (_rule: any, value: any, callback: any) => {
      if (form.contentType === 'video' && !value) {
        callback(new Error('视频类型内容必须填写视频链接'))
      } else {
        callback()
      }
    },
    trigger: 'blur'
  }],
}

function showTagInput() {
  if (form.tagList.length >= 5) {
    ElMessage.warning('最多5个标签')
    return
  }
  tagInputVisible.value = true
  nextTick(() => tagInputRef.value?.focus())
}

function addTag() {
  const tag = tagInputValue.value.trim()
  if (tag && !form.tagList.includes(tag) && form.tagList.length < 5) {
    form.tagList.push(tag)
  }
  tagInputVisible.value = false
  tagInputValue.value = ''
}

function removeTag(tag: string) {
  form.tagList = form.tagList.filter(t => t !== tag)
}

async function fetchDetail(id: number) {
  try {
    const res = await contentApi.getDetail(id)
    const data = res.data || res
    Object.assign(form, {
      id: data.id,
      title: data.title,
      contentType: data.contentType || 'article',
      coverImage: data.coverImage || '',
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      videoUrl: data.videoUrl || '',
      videoCover: data.videoCover || '',
      videoDuration: data.videoDuration,
      placementList: Array.isArray(data.placement) ? data.placement : [],
      tagList: Array.isArray(data.tags) ? data.tags : [],
      relatedProductIdsStr: Array.isArray(data.relatedProductIds) ? data.relatedProductIds.join(',') : '',
      relatedActivityId: data.relatedActivityId ? Number(data.relatedActivityId) : undefined,
      summary: data.summary || '',
      content: data.content || '',
      isFeatured: data.isFeatured ?? 0,
      sortOrder: data.sortOrder ?? 0,
      status: data.status ?? 2,
    })
  } catch {}
}

async function handleUploadCover(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.coverImage = res.data.url
  } catch {}
}

async function handleUploadVideoCover(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.videoCover = res.data.url
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const relatedProductIds = form.relatedProductIdsStr
      ? form.relatedProductIdsStr.split(',').map(Number).filter(n => !isNaN(n)).slice(0, 10)
      : null

    const payload = {
      id: form.id,
      title: form.title,
      contentType: form.contentType,
      coverImage: form.coverImage,
      categoryId: form.categoryId,
      videoUrl: form.videoUrl || undefined,
      videoCover: form.videoCover || undefined,
      videoDuration: form.videoDuration,
      placement: form.placementList.length ? form.placementList : null,
      tags: form.tagList.length ? form.tagList : null,
      relatedProductIds,
      relatedActivityId: form.relatedActivityId,
      summary: form.summary,
      content: form.content,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
      status: form.status,
    }

    if (isEdit.value) {
      await contentApi.update(payload)
    } else {
      await contentApi.create(payload)
    }
    ElMessage.success('保存成功')
    router.push('/content/list')
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

<style scoped>
.tags-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
