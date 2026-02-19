import { describe, expect, it } from 'vitest';

import {
  resolveTaskCompletionDamage_core,
  sanitizeTaskCompletionDamageRules_core,
  validateTaskCompletionDamageRules_core,
} from '@/features/battle/utils/taskCompletionDamage';

describe('taskCompletionDamage rules', () => {
  it('uses threshold policy (largest threshold <= duration)', () => {
    const rules = [
      { minimumDuration: 15, damage: 5 },
      { minimumDuration: 30, damage: 10 },
      { minimumDuration: 45, damage: 15 },
      { minimumDuration: 60, damage: 25 },
    ];

    expect(resolveTaskCompletionDamage_core(14, rules)).toBe(0);
    expect(resolveTaskCompletionDamage_core(15, rules)).toBe(5);
    expect(resolveTaskCompletionDamage_core(44, rules)).toBe(10);
    expect(resolveTaskCompletionDamage_core(45, rules)).toBe(15);
    expect(resolveTaskCompletionDamage_core(120, rules)).toBe(25);
  });

  it('returns 0 when no rule matches or rules are empty', () => {
    expect(resolveTaskCompletionDamage_core(30, [])).toBe(0);
    expect(resolveTaskCompletionDamage_core(0, [{ minimumDuration: 30, damage: 10 }])).toBe(0);
  });

  it('sanitizes invalid rules and keeps deterministic ordering', () => {
    const sanitized = sanitizeTaskCompletionDamageRules_core([
      { minimumDuration: 45, damage: 15 },
      { minimumDuration: 30, damage: 10 },
      { minimumDuration: 45, damage: 100 },
      { minimumDuration: -1, damage: 10 },
      { minimumDuration: 60, damage: 0 },
    ]);

    expect(sanitized).toEqual([
      { minimumDuration: 30, damage: 10 },
      { minimumDuration: 45, damage: 15 },
    ]);
  });

  it('validates threshold rules: positive + strict ascending + no duplicates', () => {
    expect(validateTaskCompletionDamageRules_core([{ minimumDuration: 15, damage: 5 }])).toBeNull();

    expect(
      validateTaskCompletionDamageRules_core([
        { minimumDuration: 15, damage: 5 },
        { minimumDuration: 15, damage: 10 },
      ])
    ).toContain('strictly increasing');

    expect(
      validateTaskCompletionDamageRules_core([{ minimumDuration: 0, damage: 10 }])
    ).toContain('positive');
  });
});
