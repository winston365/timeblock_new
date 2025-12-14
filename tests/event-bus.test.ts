import { describe, expect, it, vi } from 'vitest';

import type { EventType } from '@/shared/lib/eventBus/types';
import { EventBus } from '@/shared/lib/eventBus/EventBus';

describe('EventBus', () => {
  it('delivers payload and meta to subscribers', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const handler = vi.fn();
    bus.on(event, handler as unknown as never);

    bus.emit(event, { taskId: 't1' } as unknown as never, { source: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0];
    expect(call?.[1]).toMatchObject({ source: 'test' });
  });

  it('executes higher priority subscribers first', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const order: string[] = [];

    bus.on(
      event,
      (() => {
        order.push('low');
      }) as unknown as never,
      { priority: 0 }
    );

    bus.on(
      event,
      (() => {
        order.push('high');
      }) as unknown as never,
      { priority: 10 }
    );

    bus.emit(event, { taskId: 't1' } as unknown as never);

    expect(order).toEqual(['high', 'low']);
  });

  it('once subscribers are removed after first invocation', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const handler = vi.fn();
    bus.once(event, handler as unknown as never);

    bus.emit(event, { taskId: 't1' } as unknown as never);
    bus.emit(event, { taskId: 't1' } as unknown as never);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates errors so other subscribers still run', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const ok = vi.fn();

    bus.on(
      event,
      (() => {
        throw new Error('boom');
      }) as unknown as never
    );

    bus.on(event, ok as unknown as never);

    bus.emit(event, { taskId: 't1' } as unknown as never);

    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('detects circular events and stops', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const handler = vi.fn(() => {
      bus.emit(event, { taskId: 't1' } as unknown as never);
    });

    bus.on(event, handler as unknown as never);

    bus.emit(event, { taskId: 't1' } as unknown as never);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs middleware chain in order and can block delivery by not calling next', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const calls: string[] = [];
    const handler = vi.fn(() => {
      calls.push('subscriber');
    });

    bus.use((e, _p, _m, next) => {
      calls.push(`mw1:${e}`);
      next();
    });

    bus.use((_e, _p, _m, _next) => {
      calls.push('mw2:block');
      // intentionally do not call next
    });

    bus.on(event, handler as unknown as never);

    bus.emit(event, { taskId: 't1' } as unknown as never);

    expect(calls).toEqual([`mw1:${event}`, 'mw2:block']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear removes subscribers, middlewares, and resets event stack', () => {
    const bus = new EventBus();
    const event = 'task:completed' as unknown as EventType;

    const handler = vi.fn();
    bus.on(event, handler as unknown as never);
    bus.use((_e, _p, _m, next) => next());

    bus.clear();

    bus.emit(event, { taskId: 't1' } as unknown as never);
    expect(handler).not.toHaveBeenCalled();
  });
});
