import { describe, expect, it, vi } from 'vitest';

import { runStartupFirebaseInitialRead } from '@/data/db/infra/startupFirebaseSync';

describe('BW-01 startup Firebase initial read', () => {
  it('does not perform an initial bulk download (listeners will populate local DB)', async () => {
    const initializeFirebase = vi.fn(() => true);
    const fetchDataFromFirebase = vi.fn(async () => ({ ok: true }));

    const result = await runStartupFirebaseInitialRead(
      { firebase: 'config' },
      {
        initializeFirebase,
        fetchDataFromFirebase,
      }
    );

    expect(initializeFirebase).toHaveBeenCalledTimes(1);
    expect(fetchDataFromFirebase).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
