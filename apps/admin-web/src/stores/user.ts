import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const accessToken = ref<string>(localStorage.getItem('accessToken') || localStorage.getItem('token') || '')
  const refreshToken = ref<string>(localStorage.getItem('refreshToken') || '')
  const userInfo = ref<Record<string, any>>({})
  const permissions = ref<string[]>([])
  const roles = ref<string[]>([])

  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem('accessToken', access)
    localStorage.setItem('refreshToken', refresh)
    if (localStorage.getItem('token')) {
      localStorage.removeItem('token')
    }
  }

  function clearTokens() {
    accessToken.value = ''
    refreshToken.value = ''
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  async function login(username: string, password: string, captchaCode: string, captchaId: string) {
    const res = await authApi.login({ username, password, captchaCode, captchaId })
    setTokens(res.data.accessToken, res.data.refreshToken)
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

  async function logout() {
    try {
      await authApi.logout()
    } catch (e) {
      // ignore
    }
    clearTokens()
    userInfo.value = {}
    permissions.value = []
    roles.value = []
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
    accessToken,
    refreshToken,
    userInfo,
    permissions,
    roles,
    setTokens,
    clearTokens,
    login,
    fetchUserInfo,
    logout,
    hasPermission,
    hasAnyPermission,
  }
})
