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
            <el-radio value="article">文章</el-radio>
            <el-radio value="video">视频</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="封面图">
          <el-upload action="" :http-request="handleUploadCover" :show-file-list="false" accept="image/*">
            <el-image v-if="form.coverImage" :src="form.coverImage" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else size="small">上传封面</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="分类">
          <div class="category-field">
            <el-select
              v-model="form.categoryId"
              placeholder="请选择分类"
              clearable
              filterable
              :loading="categoriesLoading"
            >
              <el-option
                v-for="category in contentCategories"
                :key="category.id"
                :label="category.name"
                :value="category.id"
              />
            </el-select>
            <div v-if="!categoriesLoading && contentCategories.length === 0" class="category-hint">
              暂无可用内容分类，可留空保存
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="form.contentType === 'video'" label="视频文件" prop="videoUrl">
          <div class="video-upload-field">
            <el-upload
              action=""
              :http-request="handleUploadVideo"
              :show-file-list="false"
              :before-upload="validateVideoFile"
              :disabled="videoUploading"
              accept="video/mp4,.mp4"
            >
              <video v-if="form.videoUrl" :src="form.videoUrl" class="video-preview" controls />
              <el-button v-else size="small" :loading="videoUploading">
                {{ videoUploading ? `上传中 ${videoUploadProgress}%` : '上传本地 MP4' }}
              </el-button>
            </el-upload>
            <div class="video-upload-hint">仅支持 MP4，最大 50MB；上传完成后保存内容即可在小程序播放。</div>
            <el-button v-if="form.videoUrl" type="danger" link @click="removeVideo">移除视频</el-button>
          </div>
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

        <el-form-item
          :label="form.contentType === 'video' ? '补充说明' : '正文内容'"
          prop="content"
        >
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="10"
            :placeholder="form.contentType === 'video'
              ? '可选：填写视频补充说明（支持HTML）'
              : '请输入正文内容（支持HTML）'"
          />
          <div v-if="form.contentType === 'video'" class="content-hint">
            视频正文为选填项；上传视频文件后可直接保存。
          </div>
        </el-form-item>

        <el-form-item label="推荐">
          <el-switch v-model="form.isFeatured" :active-value="1" :inactive-value="0" />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">发布</el-radio>
            <el-radio :value="2">草稿</el-radio>
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

interface ContentCategoryOption {
  id: number
  name: string
}

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const categoriesLoading = ref(false)
const contentCategories = ref<ContentCategoryOption[]>([])
const videoUploading = ref(false)
const videoUploadProgress = ref(0)
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

const rules = computed<FormRules>(() => ({
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  contentType: [{ required: true, message: '请选择内容类型', trigger: 'change' }],
  content: form.contentType === 'article'
    ? [{ required: true, message: '文章类型内容必须填写正文内容', trigger: 'blur' }]
    : [],
  videoUrl: form.contentType === 'video'
    ? [{ required: true, message: '视频类型内容必须上传视频文件', trigger: 'change' }]
    : [],
}))

async function fetchCategories() {
  categoriesLoading.value = true
  try {
    const res = await contentApi.getCategories()
    const data = res.data || res
    contentCategories.value = Array.isArray(data)
      ? data
        .map((category: any) => ({ id: Number(category.id), name: String(category.name || '') }))
        .filter((category: ContentCategoryOption) => Number.isSafeInteger(category.id) && category.id > 0 && category.name)
      : []
  } catch {
    contentCategories.value = []
  } finally {
    categoriesLoading.value = false
  }
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
    const categoryId = data.categoryId ? Number(data.categoryId) : undefined
    if (
      categoryId
      && data.categoryName
      && !contentCategories.value.some(category => category.id === categoryId)
    ) {
      contentCategories.value.push({ id: categoryId, name: String(data.categoryName) })
    }
    Object.assign(form, {
      id: data.id,
      title: data.title,
      contentType: data.contentType || 'article',
      coverImage: data.coverImage || '',
      categoryId,
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

function validateVideoFile(file: File): boolean {
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
  if (!isMp4) {
    ElMessage.error('仅支持 MP4 视频')
    return false
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('视频不能超过 50MB')
    return false
  }
  return true
}

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : undefined
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    video.src = url
  })
}

async function handleUploadVideo(options: any) {
  if (!validateVideoFile(options.file)) return
  videoUploading.value = true
  videoUploadProgress.value = 0
  try {
    const res = await uploadApi.uploadVideo(options.file, 'content-video', (percent) => {
      videoUploadProgress.value = percent
    })
    const url = res?.data?.url || res?.data?.data?.url || ''
    if (!url) throw new Error('上传成功但未返回视频地址')
    form.videoUrl = url
    form.videoDuration = await readVideoDuration(options.file)
    options.onSuccess?.(res)
    ElMessage.success('视频上传成功')
  } catch (error) {
    options.onError?.(error)
    ElMessage.error('视频上传失败')
  } finally {
    videoUploading.value = false
  }
}

function removeVideo() {
  form.videoUrl = ''
  form.videoDuration = undefined
  videoUploadProgress.value = 0
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

onMounted(async () => {
  await fetchCategories()
  if (route.params.id) {
    await fetchDetail(Number(route.params.id))
  }
})
</script>

<style scoped>
.category-field,
.video-upload-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.category-hint,
.video-upload-hint,
.content-hint {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}

.video-preview {
  width: 360px;
  max-width: 100%;
  height: 220px;
  object-fit: contain;
  border-radius: 8px;
  background: #000;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
