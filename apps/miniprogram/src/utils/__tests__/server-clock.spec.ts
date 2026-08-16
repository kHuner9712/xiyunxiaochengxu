import { describe, expect, it } from 'vitest'
import { resolveServerClockOffset, serverNowFromOffset } from '../server-clock'

describe('server clock', () => {
  it('设备时间快 10 分钟时仍还原服务器当前时间', () => {
    const serverNow = new Date('2026-08-17T03:00:00.000Z').getTime()
    const deviceNow = serverNow + 10 * 60_000
    const offset = resolveServerClockOffset(serverNow, deviceNow)

    expect(offset).toBe(-10 * 60_000)
    expect(serverNowFromOffset(offset, deviceNow)).toBe(serverNow)
  })

  it('设备时间慢 15 分钟时仍还原服务器当前时间', () => {
    const serverNow = new Date('2026-08-17T03:00:00.000Z').getTime()
    const deviceNow = serverNow - 15 * 60_000
    const offset = resolveServerClockOffset(new Date(serverNow).toISOString(), deviceNow)

    expect(offset).toBe(15 * 60_000)
    expect(serverNowFromOffset(offset, deviceNow)).toBe(serverNow)
  })

  it('服务端时间缺失或非法时安全回退到设备时间', () => {
    const deviceNow = 1234567890000
    expect(resolveServerClockOffset(undefined, deviceNow)).toBe(0)
    expect(resolveServerClockOffset('not-a-time', deviceNow)).toBe(0)
    expect(serverNowFromOffset(Number.NaN, deviceNow)).toBe(deviceNow)
  })
})
