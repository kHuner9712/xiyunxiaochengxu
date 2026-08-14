<template>
  <div class="forbidden-page">
    <el-result
      icon="warning"
      title="无权访问"
      sub-title="当前管理员没有访问这个页面所需的权限。"
    >
      <template #extra>
        <el-button type="primary" @click="goBack">返回上一页</el-button>
        <el-button @click="goDashboard">返回工作台</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/dashboard')
}

function goDashboard() {
  router.replace('/dashboard')
}
</script>

<style scoped>
.forbidden-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
</style>
