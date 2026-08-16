import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AUTH_EXPIRED_EVENT, get, getToken, setToken, removeToken, redirectToLoginTab } from '@/utils/request'
import { wxLogin as wxLoginApi, logout as logoutApi, bindPhone as bindPhoneApi, updateProfile as updateProfileApi } from '@/api/auth'
import { handleShareBindOnLogin } from '@/utils/share'
import { useCartStore } from './cart'

interface UserInfo {
  id: number | string
  nickname?: string | null
  avatar?: string | null
  avatarUrl?: string | null
  phone?: string | null
  memberLevel: number
  memberLevelName: string
  points: number
}

export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const userInfo = ref<UserInfo | null>(null)
  let loginPromise: Promise<any> | null = null

  const isLoggedIn = computed(() => !!token.value)
  const nickname = computed(() => userInfo.value?.nickname || (token.value ? '微信用户' : '未登录'))
  const avatar = computed(() => userInfo.value?.avatar || userInfo.value?.avatarUrl || '')
  const phone = computed(() => userInfo.value?.phone || '')
  const isProfileComplete = computed(() => {
    const rawNickname = userInfo.value?.nickname?.trim()
    const rawAvatar = userInfo.value?.avatar || userInfo.value?.avatarUrl
    return !!(rawNickname && rawAvatar)
  })
  const memberLevel = computed(() => userInfo.value?.memberLevel || 0)
  const memberLevelName = computed(() => userInfo.value?.memberLevelName || '普通用户')
  const points = computed(() => userInfo.value?.points || 0)

  function clearLocalSession() {
    token.value = ''
    userInfo.value = null
    useCartStore().clearCart()
  }

  // request.ts owns transport-level 401 detection. Keep Pinia state synchronized with
  // persisted token removal so pages cannot remain in a stale "logged in" UI after expiry.
  const uniEventBus = uni as typeof uni & { $on?: (event: string, callback: () => void) => void }
  if (typeof uniEventBus.$on === 'function') {
    uniEventBus.$on(AUTH_EXPIRED_EVENT, clearLocalSession)
  }

  async function checkLogin() {
    const savedToken = getToken()
    if (!savedToken) {
      clearLocalSession()
      return false
    }

    token.value = savedToken
    try {
      await fetchUserInfo()
      return true
    } catch (err) {
      // 401 会由请求层同时清除持久化 token 与内存态。临时网络错误则保留登录态，
      // checkLogin 的返回值必须与 isLoggedIn 保持一致，避免弱网时调用方误判为游客。
      console.warn('[baby-mall] restore login session failed:', err)
      return !!getToken()
    }
  }

  async function fetchUserInfo() {
    try {
      const data = await get<UserInfo>('/weapp/user/info')
      userInfo.value = data
      return data
    } catch (err) {
      console.error('[baby-mall] fetchUserInfo failed after auth:', err)
      if (!getToken()) {
        clearLocalSession()
      }
      throw err
    }
  }

  async function wxLogin() {
    if (loginPromise) return loginPromise

    loginPromise = (async () => {
      const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        console.error('[baby-mall] uni.login succeeded without code:', loginRes)
        throw new Error('未获取到微信登录凭证')
      }

      const data = await wxLoginApi({ code: loginRes.code })
      if (data.token) {
        token.value = data.token
        setToken(data.token)
        await fetchUserInfo()
        try {
          await handleShareBindOnLogin()
        } catch (err) {
          console.warn('[baby-mall] bind invite after login failed:', err)
        }
      } else {
        console.error('[baby-mall] /weapp/auth/login response missing token:', data)
        throw new Error('登录结果缺少 token')
      }
      return data
    })()

    try {
      return await loginPromise
    } finally {
      loginPromise = null
    }
  }

  async function bindPhone(payload: { code: string; encryptedData?: string; iv?: string }) {
    const data = await bindPhoneApi(payload)
    await fetchUserInfo()
    return data
  }

  async function updateProfile(payload: { nickname?: string; avatar?: string; avatarUrl?: string }) {
    const data = await updateProfileApi(payload) as UserInfo
    userInfo.value = data
    return data
  }

  function logout(options: { revokeServer?: boolean } = {}) {
    const { revokeServer = true } = options
    // request() snapshots the Authorization header synchronously when logoutApi() is invoked, so
    // normal logout can revoke the server token while the UI clears immediately. Account
    // cancellation already revokes every session transactionally, so callers may skip the redundant
    // request to avoid a 401 redirect racing with the post-cancellation home navigation.
    if (revokeServer && token.value) {
      void logoutApi().catch((err) => {
        console.warn('[baby-mall] server session revoke failed during logout:', err)
      })
    }
    clearLocalSession()
    removeToken()
    uni.reLaunch({ url: '/pages/home/index' })
  }

  function requireLogin(callback: () => void) {
    if (isLoggedIn.value) {
      callback()
    } else {
      redirectToLoginTab()
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    nickname,
    avatar,
    phone,
    isProfileComplete,
    memberLevel,
    memberLevelName,
    points,
    checkLogin,
    fetchUserInfo,
    wxLogin,
    bindPhone,
    updateProfile,
    logout,
    requireLogin
  }
})