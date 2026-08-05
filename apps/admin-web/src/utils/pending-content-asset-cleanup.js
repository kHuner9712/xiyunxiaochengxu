const DEFAULT_STORAGE_KEY = 'baby-mall:pending-content-asset-cleanup'
const POSITIVE_ID_PATTERN = /^[1-9]\d*$/

function normalizeId(value) {
  const id = String(value ?? '').trim()
  if (!POSITIVE_ID_PATTERN.test(id)) {
    throw new Error('待清理文件ID无效')
  }
  return id
}

function safeRead(storage, key) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]')
    return Array.isArray(parsed)
      ? parsed.map(item => String(item || '').trim()).filter(item => POSITIVE_ID_PATTERN.test(item))
      : []
  } catch {
    return []
  }
}

function safeWrite(storage, key, ids) {
  if (!storage) return
  try {
    if (ids.length === 0) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(ids))
  } catch {
    // Storage can be unavailable in privacy mode. The in-memory queue remains active.
  }
}

export class PendingContentAssetCleanupQueue {
  constructor({ deleteAsset, storage, storageKey = DEFAULT_STORAGE_KEY, shouldRetry }) {
    if (typeof deleteAsset !== 'function') {
      throw new TypeError('deleteAsset must be a function')
    }
    this.deleteAsset = deleteAsset
    this.storage = storage
    this.storageKey = storageKey
    this.shouldRetry = typeof shouldRetry === 'function' ? shouldRetry : () => true
    this.ids = new Set(safeRead(storage, storageKey))
    this.flushPromise = null
  }

  get size() {
    return this.ids.size
  }

  snapshot() {
    return [...this.ids]
  }

  remember(id) {
    const normalized = normalizeId(id)
    this.ids.add(normalized)
    this.persist()
    return normalized
  }

  forget(id) {
    const normalized = String(id ?? '').trim()
    if (!normalized) return
    this.ids.delete(normalized)
    this.persist()
  }

  async deleteNow(id) {
    const normalized = normalizeId(id)
    try {
      await this.deleteAsset(normalized)
      this.forget(normalized)
    } catch (error) {
      if (this.shouldRetry(error)) this.remember(normalized)
      else this.forget(normalized)
      throw error
    }
  }

  async flush() {
    if (this.flushPromise) return this.flushPromise

    this.flushPromise = (async () => {
      const deleted = []
      const failed = []

      for (const id of this.snapshot()) {
        try {
          await this.deleteAsset(id)
          this.forget(id)
          deleted.push(id)
        } catch (error) {
          if (this.shouldRetry(error)) {
            this.remember(id)
            failed.push(id)
          } else {
            this.forget(id)
          }
        }
      }

      return { deleted, failed }
    })()

    try {
      return await this.flushPromise
    } finally {
      this.flushPromise = null
    }
  }

  clear() {
    this.ids.clear()
    this.persist()
  }

  persist() {
    safeWrite(this.storage, this.storageKey, this.snapshot())
  }
}

export function isRetryableCleanupError(error) {
  const status = Number(error?.response?.status || 0)
  if (status === 0) return true
  if (status === 401 || status === 408 || status === 429) return true
  return status >= 500
}
