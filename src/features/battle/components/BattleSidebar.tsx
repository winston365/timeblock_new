/**
 * BattleSidebar - 전투 사이드바 컴포넌트 (리뉴얼)
 *
 * @role 전투 시스템의 메인 UI 컨테이너
 * @description 2/3 보스 이미지 + 1/3 현재 미션 (보스 1:1 미션 매칭)
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useBattleStore, getBossById } from '../stores/battleStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { BossDisplay } from './BossDisplay';
import { BossDefeatOverlay } from './BossDefeatOverlay';
import { DamageFloatingText } from './DamageFloatingText';
import { playAttackSound, playBossDefeatSound } from '../services/battleSoundService';
import type { BattleMission } from '@/shared/types/domain';
import { getBossXpByDifficulty } from '../utils/xp';

export function BattleSidebar() {
  const {
    missions,
    settings,
    dailyState,
    loading,
    error,
    showDefeatOverlay,
    defeatedBossId,
    initialize,
    completeMission,
    hideBossDefeat,
    getCurrentBoss,
    isAllBossesDefeated,
  } = useBattleStore();

  const addXP = useGameStateStore(state => state.addXP);
  const missionCompleteCooldownRef = useRef(0);
  const MISSION_COMPLETE_COOLDOWN_MS = 250;

  // 데미지 플로팅 텍스트 상태
  const [showDamageFloat, setShowDamageFloat] = useState(false);
  const [lastDamage, setLastDamage] = useState(0);

  // 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 활성 미션 및 현재 미션 메모이제이션
  const enabledMissionsMemo = useMemo(
    () => missions.filter(m => m.enabled).sort((a, b) => a.order - b.order),
    [missions],
  );

  const currentMission = useMemo((): BattleMission | null => {
    if (!dailyState) return null;
    return enabledMissionsMemo[dailyState.currentBossIndex] || null;
  }, [enabledMissionsMemo, dailyState]);

  // 미션 완료 핸들러 (원킬 판정)
  const handleCompleteMission = useCallback(async () => {
    if (!currentMission) return;

    const now = Date.now();
    if (now - missionCompleteCooldownRef.current < MISSION_COMPLETE_COOLDOWN_MS) {
      return;
    }
    missionCompleteCooldownRef.current = now;

    // 효과음 재생 (설정에 따라)
    if (settings.battleSoundEffects) {
      playAttackSound();
    }

    // 데미지 플로팅 텍스트 표시
    setLastDamage(currentMission.damage);
    setShowDamageFloat(true);

    const result = await completeMission(currentMission.id);

    // 보스 처치 시 추가 효과음
    if (result.bossDefeated && settings.battleSoundEffects) {
      setTimeout(() => playBossDefeatSound(), 200);
    }

    // XP 보상 지급
    if (result.xpEarned > 0) {
      addXP(result.xpEarned, 'boss_defeat');
    }
  }, [completeMission, addXP, currentMission, settings.battleSoundEffects]);

  // 현재 보스 정보 (모든 Hook은 조건문 이전에 호출해야 함)
  const currentBossProgress = dailyState ? getCurrentBoss() : null;
  const currentBoss = useMemo(
    () => (currentBossProgress ? getBossById(currentBossProgress.bossId) : null),
    [currentBossProgress],
  );
  // dailyState를 의존성으로 사용하여 안정적인 메모이제이션
  const allDefeated = useMemo(() => {
    if (!dailyState) return false;
    return dailyState.bosses.every(boss => boss.defeatedAt);
  }, [dailyState]);
  const defeatedBoss = useMemo(
    () => (defeatedBossId ? getBossById(defeatedBossId) : null),
    [defeatedBossId],
  );
  const defeatedBossXp = useMemo(
    () => (defeatedBossId ? getBossXpByDifficulty(settings, defeatedBossId) : 0),
    [defeatedBossId, settings],
  );
  const isCurrentBossDefeated = currentBossProgress?.defeatedAt !== undefined;
  const totalDefeatedXP = useMemo(() => {
    if (!dailyState) return 0;
    return dailyState.bosses
      .filter(b => b.defeatedAt)
      .reduce((sum, boss) => sum + getBossXpByDifficulty(settings, boss.bossId), 0);
  }, [dailyState, settings]);
  const enabledMissionsList = useMemo(
    () => missions.filter(m => m.enabled),
    [missions],
  );

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
  if (!dailyState || dailyState.bosses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="text-4xl">🏕️</div>
        <div>
          <p className="font-bold text-[var(--color-text)]">오늘의 전투가 없습니다</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            설정에서 전투 시스템을 활성화하세요
          </p>
        </div>
      </div>
    );
  }

  // 모든 보스 처치 완료
  if (allDefeated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/30 blur-xl" />
          <div className="relative text-7xl">🏆</div>
        </div>
        <div>
          <h3
            className="text-2xl text-yellow-400"
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 900,
              textShadow: '0 0 20px rgba(234, 179, 8, 0.5)',
            }}
          >
            오늘의 전투 완료!
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {dailyState.totalDefeated}마리의 보스를 모두 처치!
          </p>
        </div>

        {/* 오늘 획득한 총 XP */}
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-6 py-3 text-center">
          <p className="text-xs text-yellow-400 mb-1">획득 XP</p>
          <p className="text-2xl font-black text-yellow-300">
            +{totalDefeatedXP} XP
          </p>
        </div>
      </div>
    );
  }

  // 미션이 없을 때
  if (enabledMissionsList.length === 0) {
    return (
      <div className="grid h-full p-3 gap-3" style={{ gridTemplateRows: 'minmax(0, 1fr) 120px' }}>
        {/* 보스 영역 */}
        {currentBoss && currentBossProgress && (
          <div className="min-h-0 overflow-hidden">
            <BossDisplay
              boss={currentBoss}
              currentHP={currentBossProgress.currentHP}
              maxHP={currentBossProgress.maxHP}
              isDefeated={isCurrentBossDefeated}
            />
          </div>
        )}

        {/* 미션 없음 안내 */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-3 text-center">
          <span className="text-2xl">📋</span>
          <p className="text-xs text-[var(--color-text-secondary)]">
            전투 미션을 등록해주세요!
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">
            설정 → 전투
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* 보스 영역 - 나머지 공간 */}
      {currentBoss && currentBossProgress && (
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl relative">
          <BossDisplay
            boss={currentBoss}
            currentHP={currentBossProgress.currentHP}
            maxHP={currentBossProgress.maxHP}
            isDefeated={isCurrentBossDefeated}
          />
          {/* 데미지 플로팅 텍스트 */}
          {showDamageFloat && (
            <DamageFloatingText
              damage={lastDamage}
              onComplete={() => setShowDamageFloat(false)}
            />
          )}
        </div>
      )}

      {/* 현재 미션 영역 - 고정 140px (박진감 있는 디자인) */}
      <div className="h-[140px] shrink-0 overflow-hidden">
        {currentMission && !isCurrentBossDefeated ? (
          <button
            onClick={handleCompleteMission}
            className="group relative h-full w-full overflow-hidden rounded-xl border-2 border-red-900/50 bg-gradient-to-br from-red-950/80 via-gray-900 to-black p-4 text-left transition-all duration-300 hover:border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] active:scale-[0.98]"
          >
            {/* 배경 애니메이션 효과 */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(239,68,68,0.15)_0%,_transparent_50%)] opacity-100" />
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
            
            {/* 전투 라인 효과 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

            {/* 미션 헤더 */}
            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30">
                  <span className="text-lg">⚔️</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-[0.2em]">
                    Battle Mission
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-orange-400">
                      💥 {currentMission.damage}분
                    </span>
                  </div>
                </div>
              </div>
              
              {/* 진행률 표시 */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-400 font-bold">{dailyState.currentBossIndex + 1}</span>
                <span className="text-gray-600">/</span>
                <span className="text-gray-500">{dailyState.bosses.length}</span>
              </div>
            </div>

            {/* 미션 텍스트 */}
            <p className="relative text-sm font-semibold text-gray-200 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
              {currentMission.text}
            </p>

            {/* 하단 액션 영역 */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="text-xs text-gray-500 group-hover:text-red-400 transition-colors">
                클릭하여 공격
              </span>
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/40 transition-colors">
                <span className="text-sm group-hover:animate-pulse">→</span>
              </div>
            </div>

            {/* 호버 시 공격 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-600/95 to-red-800/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="text-center transform group-hover:scale-110 transition-transform">
                <div className="relative">
                  <span className="text-5xl drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">⚔️</span>
                  <div className="absolute inset-0 animate-ping opacity-30">
                    <span className="text-5xl">⚔️</span>
                  </div>
                </div>
                <p className="mt-2 text-xl font-black text-white tracking-wider" style={{ textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                  공격!
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-4">
            {isCurrentBossDefeated ? (
              <div className="text-center">
                <div className="relative inline-block">
                  <span className="text-3xl">✅</span>
                  <div className="absolute inset-0 animate-ping opacity-30">
                    <span className="text-3xl">✅</span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-bold text-green-400">미션 완료!</p>
                <p className="text-xs text-gray-500 mt-1">보스를 처치했습니다</p>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-2xl">❓</span>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  이 보스에 배정된 미션이 없습니다
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 보스 처치 연출 */}
      {showDefeatOverlay && defeatedBoss && (
        <BossDefeatOverlay
          boss={defeatedBoss}
          xpEarned={defeatedBossXp}
          onClose={hideBossDefeat}
        />
      )}
    </div>
  );
}
