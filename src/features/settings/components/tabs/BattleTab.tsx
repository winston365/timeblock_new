/**
 * BattleTab - 전투 시스템 설정 탭
 *
 * @role 보스 전투 시스템의 설정 및 미션 관리
 * @responsibilities
 *   - 보스/보상 설정 관리
 *   - 미션 CRUD (추가, 수정, 삭제, 순서 변경)
 *   - UI 설정 관리
 *   - 보스 이미지 프리뷰 에디터
 * @dependencies
 *   - battleStore: 전투 상태 및 설정
 *   - bossData: 보스 메타데이터
 */

import { useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import {
  sectionClass,
  sectionDescriptionClass,
  formGroupClass,
  inputClass,
} from './styles';
import { BossImagePreviewEditor } from './battle/BossImagePreviewEditor';
import { BattleMissionsSection } from './battle/BattleMissionsSection';

type BattleStoreState = ReturnType<typeof useBattleStore.getState>;

interface BattleTabError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  originalError?: unknown;
}

function createBattleTabError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  originalError?: unknown,
): BattleTabError {
  return { code, message, context, originalError };
}

// Core: pure clamping helpers
function clampValue_core(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeDailyBossCount(value: number) {
  return clampValue_core(value, 1, 23);
}

function computeBossBaseHP(value: number) {
  return clampValue_core(value, 30, 120);
}

function computeBossDefeatXP(value: number) {
  return clampValue_core(value, 50, 200);
}

// Shell: shared update + error handling
function updateSettingsShell(
  updateSettings: BattleStoreState['updateSettings'],
  updates: Partial<BattleStoreState['settings']>,
  context: Record<string, unknown> = {},
) {
  try {
    const result = updateSettings(updates);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((error: unknown) => {
        const formattedError = createBattleTabError(
          'BATTLE_SETTINGS_UPDATE_ERROR',
          'Failed to update battle settings',
          { ...context, updates },
          error,
        );
        console.error('[BattleTab]', formattedError);
      });
    }
  } catch (error) {
    const formattedError = createBattleTabError(
      'BATTLE_SETTINGS_UPDATE_ERROR',
      'Failed to update battle settings',
      { ...context, updates },
      error,
    );
    console.error('[BattleTab]', formattedError);
  }
}

async function initializeBattleSettingsShell(
  initialize: BattleStoreState['initialize'],
) {
  try {
    await initialize();
  } catch (error) {
    const formattedError = createBattleTabError(
      'BATTLE_SETTINGS_INIT_ERROR',
      'Failed to initialize battle settings',
      {},
      error,
    );
    console.error('[BattleTab]', formattedError);
  }
}

/**
 * 전투 설정 탭 컴포넌트
 */
export function BattleTab() {
  const { settings, loading, initialize, updateSettings } = useBattleStore(state => ({
    settings: state.settings,
    loading: state.loading,
    initialize: state.initialize,
    updateSettings: state.updateSettings,
  }));

  useEffect(() => {
    void initializeBattleSettingsShell(initialize);
  }, [initialize]);

  const handleDailyBossCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const safeValue = computeDailyBossCount(rawValue);
    updateSettingsShell(
      updateSettings,
      { dailyBossCount: safeValue },
      { field: 'dailyBossCount', rawValue },
    );
  };

  const handleBossBaseHPChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const safeValue = computeBossBaseHP(rawValue);
    updateSettingsShell(
      updateSettings,
      { bossBaseHP: safeValue },
      { field: 'bossBaseHP', rawValue },
    );
  };

  const handleBossDefeatXPChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const safeValue = computeBossDefeatXP(rawValue);
    updateSettingsShell(
      updateSettings,
      { bossDefeatXP: safeValue },
      { field: 'bossDefeatXP', rawValue },
    );
  };

  const handleShowBattleInSidebarChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSettingsShell(
      updateSettings,
      { showBattleInSidebar: event.target.checked },
      { field: 'showBattleInSidebar', rawValue: event.target.checked },
    );
  };

  const handleShowBossImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSettingsShell(
      updateSettings,
      { showBossImage: event.target.checked },
      { field: 'showBossImage', rawValue: event.target.checked },
    );
  };

  const handleBattleSoundEffectsChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSettingsShell(
      updateSettings,
      { battleSoundEffects: event.target.checked },
      { field: 'battleSoundEffects', rawValue: event.target.checked },
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 보스 설정 */}
      <section className={sectionClass}>
        <h3>⚔️ 보스 설정</h3>
        <p className={sectionDescriptionClass}>
          하루에 등장하는 보스 수와 체력을 설정합니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className={formGroupClass}>
            <label>
              하루 보스 수
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(1~23)</span>
            </label>
            <input
              type="number"
              min={1}
              max={23}
              value={settings.dailyBossCount}
              onChange={handleDailyBossCountChange}
              className={inputClass}
            />
          </div>

          <div className={formGroupClass}>
            <label>
              보스 체력 (분)
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(30~120)</span>
            </label>
            <input
              type="number"
              min={30}
              max={120}
              step={5}
              value={settings.bossBaseHP}
              onChange={handleBossBaseHPChange}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* 보상 설정 */}
      <section className={sectionClass}>
        <h3>🏆 보상 설정</h3>
        <p className={sectionDescriptionClass}>
          보스 처치 시 획득하는 XP를 설정합니다.
        </p>

        <div className={formGroupClass}>
          <label>
            보스 처치 XP
            <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(50~200)</span>
          </label>
          <input
            type="number"
            min={50}
            max={200}
            step={10}
            value={settings.bossDefeatXP}
            onChange={handleBossDefeatXPChange}
            className={inputClass}
          />
        </div>
      </section>

      {/* UI 설정 */}
      <section className={sectionClass}>
        <h3>🎨 UI 설정</h3>

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showBattleInSidebar}
              onChange={handleShowBattleInSidebarChange}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">사이드바에 전투 표시</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showBossImage ?? true}
              onChange={handleShowBossImageChange}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">보스 이미지 표시</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">(끄면 이모지로 대체)</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.battleSoundEffects}
              onChange={handleBattleSoundEffectsChange}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">효과음 사용</span>
          </label>
        </div>
      </section>

      {/* 보스 이미지 프리뷰 에디터 */}
      <section className={sectionClass}>
        <h3>🖼️ 보스 이미지 프리뷰</h3>
        <p className={sectionDescriptionClass}>
          보스 이미지 위치와 스케일을 미리 확인합니다.
        </p>
        <BossImagePreviewEditor />
      </section>

      <BattleMissionsSection />
    </div>
  );
}

export { BossImagePreviewEditor } from './battle/BossImagePreviewEditor';
export { BattleMissionsSection } from './battle/BattleMissionsSection';
