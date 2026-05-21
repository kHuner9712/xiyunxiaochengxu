import request from '@/utils/request'

export const uploadApi = {
  uploadImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/admin/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/admin/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
