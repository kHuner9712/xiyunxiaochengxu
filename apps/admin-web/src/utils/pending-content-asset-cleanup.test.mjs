import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PendingContentAssetCleanupQueue,
  isRetryableCleanupError,
} from './pending-content-asset-cleanup.js'

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, value)
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

function responseError(status) {
  return { response: { status } }
}

test('failed network deletion is persisted and recovered by a later queue instance', async () => {
  const storage = new MemoryStorage()
  const attempts = []
  const first = new PendingContentAssetCleanupQueue({
    storage,
    deleteAsset: async (id) => {
      attempts.push(id)
      throw new Error('network down')
    },
    shouldRetry: isRetryableCleanupError,
  })

  await assert.rejects(() => first.deleteNow('101'), /network down/)
  assert.deepEqual(first.snapshot(), ['101'])

  const second = new PendingContentAssetCleanupQueue({
    storage,
    deleteAsset: async (id) => {
      attempts.push(id)
    },
    shouldRetry: isRetryableCleanupError,
  })

  assert.deepEqual(second.snapshot(), ['101'])
  assert.deepEqual(await second.flush(), { deleted: ['101'], failed: [] })
  assert.deepEqual(second.snapshot(), [])
  assert.deepEqual(attempts, ['101', '101'])
})

test('flush keeps only retryable failures and removes terminal client errors', async () => {
  const storage = new MemoryStorage()
  const queue = new PendingContentAssetCleanupQueue({
    storage,
    deleteAsset: async (id) => {
      if (id === '201') throw responseError(500)
      if (id === '202') throw responseError(404)
    },
    shouldRetry: isRetryableCleanupError,
  })

  queue.remember('201')
  queue.remember('202')
  queue.remember('203')

  assert.deepEqual(await queue.flush(), {
    deleted: ['203'],
    failed: ['201'],
  })
  assert.deepEqual(queue.snapshot(), ['201'])
})

test('concurrent flush calls share one deletion pass', async () => {
  const storage = new MemoryStorage()
  let calls = 0
  let release
  const wait = new Promise(resolve => { release = resolve })
  const queue = new PendingContentAssetCleanupQueue({
    storage,
    deleteAsset: async () => {
      calls += 1
      await wait
    },
  })

  queue.remember('301')
  const first = queue.flush()
  const second = queue.flush()
  release()

  await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.deepEqual(queue.snapshot(), [])
})

test('invalid IDs are rejected before persistence or deletion', async () => {
  const queue = new PendingContentAssetCleanupQueue({
    deleteAsset: async () => undefined,
  })

  assert.throws(() => queue.remember('0'), /ID无效/)
  await assert.rejects(() => queue.deleteNow('not-an-id'), /ID无效/)
})
