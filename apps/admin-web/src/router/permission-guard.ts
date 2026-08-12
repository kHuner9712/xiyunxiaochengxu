import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useUserStore } from '@/stores/user'

export function setupRoutePermissionGuard(router: Router, pinia: Pinia) {
  router.addRoute({
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/Forbidden.vue'),
    meta: { title: '无权访问' },
  })

  router.beforeResolve((to) => {
    if (to.path === '/403' || to.meta.requiresAuth === false) return true

    const required = typeof to.meta.permission === 'string'
      ? to.meta.permission
      : ''
    if (!required) return true

    const userStore = useUserStore(pinia)
    if (userStore.hasPermission(required)) return true

    return {
      path: '/403',
      query: { from: to.fullPath },
      replace: true,
    }
  })
}
