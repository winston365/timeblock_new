/**
 * RTDB observed-remote cache.
 *
 * @description
 * Stores the most recently observed remote payloads per RTDB path.
 * This is populated by RTDB listeners and can be used by write paths
 * to avoid pre-write network reads (bandwidth reduction).
 */

type ObservedEntry = {
  readonly value: unknown;
  readonly observedAt: number;
};

const observedByPath: Map<string, ObservedEntry> = new Map();

/**
 * Returns the last observed remote value for an RTDB path.
 *
 * @template T
 * @param path RTDB path (e.g. `users/<uid>/dailyData/<dateKey>`)
 * @returns The last observed value, or `undefined` if none.
 */
export const getObservedRemote = <T>(path: string): T | undefined => {
  const entry = observedByPath.get(path);
  return entry ? (entry.value as T) : undefined;
};

/**
 * Stores the latest observed remote value for an RTDB path.
 *
 * @param path RTDB path
 * @param value Remote value
 */
export const setObservedRemote = (path: string, value: unknown): void => {
  observedByPath.set(path, { value, observedAt: Date.now() });
};

/**
 * Clears all observed remote entries.
 */
export const clearObservedRemoteCache = (): void => {
  observedByPath.clear();
};
