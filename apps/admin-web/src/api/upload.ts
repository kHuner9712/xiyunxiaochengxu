import request from '@/utils/request'

export const uploadApi = {
  uploadImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/admin/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
