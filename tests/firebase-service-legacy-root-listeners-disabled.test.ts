import { describe, expect, it } from 'vitest';
import { enableFirebaseSync } from '@/shared/services/sync/firebaseService';

describe('firebaseService legacy root listeners', () => {
  it('throws a deprecation error when enableFirebaseSync is called', () => {
    expect(() => enableFirebaseSync(() => {}, () => {})).toThrow(
      /\[FirebaseService\] enableFirebaseSync is deprecated and disabled/i
    );
  });
});
