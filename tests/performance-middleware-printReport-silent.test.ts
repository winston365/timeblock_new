import { describe, expect, it, vi } from 'vitest';

import type { EventType } from '@/shared/lib/eventBus/types';
import { createPerformanceMiddleware } from '@/shared/lib/eventBus/middleware/performance';

describe('PerformanceMonitor.printReport', () => {
  it('returns silently when no events recorded', () => {
    const { monitor } = createPerformanceMiddleware({ enabled: true, reportInterval: 0 });

    const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);

    monitor.printReport();

    expect(groupSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(groupEndSpy).not.toHaveBeenCalled();
  });

  it('prints a report when at least one event recorded', () => {
    const { monitor } = createPerformanceMiddleware({ enabled: true, reportInterval: 0 });

    const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);

    monitor.record('task:created' as EventType, 12.34);
    monitor.printReport();

    expect(groupSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();
    expect(groupEndSpy).toHaveBeenCalledTimes(1);
  });
});
