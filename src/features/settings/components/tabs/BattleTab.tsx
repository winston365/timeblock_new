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

import { useEffect, type ChangeEvent } from 'react';
import type { BossDifficulty } from '@/shared/types/domain';
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

function computeBossDifficultyXP_core(value: number) {
  return clampValue_core(value, 10, 500);
}

const DIFFICULTY_XP_DEFAULTS: Record<BossDifficulty, number> = {
  easy: 20,
  normal: 40,
  hard: 80,
  epic: 120,
};

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
  // 개별 selector 사용으로 getSnapshot 캐싱 경고 방지
  const settings = useBattleStore(state => state.settings);
  const loading = useBattleStore(state => state.loading);
  const initialize = useBattleStore(state => state.initialize);
  const updateSettings = useBattleStore(state => state.updateSettings);

  useEffect(() => {
    void initializeBattleSettingsShell(initialize);
  }, [initialize]);

  const handleDifficultyXpChange = (difficulty: BossDifficulty) => (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const safeValue = computeBossDifficultyXP_core(rawValue);
    const currentMap = settings.bossDifficultyXP ?? DIFFICULTY_XP_DEFAULTS;
    updateSettingsShell(
      updateSettings,
      { bossDifficultyXP: { ...currentMap, [difficulty]: safeValue } },
      { field: `bossDifficultyXP.${difficulty}`, rawValue },
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

  const difficultyXpEntries: Array<{ key: BossDifficulty; label: string; range: string }> = [
    { key: 'easy', label: '쉬움', range: '기본 20 XP' },
    { key: 'normal', label: '보통', range: '기본 40 XP' },
    { key: 'hard', label: '어려움', range: '기본 80 XP' },
    { key: 'epic', label: '에픽', range: '기본 120 XP' },
  ];

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
          23마리의 보스가 난이도별로 풀에서 등장합니다. 앱 시작 시 Easy 보스 1마리가 자동 스폰됩니다.
        </p>

        <div className="rounded-lg bg-[var(--color-bg-elevated)] p-4 border border-[var(--color-border)]">
          <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">📊 보스 HP 계산</h4>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            보스 HP = 처치 XP × 0.5 (예: 40 XP 보스 → HP 20분)
          </p>
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            <div className="bg-green-500/10 rounded p-2">
              <div className="text-green-400 font-bold">Easy</div>
              <div className="text-[var(--color-text-tertiary)]">2마리</div>
            </div>
            <div className="bg-blue-500/10 rounded p-2">
              <div className="text-blue-400 font-bold">Normal</div>
              <div className="text-[var(--color-text-tertiary)]">7마리</div>
            </div>
            <div className="bg-orange-500/10 rounded p-2">
              <div className="text-orange-400 font-bold">Hard</div>
              <div className="text-[var(--color-text-tertiary)]">7마리</div>
            </div>
            <div className="bg-purple-500/10 rounded p-2">
              <div className="text-purple-400 font-bold">Epic</div>
              <div className="text-[var(--color-text-tertiary)]">7마리</div>
            </div>
          </div>
        </div>
      </section>

      {/* 보상 설정 */}
      <section className={sectionClass}>
        <h3>🏆 보상 설정</h3>
        <p className={sectionDescriptionClass}>
          난이도별 보스 처치 XP를 설정합니다. HP = XP × 0.5로 자동 계산됩니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {difficultyXpEntries.map(entry => (
            <div key={entry.key} className={formGroupClass}>
              <label className="flex items-center gap-2">
                <span>{entry.label}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">{entry.range}</span>
                <span className="text-[10px] text-[var(--color-primary)]">
                  (HP: {Math.floor((settings.bossDifficultyXP?.[entry.key] ?? DIFFICULTY_XP_DEFAULTS[entry.key]) * 0.5)}분)
                </span>
              </label>
              <input
                type="number"
                min={10}
                max={500}
                step={5}
                value={settings.bossDifficultyXP?.[entry.key] ?? DIFFICULTY_XP_DEFAULTS[entry.key]}
                onChange={handleDifficultyXpChange(entry.key)}
                className={inputClass}
              />
            </div>
          ))}
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
