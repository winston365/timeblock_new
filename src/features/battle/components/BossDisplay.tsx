/**
 * BossDisplay - 보스 표시 컴포넌트 (리뉴얼)
 *
 * @role 현재 보스의 이름, 이미지, 난이도 표시
 * @description 사이드바의 2/3를 차지하는 큰 보스 이미지
 */

import { useMemo, useState } from 'react';
import type { Boss } from '@/shared/types/domain';
import { useBattleStore } from '../stores/battleStore';
import { getBossImageSrc } from '../utils/assets';
import { pickRandomQuote } from '../utils/quotes';

type BattleStoreState = ReturnType<typeof useBattleStore.getState>;
type BossImageSetting = ReturnType<BattleStoreState['getBossImageSetting']>;

interface BossDisplayError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  originalError?: unknown;
}

function createBossDisplayError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  originalError?: unknown,
): BossDisplayError {
  return { code, message, context, originalError };
}

interface BossDisplayProps {
  boss: Boss;
  currentHP: number;
  maxHP: number;
  isDefeated?: boolean;
}

/**
 * 난이도별 스타일 반환
 */
function computeDifficultyStyles(difficulty: Boss['difficulty']) {
  switch (difficulty) {
    case 'easy':
      return {
        badge: 'bg-green-500/20 text-green-400 border-green-500/50',
        glow: 'rgba(34, 197, 94, 0.3)',
        label: '쉬움',
      };
    case 'normal':
      return {
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        glow: 'rgba(59, 130, 246, 0.3)',
        label: '보통',
      };
    case 'hard':
      return {
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
        glow: 'rgba(249, 115, 22, 0.3)',
        label: '어려움',
      };
    case 'epic':
      return {
        badge: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
        glow: 'rgba(168, 85, 247, 0.4)',
        label: '에픽',
      };
    default:
      return {
        badge: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
        glow: 'rgba(107, 114, 128, 0.3)',
        label: '???',
      };
  }
}

/**
 * 보스 이미지 fallback 이모지
 */
function getBossEmoji(bossId: string): string {
  const emojiMap: Record<string, string> = {
    'boss_01': '🐉',
    'boss_02': '⚔️',
    'boss_03': '🟢',
    'boss_04': '🗿',
    'boss_05': '🧙‍♀️',
    'boss_06': '🐺',
    'boss_07': '💀',
    'boss_08': '👹',
    'boss_09': '🧛',
    'boss_10': '🔥',
    'boss_11': '🐍',
    'boss_12': '😈',
    'boss_13': '🧊',
    'boss_14': '🕷️',
    'boss_15': '🐛',
    'boss_16': '☠️',
    'boss_17': '👁️',
    'boss_18': '🐕',
    'boss_19': '🦑',
    'boss_20': '🏔️',
  };
  return emojiMap[bossId] || '👾';
}

function computeHpPercent_core(currentHP: number, maxHP: number): number {
  return Math.max(0, (currentHP / maxHP) * 100);
}

function computeImageConfig_core(savedImageSetting: BossImageSetting, boss: Boss) {
  const imagePosition = savedImageSetting?.imagePosition || boss.imagePosition || 'center';
  const imageScale = savedImageSetting?.imageScale ?? boss.imageScale ?? 1;
  return { imagePosition, imageScale };
}

function computeShouldShowEmoji_core(showImage: boolean, imageError: boolean, hasBossImage: boolean) {
  return !showImage || imageError || !hasBossImage;
}

function computeBattleQuote_core(quotes: string[] | undefined, defeatQuote: string) {
  return pickRandomQuote(quotes, defeatQuote);
}

function useBattleSettingsShell() {
  try {
    return useBattleStore(state => state.settings);
  } catch (error) {
    const formattedError = createBossDisplayError(
      'BATTLE_STORE_SELECT_ERROR',
      'Failed to read battle settings',
      { selector: 'settings' },
      error,
    );
    console.error('[BossDisplay]', formattedError);
    return null;
  }
}

function useBossImageGetterShell(): BattleStoreState['getBossImageSetting'] | null {
  try {
    return useBattleStore(state => state.getBossImageSetting);
  } catch (error) {
    const formattedError = createBossDisplayError(
      'BATTLE_STORE_SELECT_ERROR',
      'Failed to read boss image getter',
      { selector: 'getBossImageSetting' },
      error,
    );
    console.error('[BossDisplay]', formattedError);
    return null;
  }
}

function readBossImageSettingShell(
  getBossImageSetting: BattleStoreState['getBossImageSetting'] | null,
  bossId: string,
): BossImageSetting {
  if (!getBossImageSetting) {
    return null;
  }

  try {
    return getBossImageSetting(bossId);
  } catch (error) {
    const formattedError = createBossDisplayError(
      'BOSS_IMAGE_SETTING_READ_ERROR',
      'Failed to read boss image settings',
      { bossId },
      error,
    );
    console.error('[BossDisplay]', formattedError);
    return null;
  }
}

