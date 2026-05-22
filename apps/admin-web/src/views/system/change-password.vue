<template>
  <div class="change-password-container">
    <el-card class="change-password-card">
      <template #header>
        <div class="card-header">
          <el-icon :size="24" color="#E6A23C"><Warning /></el-icon>
          <span class="title">首次登录，请修改密码</span>
        </div>
        <p class="subtitle">为了您的账号安全，首次登录必须修改初始密码后才能使用系统功能。</p>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" @submit.prevent="handleSubmit">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入原密码" />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="至少12位，含大小写字母、数字和特殊字符" />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">确认修改</el-button>
          <el-button @click="handleLogout">退出登录</el-button>
        </el-form-item>
      </el-form>

      <div class="password-rules">
        <p>密码要求：</p>
        <ul>
          <li>长度不少于 12 位</li>
          <li>必须包含大写字母</li>
          <li>必须包含小写字母</li>
          <li>必须包含数字</li>
          <li>必须包含特殊字符（如 !@#$%^&*）</li>
          <li>新密码不能与旧密码相同</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { authApi } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const validateNewPassword = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入新密码'))
  } else if (value.length < 12) {
    callback(new Error('新密码长度不能少于12位'))
  } else if (!/[A-Z]/.test(value)) {
    callback(new Error('新密码必须包含大写字母'))
  } else if (!/[a-z]/.test(value)) {
    callback(new Error('新密码必须包含小写字母'))
  } else if (!/[0-9]/.test(value)) {
    callback(new Error('新密码必须包含数字'))
  } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
    callback(new Error('新密码必须包含特殊字符'))
  } else if (value === form.oldPassword) {
    callback(new Error('新密码不能与旧密码相同'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authApi.changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword,
    })

    ElMessage.success('密码修改成功，请妥善保管')

    await userStore.fetchUserInfo()

    if (!userStore.userInfo.mustChangePassword) {
      router.push('/dashboard')
    }
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '密码修改失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const handleLogout = () => {
  userStore.logout()
}
</script>

<style scoped lang="scss">
.change-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px;
}

.change-password-card {
  width: 520px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .subtitle {
    margin-top: 8px;
    color: #E6A23C;
    font-size: 13px;
  }
}

.password-rules {
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;

  p {
    margin: 0 0 8px;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      margin-bottom: 4px;
    }
  }
}
</style>
