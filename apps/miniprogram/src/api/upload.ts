import {
  AUTH_EXPIRED_EVENT,
  getApiBaseUrl,
  getToken,
  redirectToLoginTab,
  removeToken,
} from '@/utils/request'

const UPLOAD_MODULE = '[baby-mall][upload]'
const UPLOAD_PATH = '/common/file/upload'
const AUTH_ERROR_CODES = new Set([40101, 40102, 40103])

function expireUploadSession() {
  removeToken()
  try {
    uni.$emit(AUTH_EXPIRED_EVENT)
  } catch (err) {
    console.warn(`${UPLOAD_MODULE} failed to broadcast auth expiration`, err)
  }
  redirectToLoginTab('登录已过期，请重新登录')
}

export function uploadImage(filePath: string, groupName?: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const apiBaseUrl = getApiBaseUrl()
    if (!apiBaseUrl) {
      const errMsg = 'API 地址未配置，无法上传图片'
      console.error(`${UPLOAD_MODULE} missing API base URL`)
      uni.showToast({ title: errMsg, icon: 'none', duration: 3000 })
      reject(new Error(errMsg))
      return
    }

    const token = getToken()
    uni.uploadFile({
      url: `${apiBaseUrl}${UPLOAD_PATH}`,
      filePath,
      name: 'file',
      formData: groupName ? { groupName } : undefined,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        let data: any
        try {
          data = JSON.parse(res.data)
        } catch (err) {
          console.error(`${UPLOAD_MODULE} invalid response`, {
            statusCode: res.statusCode,
            error: res.data
          })
          reject(new Error('上传响应解析失败'))
          return
        }

        const responseCode = typeof data?.code === 'number' ? data.code : undefined
        if (res.statusCode === 401 || (responseCode !== undefined && AUTH_ERROR_CODES.has(responseCode))) {
          expireUploadSession()
          reject(new Error('登录已过期，请重新登录'))
          return
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          console.error(`${UPLOAD_MODULE} HTTP failed`, {
            statusCode: res.statusCode,
            error: data?.message || data
          })
          reject(new Error(data?.message || '上传失败'))
          return
        }

        if (data.code === 0 || data.code === 200) {
          resolve(data.data)
        } else {
          console.error(`${UPLOAD_MODULE} API failed`, {
            statusCode: res.statusCode,
            code: data.code,
            error: data.message || data.data || data
          })
          reject(new Error(data.message || '上传失败'))
        }
      },
      fail: (err) => {
        console.error(`${UPLOAD_MODULE} request failed`, {
          statusCode: (err as any)?.statusCode,
          error: (err as any)?.errMsg || err
        })
        reject(err)
      }
    })
  })
}

export function chooseAndUploadImage(count = 1, groupName?: string): Promise<{ url: string }[]> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          const tempFilePaths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths]
          const uploads = tempFilePaths.map((path: string) => uploadImage(path, groupName))
          const results = await Promise.all(uploads)
          resolve(results)
        } catch (err) {
          reject(err)
        }
      },
      fail: reject
    })
  })
}
