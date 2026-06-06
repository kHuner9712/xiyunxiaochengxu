export type CompatibleTime = number | string | Date | null | undefined

function normalizeNumericTimestamp(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  if (value !== 0 && Math.abs(value) < 1_000_000_000_000) {
    return value * 1000
  }
  return value
}

export function normalizeTimeToTimestamp(value: CompatibleTime): number {
  if (typeof value === 'number') return normalizeNumericTimestamp(value)
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return Number.NaN
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return normalizeNumericTimestamp(Number(trimmed))
    }
    return new Date(trimmed).getTime()
  }
  return Number.NaN
}
