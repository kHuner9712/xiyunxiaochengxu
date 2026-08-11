const CHECKOUT_IDEMPOTENCY_TTL_MS = 2 * 60 * 60 * 1000
const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i
const STORAGE_PREFIX = 'baby_mall_pending_promotion_checkout:'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
  return `{${entries.join(',')}}`
}

function generateClientRequestId() {
  const random = [
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('').replace(/[^a-z0-9]/gi, '').padEnd(24, '0').slice(0, 24)
  return `${Date.now()}-${random}`
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`
}

function loadPending(scope: string, fingerprint: string): string | null {
  const key = storageKey(scope)
  try {
    const raw = uni.getStorageSync(key)
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    const clientRequestId = String(value?.clientRequestId || '')
    const storedFingerprint = String(value?.fingerprint || '')
    const createdAt = Number(value?.createdAt || 0)
    const now = Date.now()
    if (
      CLIENT_REQUEST_ID_PATTERN.test(clientRequestId) &&
      storedFingerprint === fingerprint &&
      Number.isFinite(createdAt) &&
      createdAt > 0 &&
      now - createdAt >= 0 &&
      now - createdAt <= CHECKOUT_IDEMPOTENCY_TTL_MS
    ) {
      return clientRequestId
    }
  } catch {
    // Corrupted local state must not block checkout. Replace it with a fresh request identity.
  }
  uni.removeStorageSync(key)
  return null
}

function getOrCreate(scope: string, fingerprint: string) {
  const existing = loadPending(scope, fingerprint)
  if (existing) return existing
  const clientRequestId = generateClientRequestId()
  uni.setStorageSync(storageKey(scope), {
    clientRequestId,
    fingerprint,
    createdAt: Date.now(),
  })
  return clientRequestId
}

function clear(scope: string, clientRequestId: string) {
  const key = storageKey(scope)
  try {
    const raw = uni.getStorageSync(key)
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (String(value?.clientRequestId || '') === clientRequestId) {
      uni.removeStorageSync(key)
    }
  } catch {
    uni.removeStorageSync(key)
  }
}

/**
 * Persist one request identity until the server returns a concrete success response. Network
 * failures and process/page re-entry therefore retry the exact same logical purchase. A changed
 * payload gets a new identity because it represents a new purchase intent.
 */
export async function runIdempotentCheckout<T>(
  scope: string,
  payload: unknown,
  submit: (clientRequestId: string) => Promise<T>,
): Promise<T> {
  const fingerprint = stableSerialize(payload)
  const clientRequestId = getOrCreate(scope, fingerprint)
  const result = await submit(clientRequestId)
  clear(scope, clientRequestId)
  return result
}