export function BossDisplay({
  boss,
  currentHP,
  maxHP,
  isDefeated = false,
}: BossDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const settings = useBattleSettingsShell();
  const getBossImageSetting = useBossImageGetterShell();
  const showImage = settings?.showBossImage ?? true;
  const difficultyStyle = computeDifficultyStyles(boss.difficulty);
  const hpPercent = computeHpPercent_core(currentHP, maxHP);
  const bossImageSrc = getBossImageSrc(boss.image);
  const battleQuote = useMemo(
    () => computeBattleQuote_core(boss.quotes, boss.defeatQuote),
    [boss.id, boss.quotes, boss.defeatQuote],
  );

  // 저장된 이미지 설정 가져오기 (없으면 bossData의 기본값 사용)
  const savedImageSetting = readBossImageSettingShell(getBossImageSetting, boss.id);
  const { imagePosition, imageScale } = computeImageConfig_core(savedImageSetting, boss);

  // 이미지 숨김 설정이거나 이미지 에러 시 이모지 표시
  const shouldShowEmoji = computeShouldShowEmoji_core(showImage, imageError, Boolean(boss.image));

  return (
    <div className={`relative h-full w-full ${isDefeated ? 'opacity-50' : ''}`}>
      {/* 보스 이미지 영역 - 직사각형, 전체 차지 */}
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-b from-gray-900 to-black">
        {/* 배경 글로우 효과 */}
        {!isDefeated && (
          <div
            className="absolute inset-0 animate-pulse opacity-50"
            style={{
              background: `radial-gradient(ellipse at center, ${difficultyStyle.glow} 0%, transparent 70%)`,
            }}
          />
        )}

        {/* 보스 이미지 */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {battleQuote && (
            <div className="pointer-events-none absolute left-6 right-6 top-6 z-20 text-center drop-shadow-lg">
              <div className="inline-block rounded-full bg-black/50 px-4 py-2 text-sm text-gray-100 backdrop-blur">
                “{battleQuote}”
              </div>
            </div>
          )}
          {!shouldShowEmoji ? (
            <img
              src={bossImageSrc}
              alt={boss.name}
              className={`h-full w-full object-cover transition-transform duration-300 ${isDefeated ? 'grayscale' : 'drop-shadow-2xl'
                }`}
              onError={() => setImageError(true)}
              style={{
                filter: isDefeated ? 'grayscale(1)' : undefined,
                objectPosition: imagePosition,
                transformOrigin: 'center',
                transform: isDefeated
                  ? `scale(${imageScale}) rotate(12deg)`
                  : `scale(${imageScale})`,
              }}
            />
          ) : (
            <div
              className={`text-[120px] transition-transform duration-300 ${isDefeated ? 'grayscale rotate-12' : 'drop-shadow-2xl'
                }`}
              style={{
                filter: isDefeated ? 'grayscale(1)' : undefined,
                textShadow: isDefeated ? 'none' : `0 0 40px ${difficultyStyle.glow}`,
              }}
            >
              {getBossEmoji(boss.id)}
            </div>
          )}
        </div>

        {/* 처치됨 오버레이 */}
        {isDefeated && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <span className="text-5xl">💀</span>
              <p className="mt-2 text-lg font-bold text-gray-400">DEFEATED</p>
            </div>
          </div>
        )}

        {/* 난이도 뱃지 - 좌상단 */}
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur-sm ${difficultyStyle.badge}`}
          >
            {difficultyStyle.label}
          </span>
        </div>

        {/* 보스 이름 - 하단 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12">
          {/* HP 바 */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-red-400">HP</span>
              <span className="font-mono text-gray-400 transition-all duration-300">
                {currentHP} / {maxHP}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800 relative">
              {/* 배경 글로우 (체력 감소 시) */}
              {hpPercent < 30 && hpPercent > 0 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/20 rounded-full" />
              )}
              {/* HP 바 본체 */}
              <div
                className={`h-full relative ${hpPercent > 50
                  ? 'bg-gradient-to-r from-green-600 to-green-400'
                  : hpPercent > 25
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                    : 'bg-gradient-to-r from-red-600 to-red-400'
                  }`}
                style={{
                  width: `${hpPercent}%`,
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
                }}
              >
                {/* 광택 효과 */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
              </div>
            </div>
          </div>

          {/* 보스 이름 */}
          <h2
            className={`text-center text-2xl tracking-wider ${isDefeated ? 'text-gray-600 line-through' : 'text-white'
              }`}
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 900,
              textShadow: isDefeated
                ? 'none'
                : '0 0 20px rgba(255,0,0,0.5), 2px 2px 4px rgba(0,0,0,0.8)',
              letterSpacing: '0.1em',
            }}
          >
            {boss.name}
          </h2>
        </div>
      </div>
    </div>
  );
}
