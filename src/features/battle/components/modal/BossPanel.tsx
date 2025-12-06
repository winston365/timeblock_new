/**
 * BossPanel - 보스 표시 패널 컴포넌트
 *
 * @role MissionModal 왼쪽의 보스 정보 영역
 * @description
 *   - 현재 보스 이미지 및 정보 표시
 *   - HP 바 표시
 *   - 보스 처치 시 난이도 선택 UI
 *   - 데미지 플로팅 텍스트
 */

import type { Boss, BossDifficulty, DailyBattleState, DailyBossProgress } from '@/shared/types/domain';
import { getBossImageSrc } from '../../utils/assets';
import { BossHPBar } from './BossHPBar';
import { DifficultySelectButtons } from '../BattleSidebar';
import { DIFFICULTY_COLORS } from '../../constants/battleConstants';

interface BossPanelProps {
  /** 현재 보스 메타데이터 */
  currentBoss: Boss | null;
  /** 현재 보스 진행 상태 */
  currentBossProgress: DailyBossProgress | null;
  /** 보스가 처치되었는지 여부 */
  isCurrentBossDefeated: boolean;
  /** 일일 전투 상태 */
  dailyState: DailyBattleState | null;
  /** 마지막 데미지 (플로팅 텍스트용) */
  lastDamage: number | null;
  /** 난이도별 남은 보스 수 */
  remainingCounts: Record<BossDifficulty, number>;
  /** 총 남은 보스 수 */
  totalRemaining: number;
  /** 난이도 선택 핸들러 */
  onSelectDifficulty: (difficulty: BossDifficulty) => void;
}

/**
 * 보스 표시 패널 컴포넌트
 */
export function BossPanel({
  currentBoss,
  currentBossProgress,
  isCurrentBossDefeated,
  dailyState,
  lastDamage,
  remainingCounts,
  totalRemaining,
  onSelectDifficulty,
}: BossPanelProps) {
  const allBossesExhausted = totalRemaining === 0 && isCurrentBossDefeated;

  // 보스가 있을 때
  if (currentBoss && currentBossProgress && !isCurrentBossDefeated) {
    return (
      <div className="flex-1 flex flex-col bg-slate-900/90 rounded-2xl border border-red-900/30 overflow-hidden">
        {/* 보스 세로 이미지 */}
        <div className="relative flex-1 min-h-[300px]">
          <img
            src={getBossImageSrc(currentBoss.image)}
            alt={currentBoss.name}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          {/* 그라데이션 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

          {/* 데미지 플로팅 */}
          {lastDamage && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce">
              <span className="text-5xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                -{lastDamage}
              </span>
            </div>
          )}

          {/* 난이도 뱃지 */}
          <div
            className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold border ${DIFFICULTY_COLORS[currentBoss.difficulty]}`}
          >
            {currentBoss.difficulty.toUpperCase()}
          </div>

          {/* 보스 정보 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-xl font-black text-white drop-shadow-lg">
              {currentBoss.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              오늘 처치:{' '}
              <span className="text-yellow-400 font-bold">
                {dailyState?.totalDefeated ?? 0}마리
              </span>
            </p>
          </div>
        </div>

        {/* HP 바 */}
        <div className="shrink-0 p-3 bg-black/50">
          <BossHPBar
            current={currentBossProgress.currentHP}
            max={currentBossProgress.maxHP}
          />
        </div>
      </div>
    );
  }

  // 보스 처치됨 - 난이도 선택
  if (isCurrentBossDefeated && totalRemaining > 0) {
    return (
      <div className="flex-1 bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/30 flex flex-col">
        <div className="text-center mb-4">
          <div className="inline-block animate-bounce">
            <span className="text-5xl">🎉</span>
          </div>
          <p className="text-xl font-black text-emerald-400 mt-2">VICTORY!</p>
          <p className="text-sm text-gray-400">다음 보스 선택</p>
          <p className="text-xs text-gray-500">(남은 {totalRemaining}마리)</p>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <DifficultySelectButtons
            onSelect={onSelectDifficulty}
            remainingCounts={remainingCounts}
          />
        </div>
      </div>
    );
  }

  // 모든 보스 소진
  if (allBossesExhausted) {
    return (
      <div className="flex-1 bg-gradient-to-b from-yellow-900/30 via-yellow-800/20 to-yellow-900/30 rounded-2xl p-6 border border-yellow-500/30 flex flex-col items-center justify-center text-center">
        <div className="inline-block animate-pulse">
          <span className="text-6xl">🏆</span>
        </div>
        <p className="text-xl font-black text-yellow-400 mt-3">전투 완료!</p>
        <p className="text-sm text-gray-400 mt-1">
          모든 보스를
          <br />
          처치했습니다
        </p>
      </div>
    );
  }

  // 보스 없는 초기 상태
  return (
    <div className="flex-1 bg-slate-900/90 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
      <span className="text-5xl opacity-50">👹</span>
      <p className="text-gray-400 mt-3">보스 없음</p>
      <p className="text-xs text-gray-500 mt-1">난이도를 선택하세요</p>
    </div>
  );
}
