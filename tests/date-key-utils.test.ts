import { describe, expect, it } from 'vitest';

import { shiftYmd } from '@/shared/lib/utils';

describe('shiftYmd', () => {
  it('shifts YYYY-MM-DD by a day offset', () => {
    expect(shiftYmd('2026-01-07', 0)).toBe('2026-01-07');
    expect(shiftYmd('2026-01-07', -1)).toBe('2026-01-06');
    expect(shiftYmd('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftYmd('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftYmd('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('returns null for invalid date keys', () => {
    expect(shiftYmd('nope', 1)).toBeNull();
    expect(shiftYmd('2026-13-01', 1)).toBeNull();
    expect(shiftYmd('2026-00-10', 1)).toBeNull();
    expect(shiftYmd('2026-02-31', 1)).toBeNull();
  });
});
