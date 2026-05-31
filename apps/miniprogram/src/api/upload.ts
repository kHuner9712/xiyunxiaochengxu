import { post } from '@/utils/request'

export function uploadImage(filePath: string, groupName?: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('baby_mall_token')
    uni.uploadFile({
      url: `${import.meta.env.VITE_API_BASE_URL || ''}/common/file/upload`,
      filePath,
      name: 'file',
      formData: groupName ? { groupName } : undefined,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.code === 0 || data.code === 200) {
          resolve(data.data)
        } else {
          reject(new Error(data.message || '上传失败'))
        }
      },
      fail: (err) => {
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
