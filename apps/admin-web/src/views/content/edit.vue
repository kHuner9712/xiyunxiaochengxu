<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>{{ isEdit ? '编辑内容' : '新增内容' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width: 800px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="内容类型" prop="contentType">
          <el-radio-group v-model="form.contentType" :disabled="uploadInProgress || submitting || cancelling">
            <el-radio value="article">文章</el-radio>
            <el-radio value="video">视频</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="封面图">
          <el-upload
            action=""
            :http-request="handleUploadCover"
            :show-file-list="false"
            :disabled="uploadInProgress || submitting || cancelling"
            accept="image/*"
          >
            <el-image v-if="form.coverImage" :src="form.coverImage" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else size="small" :loading="isUploading('coverImage')">
              {{ isUploading('coverImage') ? '封面上传中…' : '上传封面' }}
            </el-button>
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
              :disabled="uploadInProgress || submitting || cancelling"
              accept="video/mp4,.mp4"
            >
              <video v-if="form.videoUrl" :src="form.videoUrl" class="video-preview" controls />
              <el-button v-else size="small" :loading="videoUploading">
                {{ videoUploading ? `上传中 ${videoUploadProgress}%` : '上传本地 MP4' }}
              </el-button>
            </el-upload>
            <div class="video-upload-hint">仅支持 MP4，最大 50MB；上传完成后保存内容即可在小程序播放。</div>
            <el-button
              v-if="form.videoUrl"
              type="danger"
              link
              :disabled="uploadInProgress || submitting || cancelling"
              @click="removeVideo"
            >移除视频</el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="form.contentType === 'video'" label="视频封面">
          <el-upload
            action=""
            :http-request="handleUploadVideoCover"
            :show-file-list="false"
            :disabled="uploadInProgress || submitting || cancelling"
            accept="image/*"
          >
            <el-image v-if="form.videoCover" :src="form.videoCover" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else size="small" :loading="isUploading('videoCover')">
              {{ isUploading('videoCover') ? '视频封面上传中…' : '上传视频封面' }}
            </el-button>
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
          <el-input
            v-model="form.relatedActivityId"
            inputmode="numeric"
            maxlength="19"
            clearable
            placeholder="活动ID"
          />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="请输入摘要" maxlength="500" show-word-limit />
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
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="uploadInProgress || cancelling"
            @click="handleSubmit"
          >{{ uploadInProgress ? '素材上传中…' : '保存' }}</el-button>
          <el-button
            :loading="cancelling"
            :disabled="submitting || uploadInProgress"
            @click="handleCancel"
          >取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { contentApi } from '@/api/content'
import { uploadApi } from '@/api/upload'

interface ContentCategoryOption {
  id: string
  name: string
}

type UploadField = 'coverImage' | 'videoUrl' | 'videoCover'

const MAX_SIGNED_BIGINT_ID = '9223372036854775807'
const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const cancelling = ref(false)
const activeUploadField = ref<UploadField | null>(null)
const categoriesLoading = ref(false)
const contentCategories = ref<ContentCategoryOption[]>([])
const videoUploading = ref(false)
const videoUploadProgress = ref(0)
const tagInputVisible = ref(false)
const tagInputValue = ref('')
const tagInputRef = ref<any>(null)
const hydrating = ref(false)
const pendingAssetIds = new Map<UploadField, string>()
let committed = false
let preservePendingAssetsOnUnmount = false
let allowNavigation = false

const isEdit = computed(() => !!route.params.id)
const uploadInProgress = computed(() => activeUploadField.value !== null)

const form = reactive({
  id: undefined as string | undefined,
  title: '',
  contentType: 'article',
  coverImage: '',
  categoryId: undefined as string | undefined,
  videoUrl: '',
  videoCover: '',
  videoDuration: undefined as number | undefined,
  placementList: [] as string[],
  tagList: [] as string[],
  relatedProductIdsStr: '',
  relatedActivityId: '',
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

function isUploading(field: UploadField) {
  return activeUploadField.value === field
}

function beginUpload(field: UploadField) {
  if (activeUploadField.value || submitting.value || cancelling.value) {
    ElMessage.warning('已有素材上传或保存操作进行中，请完成后再继续')
    return false
  }
  activeUploadField.value = field
  return true
}

function finishUpload(field: UploadField) {
  if (activeUploadField.value === field) activeUploadField.value = null
}

function isPositiveBigIntId(value: unknown): boolean {
  const normalized = String(value ?? '').trim()
  if (!/^[1-9]\d*$/.test(normalized)) return false
  return normalized.length < MAX_SIGNED_BIGINT_ID.length
    || (normalized.length === MAX_SIGNED_BIGINT_ID.length && normalized <= MAX_SIGNED_BIGINT_ID)
}

function parseRelatedProductIds(value: string): string[] | null {
  const normalized = value.trim()
  if (!normalized) return null
  const tokens = normalized.split(',').map(item => item.trim())
  if (tokens.length > 10) throw new Error('最多关联10个商品')
  if (tokens.some(item => !isPositiveBigIntId(item))) {
    throw new Error('关联商品ID必须为有效的64位正整数，多个ID请使用英文逗号分隔')
  }
  return tokens
}

function extractUploadedAsset(response: any) {
  const data = response?.data?.data || response?.data || response
  const id = String(data?.id || '')
  const url = String(data?.url || '')
  if (!isPositiveBigIntId(id) || !url) throw new Error('上传成功但未返回有效的文件ID或地址')
  return { id, url }
}

async function deletePendingAsset(field: UploadField, clearField = false): Promise<boolean> {
  const id = pendingAssetIds.get(field)
  if (id) {
    try {
      await uploadApi.deleteFile(id)
      pendingAssetIds.delete(field)
    } catch (error) {
      console.error(`[content-edit] cleanup ${field} failed`, error)
      return false
    }
  }
  if (clearField) {
    form[field] = ''
    if (field === 'videoUrl') {
      form.videoDuration = undefined
      videoUploadProgress.value = 0
    }
  }
  return true
}

async function registerPendingAsset(field: UploadField, id: string) {
  const previousId = pendingAssetIds.get(field)
  if (previousId && previousId !== id) {
    try {
      await uploadApi.deleteFile(previousId)
      pendingAssetIds.delete(field)
    } catch (error) {
      console.error(`[content-edit] replace ${field} cleanup failed`, error)
      try {
        await uploadApi.deleteFile(id)
      } catch (rollbackError) {
        console.error(`[content-edit] rollback new ${field} failed`, rollbackError)
      }
      throw new Error('旧上传文件清理失败，请稍后重试')
    }
  }
  pendingAssetIds.set(field, id)
}

async function cleanupPendingAssets(clearFields: boolean): Promise<boolean> {
  const fields = [...pendingAssetIds.keys()]
  const results = await Promise.all(fields.map((field) => deletePendingAsset(field, clearFields)))
  return results.every(Boolean)
}

async function fetchCategories() {
  categoriesLoading.value = true
  try {
    const res = await contentApi.getCategories()
    const data = res.data || res
    contentCategories.value = Array.isArray(data)
      ? data
        .map((category: any) => ({ id: String(category.id || '').trim(), name: String(category.name || '') }))
        .filter((category: ContentCategoryOption) => isPositiveBigIntId(category.id) && category.name)
      : []
  } catch (error) {
    contentCategories.value = []
    console.error('[content-edit] category loading failed', error)
    ElMessage.warning('内容分类加载失败，仍可不选择分类继续编辑')
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

async function fetchDetail(id: string) {
  hydrating.value = true
  try {
    const res = await contentApi.getDetail(id)
    const data = res.data || res
    const rawCategoryId = String(data.categoryId || '').trim()
    const categoryId = isPositiveBigIntId(rawCategoryId) ? rawCategoryId : undefined
    if (
      categoryId
      && data.categoryName
      && !contentCategories.value.some(category => category.id === categoryId)
    ) {
      contentCategories.value.push({ id: categoryId, name: String(data.categoryName) })
    }
    const rawActivityId = String(data.relatedActivityId || '').trim()
    Object.assign(form, {
      id: String(data.id),
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
      relatedActivityId: isPositiveBigIntId(rawActivityId) ? rawActivityId : '',
      summary: data.summary || '',
      content: data.content || '',
      isFeatured: data.isFeatured ?? 0,
      sortOrder: data.sortOrder ?? 0,
      status: data.status ?? 2,
    })
  } catch (error) {
    console.error('[content-edit] detail loading failed', error)
    ElMessage.error('内容详情加载失败，请返回列表重试')
  } finally {
    await nextTick()
    hydrating.value = false
  }
}

async function handleUploadCover(options: any) {
  if (!beginUpload('coverImage')) return
  try {
    const res = await uploadApi.uploadImage(options.file, 'content-cover')
    const asset = extractUploadedAsset(res)
    await registerPendingAsset('coverImage', asset.id)
    form.coverImage = asset.url
    options.onSuccess?.(res)
  } catch (error) {
    options.onError?.(error)
    console.error('[content-edit] cover upload failed', error)
    ElMessage.error('封面上传失败')
  } finally {
    finishUpload('coverImage')
  }
}

async function handleUploadVideoCover(options: any) {
  if (!beginUpload('videoCover')) return
  try {
    const res = await uploadApi.uploadImage(options.file, 'content-video-cover')
    const asset = extractUploadedAsset(res)
    await registerPendingAsset('videoCover', asset.id)
    form.videoCover = asset.url
    options.onSuccess?.(res)
  } catch (error) {
    options.onError?.(error)
    console.error('[content-edit] video cover upload failed', error)
    ElMessage.error('视频封面上传失败')
  } finally {
    finishUpload('videoCover')
  }
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
  if (!beginUpload('videoUrl')) return
  videoUploading.value = true
  videoUploadProgress.value = 0
  try {
    const res = await uploadApi.uploadVideo(options.file, 'content-video', (percent) => {
      videoUploadProgress.value = percent
    })
    const asset = extractUploadedAsset(res)
    await registerPendingAsset('videoUrl', asset.id)
    form.videoUrl = asset.url
    form.videoDuration = await readVideoDuration(options.file)
    options.onSuccess?.(res)
    ElMessage.success('视频上传成功')
  } catch (error) {
    options.onError?.(error)
    console.error('[content-edit] video upload failed', error)
    ElMessage.error('视频上传失败')
  } finally {
    videoUploading.value = false
    finishUpload('videoUrl')
  }
}

async function removeVideo() {
  if (uploadInProgress.value || submitting.value || cancelling.value) {
    ElMessage.warning('素材上传或保存操作进行中，请完成后再移除视频')
    return
  }
  const deleted = await deletePendingAsset('videoUrl', true)
  if (!deleted) {
    ElMessage.warning('视频文件清理失败，已保留当前视频，请稍后重试')
    return
  }
  form.videoUrl = ''
  form.videoDuration = undefined
  videoUploadProgress.value = 0
}

async function handleSubmit() {
  if (submitting.value || cancelling.value) return
  if (uploadInProgress.value) {
    ElMessage.warning('素材仍在上传，请等待上传完成后再保存')
    return
  }

  submitting.value = true
  preservePendingAssetsOnUnmount = false
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    let relatedProductIds: string[] | null
    try {
      relatedProductIds = parseRelatedProductIds(form.relatedProductIdsStr)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '关联商品ID无效')
      return
    }

    const relatedActivityId = form.relatedActivityId.trim()
    if (relatedActivityId && !isPositiveBigIntId(relatedActivityId)) {
      ElMessage.error('关联活动ID必须是有效的正整数')
      return
    }
    if (isEdit.value && (!form.id || !isPositiveBigIntId(form.id))) {
      ElMessage.error('内容ID无效，请返回列表重试')
      return
    }

    const payload = {
      title: form.title.trim(),
      contentType: form.contentType,
      coverImage: form.coverImage || null,
      categoryId: form.categoryId || null,
      videoUrl: form.contentType === 'video' ? form.videoUrl : null,
      videoCover: form.contentType === 'video' ? (form.videoCover || null) : null,
      videoDuration: form.contentType === 'video' ? (form.videoDuration ?? null) : null,
      placement: form.placementList.length ? form.placementList : null,
      tags: form.tagList.length ? form.tagList : null,
      relatedProductIds,
      relatedActivityId: relatedActivityId || null,
      summary: form.summary,
      content: form.content,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
      status: form.status,
    }

    if (isEdit.value) {
      await contentApi.update({ id: form.id!, ...payload })
    } else {
      await contentApi.create(payload)
    }
    committed = true
    pendingAssetIds.clear()
    allowNavigation = true
    ElMessage.success('保存成功')
    await router.push('/content/list')
  } catch (error: any) {
    console.error('[content-edit] save failed', error)
    const status = Number(error?.response?.status || 0)
    const confirmedRejected = status >= 400 && status < 500

    if (confirmedRejected && pendingAssetIds.size > 0) {
      ElMessage.warning('保存请求已被拒绝，本次新上传文件已保留，请修正后重试或点击取消清理')
    } else if (pendingAssetIds.size > 0) {
      preservePendingAssetsOnUnmount = true
      pendingAssetIds.clear()
      allowNavigation = true
      ElMessage.warning('保存结果无法确认。为避免删除可能已被引用的文件，已保留上传文件，请返回列表核实')
      await router.push('/content/list')
    }
  } finally {
    submitting.value = false
  }
}

async function handleCancel() {
  if (cancelling.value || submitting.value) return
  if (uploadInProgress.value) {
    ElMessage.warning('素材仍在上传，请等待上传完成后再取消编辑')
    return
  }

  cancelling.value = true
  try {
    const cleanupComplete = await cleanupPendingAssets(false)
    if (!cleanupComplete) {
      ElMessage.warning('部分新上传文件清理失败；将离开编辑页，并在卸载时再次尝试清理失败项')
    }
    allowNavigation = true
    router.back()
  } finally {
    cancelling.value = false
  }
}

watch(
  () => form.contentType,
  async (next, previous) => {
    if (hydrating.value || next === previous) return
    if (uploadInProgress.value || submitting.value || cancelling.value) {
      hydrating.value = true
      form.contentType = previous
      await nextTick()
      hydrating.value = false
      ElMessage.warning('素材上传或保存操作进行中，暂不能切换内容类型')
      return
    }
    if (next === 'article') {
      const videoDeleted = await deletePendingAsset('videoUrl', false)
      if (videoDeleted) {
        form.videoUrl = ''
        form.videoDuration = undefined
        videoUploadProgress.value = 0
      }

      const coverDeleted = await deletePendingAsset('videoCover', false)
      if (coverDeleted) {
        form.videoCover = ''
      }

      if (!videoDeleted || !coverDeleted) {
        hydrating.value = true
        form.contentType = previous
        await nextTick()
        hydrating.value = false
        ElMessage.warning('部分视频素材清理失败，已保留视频类型，请稍后重试')
        return
      }
    } else if (previous === 'article') {
      form.content = ''
    }
    formRef.value?.clearValidate(['content', 'videoUrl'])
  },
)

onMounted(async () => {
  await fetchCategories()
  if (route.params.id) {
    const id = String(route.params.id)
    if (!isPositiveBigIntId(id)) {
      ElMessage.error('内容ID无效')
      return
    }
    await fetchDetail(id)
  }
})

onBeforeRouteLeave(() => {
  if (!allowNavigation && (uploadInProgress.value || submitting.value || cancelling.value)) {
    ElMessage.warning('素材上传或保存操作进行中，请完成后再离开页面')
    return false
  }
  return true
})

onBeforeUnmount(() => {
  if (!committed && !preservePendingAssetsOnUnmount && pendingAssetIds.size > 0) {
    void cleanupPendingAssets(false)
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
