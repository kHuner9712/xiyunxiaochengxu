<template>
  <div class="not-found-page">
    <div class="not-found-panel">
      <div class="status-code">404</div>
      <h1>页面不存在</h1>
      <p>当前地址没有匹配的后台页面。</p>
      <el-button type="primary" @click="router.push('/dashboard')">返回工作台</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.not-found-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: #f5f7fb;
}

.not-found-panel {
  width: min(420px, 100%);
  padding: 40px;
  text-align: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
}

.status-code {
  font-size: 56px;
  line-height: 1;
  font-weight: 700;
  color: #409eff;
}

h1 {
  margin: 16px 0 8px;
  font-size: 22px;
  color: #1f2937;
}

p {
  margin: 0 0 24px;
  color: #6b7280;
}
</style>
