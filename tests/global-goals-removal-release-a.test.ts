import { describe, expect, it } from 'vitest';

import * as strategies from '@/shared/services/sync/firebase/strategies';
import * as subscribers from '@/shared/subscribers';

// Guardrails for Release A: global goals code paths must remain disabled/removed.
// (Schema/table drop is Release B and intentionally out-of-scope.)

describe('Release A: global goals removal guardrails', () => {
  it('does not expose global-goal firebase strategies', () => {
    expect('globalGoalStrategy' in strategies).toBe(false);
    expect('dailyGoalStrategy' in strategies).toBe(false);
  });

  it('does not expose goal subscriber initializer', () => {
    expect('initGoalSubscriber' in subscribers).toBe(false);
  });
});
