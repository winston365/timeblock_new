import { beforeEach, describe, expect, it, vi } from 'vitest';

const systemStateGet = vi.fn();
const systemStatePut = vi.fn();

vi.mock('@/data/db/dexieClient', () => ({
  db: {
    systemState: {
      get: systemStateGet,
      put: systemStatePut,
    },
  },
}));

vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: vi.fn(),
}));

vi.mock('@/shared/services/sync/firebaseService', () => ({
  isFirebaseInitialized: vi.fn(() => false),
}));

vi.mock('@/shared/services/sync/firebase/syncCore', () => ({
  syncToFirebase: vi.fn(async () => undefined),
  fetchFromFirebase: vi.fn(async () => null),
}));

vi.mock('@/shared/services/sync/firebase/strategies', () => ({
  battleMissionsStrategy: { collection: 'battleMissions' },
  battleSettingsStrategy: { collection: 'battleSettings' },
  bossImageSettingsStrategy: { collection: 'bossImageSettings' },
}));

vi.mock('@/shared/utils/firebaseGuard', () => ({
  withFirebaseSync: vi.fn(),
}));

vi.mock('@/shared/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/utils')>();
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-id'),
    getLocalDate: vi.fn(() => '2026-02-19'),
    shiftYmd: vi.fn(() => '2026-02-12'),
  };
});

describe('battleRepository.loadBattleSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills new duration damage rules when old stored settings do not include the field', async () => {
    systemStateGet.mockResolvedValueOnce({
      key: 'battleSettings',
      value: {
        defaultMissionDamage: 22,
        showBattleInSidebar: false,
      },
    });

    const { loadBattleSettings, DEFAULT_BATTLE_SETTINGS } = await import('@/data/repositories/battleRepository');
    const settings = await loadBattleSettings();

    expect(settings.defaultMissionDamage).toBe(22);
    expect(settings.showBattleInSidebar).toBe(false);
    expect(settings.taskCompletionDamageRules).toEqual(DEFAULT_BATTLE_SETTINGS.taskCompletionDamageRules);
  });

  it('sanitizes invalid duration damage rules from storage', async () => {
    systemStateGet.mockResolvedValueOnce({
      key: 'battleSettings',
      value: {
        taskCompletionDamageRules: [
          { minimumDuration: 45, damage: 15 },
          { minimumDuration: 45, damage: 99 },
          { minimumDuration: -10, damage: 2 },
          { minimumDuration: 30, damage: 10 },
        ],
      },
    });

    const { loadBattleSettings } = await import('@/data/repositories/battleRepository');
    const settings = await loadBattleSettings();

    expect(settings.taskCompletionDamageRules).toEqual([
      { minimumDuration: 30, damage: 10 },
      { minimumDuration: 45, damage: 15 },
    ]);
  });
});
