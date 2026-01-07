import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSystemState, getSystemState, setSystemState } from '@/data/repositories/systemRepository';

type ScheduleViewModeStoreModule = typeof import('@/shared/stores/useScheduleViewModeStore');

const importFreshStore = async (): Promise<ScheduleViewModeStoreModule> => {
  vi.resetModules();

  return import('@/shared/stores/useScheduleViewModeStore');
};

const persistKey = 'persist:schedule-view-mode';

describe('useScheduleViewModeStore', () => {
  beforeEach(async () => {
    await deleteSystemState(persistKey);
    const { useScheduleViewModeStore } = await importFreshStore();
    // Ensure hydration settles before assertions.
    await useScheduleViewModeStore.persist.rehydrate();
  });

  it('defaults to timeblock', async () => {
    const { useScheduleViewModeStore } = await importFreshStore();
    await useScheduleViewModeStore.persist.rehydrate();

    expect(useScheduleViewModeStore.getState().mode).toBe('timeblock');
  });

  it('setMode updates mode', async () => {
    const { useScheduleViewModeStore } = await importFreshStore();
    await useScheduleViewModeStore.persist.rehydrate();

    useScheduleViewModeStore.getState().setMode('goals');
    expect(useScheduleViewModeStore.getState().mode).toBe('goals');
  });

  it('persists mode to systemState (Dexie)', async () => {
    const { useScheduleViewModeStore } = await importFreshStore();
    await useScheduleViewModeStore.persist.rehydrate();

    useScheduleViewModeStore.getState().setMode('inbox');

    const raw = await getSystemState<string>(persistKey);
    expect(raw).not.toBeNull();
    expect(raw).toContain('"mode":"inbox"');
  });

  it('rehydrates mode from systemState (Dexie)', async () => {
    const { useScheduleViewModeStore } = await importFreshStore();

    await setSystemState(persistKey, JSON.stringify({ state: { mode: 'goals' }, version: 0 }));

    await useScheduleViewModeStore.persist.rehydrate();
    expect(useScheduleViewModeStore.getState().mode).toBe('goals');
  });
});
