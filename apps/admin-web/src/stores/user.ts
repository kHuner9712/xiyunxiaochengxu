import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const userInfo = ref<Record<string, any>>({})
  const permissions = ref<string[]>([])
  const roles = ref<string[]>([])

  async function login(username: string, password: string, captchaCode: string, captchaId: string) {
    const res = await authApi.login({ username, password, captchaCode, captchaId })
    token.value = res.data.token
    localStorage.setItem('token', res.data.token)
    await fetchUserInfo()
    if (userInfo.value.mustChangePassword) {
      router.push('/system/change-password')
    } else {
      router.push('/dashboard')
    }
    return res
  }

  async function fetchUserInfo() {
    const res = await authApi.getUserInfo()
    userInfo.value = res.data
    permissions.value = res.data.permissions || []
    roles.value = res.data.roles || []
    return res
  }

  function logout() {
    token.value = ''
    userInfo.value = {}
    permissions.value = []
    roles.value = []
    localStorage.removeItem('token')
    router.push('/login')
  }

  function hasPermission(permission: string): boolean {
    if (roles.value.includes('super_admin')) return true
    return permissions.value.includes(permission)
  }

  function hasAnyPermission(perms: string[]): boolean {
    if (roles.value.includes('super_admin')) return true
    return perms.some((p) => permissions.value.includes(p))
  }

  return {
    token,
    userInfo,
    permissions,
    roles,
    login,
    fetchUserInfo,
    logout,
    hasPermission,
    hasAnyPermission,
  }
})
