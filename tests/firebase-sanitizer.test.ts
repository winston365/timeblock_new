import { describe, expect, it } from 'vitest';

import { sanitizeForFirebase } from '@/shared/utils/firebaseSanitizer';

describe('sanitizeForFirebase', () => {
  it('converts undefined to null (primitive)', () => {
    const result = sanitizeForFirebase(undefined);
    expect(result).toBeNull();
  });

  it('recursively converts undefined to null inside objects and arrays', () => {
    const input = {
      a: undefined,
      b: {
        c: undefined,
        d: [1, undefined, { e: undefined }],
      },
    };

    const result = sanitizeForFirebase(input);

    expect(result).toEqual({
      a: null,
      b: {
        c: null,
        d: [1, null, { e: null }],
      },
    });
  });

  it('sanitizes invalid key characters by replacing with underscores', () => {
    const input = {
      'a#b': 1,
      'c$d': 2,
      'e[f]': 3,
      'g/h': 4,
    } as unknown as Record<string, unknown>;

    const result = sanitizeForFirebase(input) as unknown as Record<string, unknown>;

    expect(result).toEqual({
      a_b: 1,
      c_d: 2,
      e_f_: 3,
      'g_h': 4,
    });
  });

  it('replaces empty key with invalid_key', () => {
    const input = {
      '': 'x',
    } as unknown as Record<string, unknown>;

    const result = sanitizeForFirebase(input) as unknown as Record<string, unknown>;

    expect(result).toEqual({ invalid_key: 'x' });
  });

  it('converts dotted-path keys into nested objects', () => {
    const input = {
      'a.b.c': 1,
      'a.b.d': 2,
    } as unknown as Record<string, unknown>;

    const result = sanitizeForFirebase(input) as unknown as Record<string, unknown>;

    expect(result).toEqual({
      a: {
        b: {
          c: 1,
          d: 2,
        },
      },
    });
  });

  it('merges nested objects when setting dotted-path keys', () => {
    const input = {
      a: {
        b: { existing: true },
      },
      'a.b': { added: true },
    } as unknown as Record<string, unknown>;

    const result = sanitizeForFirebase(input) as unknown as Record<string, unknown>;

    expect(result).toEqual({
      a: {
        b: {
          existing: true,
          added: true,
        },
      },
    });
  });
});
