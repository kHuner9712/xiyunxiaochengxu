import { normalizeTimeToTimestamp, type CompatibleTime } from './time'

/**
 * Convert an authoritative server timestamp into an offset from the device clock.
 * Promotion availability must not depend on whether the user's phone clock is fast or slow.
 */
export function resolveServerClockOffset(
  serverNow: CompatibleTime,
  clientNow = Date.now(),
): number {
  const serverTimestamp = normalizeTimeToTimestamp(serverNow)
  if (!Number.isFinite(serverTimestamp) || !Number.isFinite(clientNow)) return 0
  return serverTimestamp - clientNow
}

export function serverNowFromOffset(offsetMs: number, clientNow = Date.now()): number {
  const safeOffset = Number.isFinite(offsetMs) ? offsetMs : 0
  return clientNow + safeOffset
}
