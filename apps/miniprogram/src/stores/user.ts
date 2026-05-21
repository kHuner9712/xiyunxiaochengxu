import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, setToken, removeToken } from '@/utils/request'
import { wxLogin as wxLoginApi, bindPhone as bindPhoneApi } from '@/api/auth'

interface UserInfo {
  id: number
  nickname: string
  avatar: string
  phone: string
  memberLevel: number
  memberLevelName: string
  points: number
}

export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const nickname = computed(() => userInfo.value?.nickname || '未登录')
  const avatar = computed(() => userInfo.value?.avatar || '')
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
      const data = await get<UserInfo>('/user/info')
      userInfo.value = data
    } catch {
      userInfo.value = null
    }
  }

  async function wxLogin() {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject
      })
    })

    const data = await wxLoginApi({ code: loginRes.code })
    if (data.token) {
      token.value = data.token
      setToken(data.token)
      await fetchUserInfo()
    }
    return data
  }

  async function bindPhone(code: string) {
    const data = await bindPhoneApi({ code })
    if (data.token) {
      token.value = data.token
      setToken(data.token)
    }
    await fetchUserInfo()
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
    memberLevel,
    memberLevelName,
    points,
    checkLogin,
    fetchUserInfo,
    wxLogin,
    bindPhone,
    logout,
    requireLogin
  }
})
