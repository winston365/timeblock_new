/**
 * SyncEngine lifecycle helpers.
 *
 * @role 토큰 사용량 정정/복구 및 디바운스 스케줄러 제공
 */

import { db } from '../../dexieClient';
import type { DailyTokenUsage } from '@/shared/types/domain';

const toSafeNumber = (value: unknown): number => (Number.isFinite(value) ? (value as number) : 0);

export const sanitizeTokenUsage = (usage: DailyTokenUsage): DailyTokenUsage => {
  const promptTokens = toSafeNumber(usage.promptTokens);
  const candidatesTokens = toSafeNumber(usage.candidatesTokens);
  const embeddingTokens = toSafeNumber(usage.embeddingTokens);
  const totalTokens = toSafeNumber(usage.totalTokens) || promptTokens + candidatesTokens + embeddingTokens;
  const messageCount = toSafeNumber(usage.messageCount);

  return {
    ...usage,
    promptTokens,
    candidatesTokens,
    embeddingTokens,
    totalTokens,
    messageCount,
  };
};

export const repairTokenUsage = async (): Promise<void> => {
  try {
    const rows = await db.dailyTokenUsage.toArray();

    await Promise.all(
      rows.map(async (row) => {
        const sanitized = sanitizeTokenUsage(row as DailyTokenUsage);

        if (
          sanitized.promptTokens !== row.promptTokens ||
          sanitized.candidatesTokens !== row.candidatesTokens ||
          sanitized.embeddingTokens !== row.embeddingTokens ||
          sanitized.totalTokens !== row.totalTokens ||
          sanitized.messageCount !== row.messageCount
        ) {
          await db.dailyTokenUsage.put(sanitized as never);
        }
      })
    );
  } catch (error) {
    console.error('Failed to repair token usage records:', error);
  }
};

export interface DebouncedScheduler {
  readonly schedule: (key: string, delayMs: number, fn: () => Promise<void>) => void;
  readonly clearAll: () => void;
}

export const createDebouncedScheduler = (onError: (message: string, error: unknown) => void): DebouncedScheduler => {
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const schedule: DebouncedScheduler['schedule'] = (key, delayMs, fn) => {
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(key);
      fn().catch((error) => {
        console.error(`[SyncEngine] Debounced sync failed (${key}):`, error);
        onError(`동기화 실패: ${key}`, error);
      });
    }, delayMs);

    debounceTimers.set(key, timer);
  };

  const clearAll = () => {
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();
  };

  return { schedule, clearAll };
};

export const groupCompletedByDate = (tasks: readonly { readonly completedAt: string | null; readonly id: string }[]) => {
  const grouped: Record<string, string[]> = {};

  tasks.forEach((task) => {
    const date = task.completedAt ? task.completedAt.slice(0, 10) : 'unknown';
    (grouped[date] ??= []).push(task.id);
  });

  return grouped;
};
