export interface CleanupStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface CleanupResult {
  deleted: string[]
  failed: string[]
}

export interface PendingContentAssetCleanupQueueOptions {
  deleteAsset: (id: string) => Promise<unknown>
  storage?: CleanupStorage
  storageKey?: string
  shouldRetry?: (error: unknown) => boolean
}

export class PendingContentAssetCleanupQueue {
  constructor(options: PendingContentAssetCleanupQueueOptions)
  readonly size: number
  snapshot(): string[]
  remember(id: string | number): string
  forget(id: string | number): void
  deleteNow(id: string | number): Promise<void>
  flush(): Promise<CleanupResult>
  clear(): void
}

export function isRetryableCleanupError(error: unknown): boolean
