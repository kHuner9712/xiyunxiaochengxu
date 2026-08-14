const inFlight = new Map<string, Promise<unknown>>()

/**
 * Share one in-flight mutation per explicit operation key.
 *
 * This only collapses concurrent calls. Results are never cached: once the request settles,
 * a later intentional save starts a fresh request.
 */
export function runSingleFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const request = Promise.resolve().then(factory)
  const tracked = request.finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key)
  })
  inFlight.set(key, tracked)
  return tracked
}
