export type CompatibleTime = number | string | Date | null | undefined

export function normalizeTimeToTimestamp(value: CompatibleTime): number {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return Number.NaN
    return new Date(trimmed).getTime()
  }
  return Number.NaN
}
