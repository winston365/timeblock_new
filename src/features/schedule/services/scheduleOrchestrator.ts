/**
 * @file scheduleOrchestrator.ts
 * @description ScheduleView에서 사용되는 워밍업/설정 동기화 오케스트레이션(비-UI)
 */

import { z } from 'zod';

import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import type { WarmupPresetItem } from '@/shared/types/domain';
import { fetchFromFirebase, syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { warmupPresetStrategy } from '@/shared/services/sync/firebase/strategies';

const warmupPresetItemSchema = z.object({
  text: z.string().min(1),
  baseDuration: z.number().finite().nonnegative(),
  resistance: z.enum(['low', 'medium', 'high']),
});

const warmupPresetSchema = z.array(warmupPresetItemSchema);

/**
 * Firebase에서 워밍업 프리셋을 조회합니다.
 */
export const fetchWarmupPreset = async (): Promise<WarmupPresetItem[] | null> => {
  const raw = await fetchFromFirebase(warmupPresetStrategy);

  const parsed = warmupPresetSchema.safeParse(raw);
  if (!parsed.success) return null;

  return parsed.data;
};

/**
 * Firebase에 워밍업 프리셋을 저장합니다.
 */
export const syncWarmupPreset = async (preset: readonly WarmupPresetItem[]): Promise<void> => {
  await syncToFirebase(warmupPresetStrategy, [...preset]);
};

/**
 * Dexie systemState에서 워밍업 자동생성 플래그를 로드합니다.
 */
export const loadWarmupAutoGenerateEnabled = async (
  defaultValue: boolean,
): Promise<boolean> => {
  const storedValue = await getSystemState<boolean>(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED);
  return storedValue ?? defaultValue;
};

/**
 * Dexie systemState에 워밍업 자동생성 플래그를 저장합니다.
 */
export const persistWarmupAutoGenerateEnabled = async (enabled: boolean): Promise<void> => {
  await setSystemState(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED, enabled);
};
