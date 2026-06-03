export function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  for (const key of ['list', 'items', 'records', 'rows']) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate as T[]
  }

  return []
}

export function paginationTotal(value: unknown, fallback = 0): number {
  if (Array.isArray(value)) return value.length
  if (!value || typeof value !== 'object') return fallback

  const record = value as Record<string, unknown>
  const pagination = record.pagination && typeof record.pagination === 'object'
    ? record.pagination as Record<string, unknown>
    : {}
  const total = record.total ?? pagination.total
  return typeof total === 'number' ? total : fallback
}
