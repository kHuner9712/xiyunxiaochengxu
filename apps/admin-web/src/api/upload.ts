import request from '@/utils/request'
import {
  PendingContentAssetCleanupQueue,
  isRetryableCleanupError,
} from '@/utils/pending-content-asset-cleanup.js'

type UploadProgressHandler = (percent: number) => void

const cleanupStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined
const cleanupQueue = new PendingContentAssetCleanupQueue({
  storage: cleanupStorage,
  shouldRetry: isRetryableCleanupError,
  deleteAsset: (id: string) => request.delete(`/admin/file/${id}`),
})

async function flushPendingCleanup() {
  return cleanupQueue.flush()
}

async function uploadFile(file: File, groupName?: string, onProgress?: UploadProgressHandler) {
  // A previous page unload or rollback can fail because of a transient network/server error.
  // Retry those known-unreferenced content assets before accepting another upload.
  await flushPendingCleanup()

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
  deleteFile(id: string | number) {
    return cleanupQueue.deleteNow(id)
  },
  flushPendingCleanup,
}
