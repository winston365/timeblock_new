import { describe, expect, it, vi } from 'vitest';

import { createSyncEngineOperationQueue } from '@/data/db/infra/syncEngine/queue';

describe('createSyncEngineOperationQueue rapid-sync logging', () => {
  it('logs debug only when gap < 50ms (and does not warn)', async () => {
    let isSyncingFromRemote = false;

    const queue = createSyncEngineOperationQueue({
      getIsSyncingFromRemote: () => isSyncingFromRemote,
      setIsSyncingFromRemote: (value) => {
        isSyncingFromRemote = value;
      },
      onQueueError: vi.fn(),
    });

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const nowSpy = vi.spyOn(Date, 'now');
    // enqueue#1: now=0, completion timestamp=0
    // enqueue#2: now=40, completion timestamp=40
    nowSpy
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 40)
      .mockImplementationOnce(() => 40);

    const operationKey = 'dailyData:2026-01-10';

    await queue.enqueue(async () => undefined, operationKey);
    await queue.enqueue(async () => undefined, operationKey);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(1);

    const firstMessage = String(debugSpy.mock.calls[0]?.[0] ?? '');
    expect(firstMessage).toContain('Rapid sync detected');
    expect(firstMessage).toContain(operationKey);
  });

  it('does not log when gap is exactly 50ms', async () => {
    let isSyncingFromRemote = false;

    const queue = createSyncEngineOperationQueue({
      getIsSyncingFromRemote: () => isSyncingFromRemote,
      setIsSyncingFromRemote: (value) => {
        isSyncingFromRemote = value;
      },
      onQueueError: vi.fn(),
    });

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 50)
      .mockImplementationOnce(() => 50);

    const operationKey = 'dailyData:2026-01-10';

    await queue.enqueue(async () => undefined, operationKey);
    await queue.enqueue(async () => undefined, operationKey);

    expect(debugSpy).not.toHaveBeenCalled();
  });
});
