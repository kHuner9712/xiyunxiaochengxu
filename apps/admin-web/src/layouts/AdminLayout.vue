<template>
  <div class="admin-layout">
    <div class="sidebar" :style="{ width: isCollapse ? '64px' : '220px' }">
      <div class="logo-container">
        <span v-if="!isCollapse" class="logo-text">禧孕商城管理后台</span>
        <span v-else class="logo-text">禧孕</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        :unique-opened="true"
        router
      >
        <template v-for="route in filteredMenuRoutes" :key="route.path">
          <el-menu-item v-if="!route.children || route.children.length === 0" :index="menuIndex(route.path)">
            <el-icon v-if="route.meta?.icon"><component :is="route.meta.icon" /></el-icon>
            <template #title>{{ route.meta?.title }}</template>
          </el-menu-item>
          <el-sub-menu v-else :index="menuIndex(route.path)">
            <template #title>
              <el-icon v-if="route.meta?.icon"><component :is="route.meta.icon" /></el-icon>
              <span>{{ route.meta?.title }}</span>
            </template>
            <el-menu-item
              v-for="child in filterChildren(route.children)"
              :key="child.path"
              :index="menuIndex(route.path, child.path)"
            >
              <template #title>{{ child.meta?.title }}</template>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>
    </div>

    <div class="main-container">
      <div class="header">
        <div class="header-left">
          <el-icon
            :size="20"
            style="cursor: pointer"
            @click="isCollapse = !isCollapse"
          >
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.meta?.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span style="cursor: pointer; display: flex; align-items: center; gap: 4px">
              <el-icon><UserFilled /></el-icon>
              {{ userStore.userInfo.username || '管理员' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="app-main">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isCollapse = ref(false)

const activeMenu = computed(() => toAbsolutePath(route.path))

const breadcrumbs = computed(() => {
  return route.matched.filter((item) => item.meta?.title)
})

const menuRoutes = computed(() => {
  const mainRoute = router.options.routes.find((r) => r.path === '/')
  return mainRoute?.children || []
})

function hasMenuPermission(route: RouteRecordRaw): boolean {
  const perm = route.meta?.permission as string | undefined
  if (!perm) return true
  return userStore.hasPermission(perm)
}

const filteredMenuRoutes = computed(() => {
  return menuRoutes.value.filter(hasMenuPermission)
})

function filterChildren(children: RouteRecordRaw[]) {
  return children.filter((child) => !child.meta?.hidden && hasMenuPermission(child))
}

function toAbsolutePath(path: string): string {
  const normalized = path.replace(/\/+/g, '/')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function menuIndex(routePath: string, childPath?: string) {
  if (childPath?.startsWith('/')) return toAbsolutePath(childPath)
  if (!childPath) return toAbsolutePath(routePath)
  return toAbsolutePath(`${routePath}/${childPath}`)
}

function handleCommand(command: string) {
  if (command === 'logout') {
    userStore.logout()
  }
}
</script>
