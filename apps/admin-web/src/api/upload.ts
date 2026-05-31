import request from '@/utils/request'

export const uploadApi = {
  uploadImage(file: File, groupName?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (groupName) formData.append('groupName', groupName)
    return request.post('/admin/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
