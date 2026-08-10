import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/stores/user'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const ADMIN_HTTP_TIMEOUT_MS = 30000

const request = axios.create({
  baseURL: '/api',
  timeout: ADMIN_HTTP_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<any> | null = null

function cleanQueryParams(params: unknown): unknown {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return params
  return Object.fromEntries(
    Object.entries(params as Record<string, unknown>).filter(([, value]) => {
      return value !== undefined && value !== null && value !== ''
    })
  )
}

request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    const token = userStore.accessToken || localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.params = cleanQueryParams(config.params)
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
  requestId?: string
}

interface ApiRequestError extends Error {
  apiCode: number
  requestId?: string
  response: AxiosResponse<ApiResponse>
}

function inferHttpStatusFromApiCode(code: number): number {
  if (code >= 50000 && code < 60000) return 500
  if (code >= 40900 && code < 41000) return 409
  if (code === 40501) return 429
  if (code >= 40400 && code < 40500) return 404
  if (code >= 40300 && code < 40400) return 403
  if (code >= 40100 && code < 40200) return 401
  if (code >= 40000 && code < 40100) return 400
  return 400
}

function createApiRequestError(response: AxiosResponse<ApiResponse>): ApiRequestError {
  const apiResponse = response.data
  const error = new Error(apiResponse.message || '请求失败') as ApiRequestError
  error.name = 'ApiRequestError'
  error.apiCode = apiResponse.code
  error.requestId = apiResponse.requestId
  error.response = {
    ...response,
    status: inferHttpStatusFromApiCode(apiResponse.code),
  }
  return error
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
      // Do not use the intercepted request instance here or a 401 would recurse into refresh.
      // The raw axios call still needs an explicit timeout; axios defaults to no timeout.
      const res = await axios.post('/api/admin/auth/refresh', {
        refreshToken,
      }, {
        timeout: ADMIN_HTTP_TIMEOUT_MS,
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

request.interceptors.response.use(
  async (response: AxiosResponse<ApiResponse>) => {
    const responseType = response.config?.responseType
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response as any
    }
    const res = response.data
    if (res.code !== 0) {
      const apiError = createApiRequestError(response)
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
        return Promise.reject(apiError)
      } else {
        ElMessage.error(res.message || '请求失败')
      }
      return Promise.reject(apiError)
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
          useUserStore().clearTokens()
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
export type { ApiResponse, ApiRequestError }
