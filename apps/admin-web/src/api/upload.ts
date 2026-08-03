import request from '@/utils/request'

type UploadProgressHandler = (percent: number) => void

function uploadFile(file: File, groupName?: string, onProgress?: UploadProgressHandler) {
  const formData = new FormData()
  formData.append('file', file)
  if (groupName) formData.append('groupName', groupName)
  return request.post('/admin/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return
      onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)))
    },
  })
}

export const uploadApi = {
  uploadFile,
  uploadImage(file: File, groupName?: string, onProgress?: UploadProgressHandler) {
    return uploadFile(file, groupName, onProgress)
  },
  uploadVideo(file: File, groupName = 'video', onProgress?: UploadProgressHandler) {
    return uploadFile(file, groupName, onProgress)
  },
}
