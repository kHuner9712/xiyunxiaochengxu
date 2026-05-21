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

        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio :label="1">文章</el-radio>
            <el-radio :label="2">视频</el-radio>
            <el-radio :label="3">图文</el-radio>
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

        <el-form-item v-if="form.type === 2" label="视频链接">
          <el-input v-model="form.videoUrl" placeholder="请输入视频链接" />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="请输入摘要" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="正文内容">
          <el-input v-model="form.content" type="textarea" :rows="10" placeholder="请输入正文内容（支持HTML）" />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">发布</el-radio>
            <el-radio :label="0">草稿</el-radio>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { contentApi } from '@/api/content'
import { uploadApi } from '@/api/upload'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const isEdit = computed(() => !!route.params.id)

const form = reactive({
  id: undefined as number | undefined,
  title: '',
  type: 1,
  coverImage: '',
  categoryId: undefined as number | undefined,
  videoUrl: '',
  summary: '',
  content: '',
  sort: 0,
  status: 0,
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

async function fetchDetail(id: number) {
  try {
    const res = await contentApi.getDetail(id)
    Object.assign(form, res.data)
  } catch {}
}

async function handleUploadCover(options: any) {
  try {
    const res = await uploadApi.uploadImage(options.file)
    form.coverImage = res.data.url
  } catch {}
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value) {
      await contentApi.update({ ...form })
    } else {
      await contentApi.create({ ...form })
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
