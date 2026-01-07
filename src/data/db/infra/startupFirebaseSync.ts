/**
 * Startup Firebase Sync (Infra)
 *
 * @role Extracts Firebase startup behavior into a testable unit.
 *       This is used by the app initialization hook.
 */

export type StartupFirebaseSyncDeps<TInitialData> = {
  initializeFirebase: (firebaseConfig: unknown) => boolean;
  fetchDataFromFirebase?: () => Promise<TInitialData>;
};

/**
 * Performs Firebase initialization and (legacy) initial bulk download.
 *
 * @returns Initial data when Firebase was initialized; otherwise null.
 */
export const runStartupFirebaseInitialRead = async <TInitialData>(
  firebaseConfig: unknown,
  deps: StartupFirebaseSyncDeps<TInitialData>
): Promise<TInitialData | null | undefined> => {
  if (!firebaseConfig) return undefined;

  const isInitialized = deps.initializeFirebase(firebaseConfig);
  if (!isInitialized) return undefined;

  // BW-01: Skip initial bulk download. Initial RTDB listener snapshots will populate local DB.
  return null;
};
