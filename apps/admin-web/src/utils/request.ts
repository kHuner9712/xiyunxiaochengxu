import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/stores/user'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<any> | null = null

request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    const token = userStore.accessToken || localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

async function handleUnauthorized() {
  const userStore = useUserStore()
  const refreshToken = userStore.refreshToken || localStorage.getItem('refreshToken')

  if (!refreshToken) {
    userStore.clearTokens()
    router.push('/login')
    return null
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const res = await axios.post('/api/admin/auth/refresh', {
        refreshToken,
      })
      if (res.data.code === 0) {
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data
        userStore.setTokens(newAccessToken, newRefreshToken)
        return { accessToken: newAccessToken, refreshToken: newRefreshToken }
      } else {
        userStore.clearTokens()
        router.push('/login')
        return null
      }
    } catch (e) {
      userStore.clearTokens()
      router.push('/login')
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function retryRequest(config: AxiosRequestConfig, newToken: string) {
  config.headers = config.headers || {}
  config.headers.Authorization = `Bearer ${newToken}`
  return request(config)
}

request.interceptors.response.use(
  async (response: AxiosResponse<ApiResponse>) => {
    const responseType = response.config?.responseType
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response as any
    }
    const res = response.data
    if (res.code !== 0) {
      if (res.code === 40101 || res.code === 40102 || res.code === 40103) {
        const originalRequest = response.config as RetryableRequestConfig
        if (originalRequest && !originalRequest._retry) {
          originalRequest._retry = true
          const newTokens = await handleUnauthorized()
          if (newTokens) {
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`
            return request(originalRequest as AxiosRequestConfig)
          }
        }
        const userStore = useUserStore()
        userStore.clearTokens()
        router.push('/login')
        return Promise.reject(new Error('登录已过期，请重新登录'))
      } else {
        ElMessage.error(res.message || '请求失败')
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res as any
  },
  async (error) => {
    if (error.response) {
      const status = error.response.status
      const originalRequest = error.config as RetryableRequestConfig

      if (status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true

        const newTokens = await handleUnauthorized()
        if (newTokens) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`
          return request(originalRequest as AxiosRequestConfig)
        }
      }

      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('token')
          router.push('/login')
          break
        case 403:
          ElMessage.error('没有权限访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          ElMessage.error(error.response.data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接异常')
    }
    return Promise.reject(error)
  }
)

export default request
export type { ApiResponse }
