import request from '@/utils/request'
import {
  PendingContentAssetCleanupQueue,
  isRetryableCleanupError,
} from '@/utils/pending-content-asset-cleanup.js'

type UploadProgressHandler = (percent: number) => void

function resolveCleanupStorage() {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const cleanupQueue = new PendingContentAssetCleanupQueue({
  storage: resolveCleanupStorage(),
  shouldRetry: isRetryableCleanupError,
  deleteAsset: (id: string) => request.delete(`/admin/file/${encodeURIComponent(id)}`),
})

async function flushPendingCleanup() {
  return cleanupQueue.flush()
}

if (cleanupQueue.size > 0) {
  void flushPendingCleanup()
}

async function uploadFile(file: File, groupName?: string, onProgress?: UploadProgressHandler) {
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
  deleteFile(id: string) {
    return cleanupQueue.deleteNow(id)
  },
  flushPendingCleanup,
}
