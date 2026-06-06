import { describe, expect, it } from 'vitest'
import { formatDate } from '../format'

describe('formatDate', () => {
  it('formats ISO strings without parsing them as numbers', () => {
    expect(formatDate('2026-06-05T15:06:24.269Z', 'YYYY-MM-DD')).toBe('2026-06-05')
  })

  it('formats second timestamps', () => {
    const seconds = new Date('2026-06-05T12:00:00.000Z').getTime() / 1000

    expect(formatDate(seconds, 'YYYY-MM-DD')).toBe('2026-06-05')
  })

  it('formats millisecond timestamps', () => {
    const milliseconds = new Date('2026-06-05T12:00:00.000Z').getTime()

    expect(formatDate(milliseconds, 'YYYY-MM-DD')).toBe('2026-06-05')
  })

  it('formats numeric timestamp strings', () => {
    const milliseconds = String(new Date('2026-06-05T12:00:00.000Z').getTime())

    expect(formatDate(milliseconds, 'YYYY-MM-DD')).toBe('2026-06-05')
  })

  it('returns empty string for invalid values', () => {
    expect(formatDate('not-a-date')).toBe('')
  })
})
