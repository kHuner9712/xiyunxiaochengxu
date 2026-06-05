import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, setToken, removeToken } from '@/utils/request'
import { wxLogin as wxLoginApi, bindPhone as bindPhoneApi, updateProfile as updateProfileApi } from '@/api/auth'

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
  const avatar = computed(() => userInfo.value?.avatar || '')
  const phone = computed(() => userInfo.value?.phone || '')
  const isProfileComplete = computed(() => {
    const rawNickname = userInfo.value?.nickname?.trim()
    const rawAvatar = userInfo.value?.avatar || userInfo.value?.avatarUrl
    return !!(rawNickname && rawAvatar)
  })
  const memberLevel = computed(() => userInfo.value?.memberLevel || 0)
  const memberLevelName = computed(() => userInfo.value?.memberLevelName || '普通用户')
  const points = computed(() => userInfo.value?.points || 0)

  function checkLogin() {
    const savedToken = uni.getStorageSync('baby_mall_token')
    if (savedToken) {
      token.value = savedToken
      fetchUserInfo()
    }
  }

  async function fetchUserInfo() {
    try {
      const data = await get<UserInfo>('/weapp/user/info')
      userInfo.value = data
    } catch (err) {
      console.error('[baby-mall] fetchUserInfo failed after auth:', err)
      token.value = ''
      userInfo.value = null
      removeToken()
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

  function logout() {
    token.value = ''
    userInfo.value = null
    removeToken()
    uni.reLaunch({ url: '/pages/home/index' })
  }

  function requireLogin(callback: () => void) {
    if (isLoggedIn.value) {
      callback()
    } else {
      uni.navigateTo({ url: '/pages/user/index?needLogin=true' })
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
