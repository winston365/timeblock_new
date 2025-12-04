/**
 * BattleSidebar - 전투 사이드바 컴포넌트 (자유 미션 선택 시스템)
 *
 * @role 전투 시스템의 메인 UI 컨테이너
 * @description 보스 표시 + 미션 모달 버튼
 */

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useBattleStore, getBossById } from '../stores/battleStore';
import { BossDisplay } from './BossDisplay';
import { BossDefeatOverlay } from './BossDefeatOverlay';
import { MissionModal } from './MissionModal';
import type { BossDifficulty } from '@/shared/types/domain';
import { getBossXpByDifficulty } from '../utils/xp';

/**
 * 난이도 선택 버튼
 */
interface DifficultySelectProps {
  onSelect: (difficulty: BossDifficulty) => void;
  remainingCounts: Record<BossDifficulty, number>;
}

export function DifficultySelectButtons({ onSelect, remainingCounts }: DifficultySelectProps) {
  const difficulties: Array<{ key: BossDifficulty; label: string; emoji: string; bgColor: string; borderColor: string }> = [
    { key: 'easy', label: '쉬움', emoji: '🟢', bgColor: 'bg-green-500/10', borderColor: 'border-green-500' },
    { key: 'normal', label: '보통', emoji: '🟡', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500' },
    { key: 'hard', label: '어려움', emoji: '🔴', bgColor: 'bg-red-500/10', borderColor: 'border-red-500' },
    { key: 'epic', label: '에픽', emoji: '🟣', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {difficulties.map(({ key, label, emoji, bgColor, borderColor }) => {
        const count = remainingCounts[key];
        const isDisabled = count === 0;

        return (
          <button
            key={key}
            onClick={() => !isDisabled && onSelect(key)}
            disabled={isDisabled}
            className={`
              flex items-center justify-between rounded-lg border-2 px-3 py-2 transition-all
              ${isDisabled
                ? 'border-gray-700 bg-gray-800/50 opacity-40 cursor-not-allowed'
                : `${borderColor}/50 ${bgColor} hover:${borderColor} hover:${bgColor.replace('/10', '/20')}`
              }
            `}
          >
            <span className="flex items-center gap-1.5">
              <span>{emoji}</span>
              <span className={`text-sm font-bold ${isDisabled ? 'text-gray-500' : 'text-gray-200'}`}>
                {label}
              </span>
            </span>
            <span className={`text-xs font-mono ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BattleSidebar() {
  const {
    missions,
    settings,
    dailyState,
    loading,
    error,
    showDefeatOverlay,
    defeatedBossId,
    lastOverkillDamage,
    lastOverkillApplied,
    initialize,
    spawnBossByDifficulty,
    hideBossDefeat,
    getCurrentBoss,
    getRemainingBossCount,
    getTotalRemainingBossCount,
  } = useBattleStore();

  // 미션 모달 상태
  const [showMissionModal, setShowMissionModal] = useState(false);

  // 오버킬 적용 토스트 상태
  const [showOverkillToast, setShowOverkillToast] = useState(false);
  const [displayedOverkill, setDisplayedOverkill] = useState(0);

  // 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 오버킬 적용 토스트 표시
  useEffect(() => {
    if (lastOverkillApplied > 0 && !showDefeatOverlay) {
      setDisplayedOverkill(lastOverkillApplied);
      setShowOverkillToast(true);
      const timer = setTimeout(() => {
        setShowOverkillToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastOverkillApplied, showDefeatOverlay]);

  // 사용된 미션 ID 세트
  const usedMissionIds = useMemo(
    () => new Set(dailyState?.completedMissionIds ?? []),
    [dailyState?.completedMissionIds],
  );

  // 활성 미션
  const enabledMissionsList = useMemo(
    () => missions.filter(m => m.enabled).sort((a, b) => a.order - b.order),
    [missions],
  );

  // 사용 가능한 미션 수
  const availableMissionsCount = useMemo(
    () => enabledMissionsList.filter(m => !usedMissionIds.has(m.id)).length,
    [enabledMissionsList, usedMissionIds],
  );

  // 난이도 선택 핸들러
  const handleSelectDifficulty = useCallback(async (difficulty: BossDifficulty) => {
    await spawnBossByDifficulty(difficulty);
  }, [spawnBossByDifficulty]);

  // 현재 보스 정보
  const currentBossProgress = dailyState ? getCurrentBoss() : null;
  const currentBoss = useMemo(
    () => (currentBossProgress ? getBossById(currentBossProgress.bossId) : null),
    [currentBossProgress],
  );

  // 처치된 보스 정보
  const defeatedBoss = useMemo(
    () => (defeatedBossId ? getBossById(defeatedBossId) : null),
    [defeatedBossId],
  );
  const defeatedBossXp = useMemo(
    () => (defeatedBossId ? getBossXpByDifficulty(settings, defeatedBossId) : 0),
    [defeatedBossId, settings],
  );

  const isCurrentBossDefeated = currentBossProgress?.defeatedAt !== undefined;

  // 순차 진행 완료 여부 (phase 5 이상이면 자유선택)
  const sequentialPhase = dailyState?.sequentialPhase ?? 0;
  const isSequentialComplete = sequentialPhase >= 5;

  // 남은 보스 수
  const remainingCounts = useMemo(() => ({
    easy: getRemainingBossCount('easy'),
    normal: getRemainingBossCount('normal'),
    hard: getRemainingBossCount('hard'),
    epic: getRemainingBossCount('epic'),
  }), [getRemainingBossCount, dailyState]);

  const totalRemaining = getTotalRemainingBossCount();

  // 모든 보스 소진
  const allBossesExhausted = totalRemaining === 0 && isCurrentBossDefeated;

  // 오늘 획득 XP
  const totalDefeatedXP = useMemo(() => {
    if (!dailyState) return 0;
    return dailyState.bosses
      .filter(b => b.defeatedAt)
      .reduce((sum, boss) => sum + getBossXpByDifficulty(settings, boss.bossId), 0);
  }, [dailyState, settings]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-secondary)]">전투 준비 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-sm text-red-400">전투 시스템 오류</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{error.message}</p>
        </div>
      </div>
    );
  }

  // 전투 상태가 없음
  if (!dailyState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="text-4xl">🏕️</div>
        <div>
          <p className="font-bold text-[var(--color-text)]">전투 준비 중...</p>
        </div>
      </div>
    );
  }

  // 모든 보스 소진
  if (allBossesExhausted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/30 blur-xl" />
          <div className="relative text-7xl">🏆</div>
        </div>
        <div>
          <h3 className="text-2xl text-yellow-400 font-black">
            오늘의 전투 완료!
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {dailyState.totalDefeated}마리 보스 처치!
          </p>
        </div>
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-6 py-3">
          <p className="text-xs text-yellow-400 mb-1">획득 XP</p>
          <p className="text-2xl font-black text-yellow-300">+{totalDefeatedXP} XP</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* 오버킬 적용 토스트 */}
      {showOverkillToast && displayedOverkill > 0 && (
        <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/50 bg-gradient-to-r from-orange-500/20 to-red-500/20 px-4 py-2 shadow-lg">
            <span className="text-xl">💥</span>
            <div className="text-center">
              <p className="text-xs font-bold text-orange-300">오버킬 데미지 적용!</p>
              <p className="text-[10px] text-orange-400/80">이 보스 HP -{displayedOverkill}분</p>
            </div>
          </div>
        </div>
      )}

      {/* 보스 영역 */}
      {currentBoss && currentBossProgress && !isCurrentBossDefeated && (
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl relative">
          <BossDisplay
            boss={currentBoss}
            currentHP={currentBossProgress.currentHP}
            maxHP={currentBossProgress.maxHP}
            isDefeated={isCurrentBossDefeated}
          />
        </div>
      )}

      {/* 보스 처치됨 - 난이도 선택 (순차 진행 완료 후에만 표시) */}
      {isCurrentBossDefeated && totalRemaining > 0 && isSequentialComplete && !showDefeatOverlay && (
        <div className="flex-1 flex flex-col gap-3 justify-center">
          <div className="text-center">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-bold text-green-400 mt-1">보스 처치!</p>
            <p className="text-xs text-gray-400">다음 보스 선택 (남은 {totalRemaining}마리)</p>
          </div>
          <DifficultySelectButtons
            onSelect={handleSelectDifficulty}
            remainingCounts={remainingCounts}
          />
        </div>
      )}

      {/* 미션 버튼 (큰 버튼) */}
      {!isCurrentBossDefeated && enabledMissionsList.length > 0 && (
        <button
          onClick={() => setShowMissionModal(true)}
          className="shrink-0 w-full rounded-xl border-2 border-red-500/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 px-4 py-4 transition-all hover:border-red-500 hover:from-red-500/30 hover:to-orange-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div className="text-left">
                <p className="text-sm font-bold text-[var(--color-text)]">미션 공격</p>
                <p className="text-xs text-gray-400">미션 완료로 데미지!</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-red-400">{availableMissionsCount}</p>
              <p className="text-[10px] text-gray-500">/{enabledMissionsList.length}</p>
            </div>
          </div>
        </button>
      )}

      {/* 미션이 없을 때 */}
      {!isCurrentBossDefeated && enabledMissionsList.length === 0 && (
        <div className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-4">
          <span className="text-2xl">📋</span>
          <p className="text-xs text-[var(--color-text-secondary)]">전투 미션을 등록해주세요!</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">설정 → 전투</p>
        </div>
      )}

      {/* 오늘 진행 상황 */}
      {dailyState.totalDefeated > 0 && (
        <div className="shrink-0 flex items-center justify-between rounded-lg bg-[var(--color-bg-surface)]/50 px-3 py-2 text-xs">
          <span className="text-gray-400">오늘 처치</span>
          <span className="font-bold text-[var(--color-text)]">
            {dailyState.totalDefeated}마리 · +{totalDefeatedXP} XP
          </span>
        </div>
      )}

      {/* 보스 처치 연출 */}
      {showDefeatOverlay && defeatedBoss && (
        <BossDefeatOverlay
          boss={defeatedBoss}
          xpEarned={defeatedBossXp}
          onClose={hideBossDefeat}
          remainingCounts={remainingCounts}
          onSelectDifficulty={handleSelectDifficulty}
          overkillDamage={lastOverkillDamage}
          isSequentialComplete={isSequentialComplete}
          nextSequentialPhase={sequentialPhase}
        />
      )}

      {/* 미션 모달 */}
      <MissionModal
        open={showMissionModal}
        onClose={() => setShowMissionModal(false)}
      />
    </div>
  );
}
