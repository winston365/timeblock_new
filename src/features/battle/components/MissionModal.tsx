/**
 * @file MissionModal.tsx
 * @role 전투 미션 선택 모달 - 배틀 스타일 UI
 * @description 긴장감 있는 배틀 UI, 20개 이상 미션 지원, 카드 게임 스타일
 * @dependencies useBattleStore, battleSoundService
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useBattleStore, getBossById } from '../stores/battleStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { playAttackSound, playBossDefeatSound } from '../services/battleSoundService';
import type { BattleMission, BossDifficulty } from '@/shared/types/domain';
import { DifficultySelectButtons } from './BattleSidebar';

interface MissionModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 배틀 스타일 미션 카드
 */
interface BattleMissionCardProps {
  mission: BattleMission;
  isUsed: boolean;
  onComplete: (missionId: string) => void;
  disabled: boolean;
  index: number;
}

function BattleMissionCard({ mission, isUsed, onComplete, disabled, index }: BattleMissionCardProps) {
  const [isAttacking, setIsAttacking] = useState(false);

  const handleClick = () => {
    if (!isUsed && !disabled) {
      setIsAttacking(true);
      setTimeout(() => {
        setIsAttacking(false);
        onComplete(mission.id);
      }, 200);
    }
  };

  // 데미지에 따른 카드 등급 색상
  const getCardGrade = (damage: number) => {
    if (damage >= 30) return { border: 'border-purple-500', glow: 'shadow-purple-500/30', label: 'EPIC', labelBg: 'bg-purple-500' };
    if (damage >= 20) return { border: 'border-orange-500', glow: 'shadow-orange-500/30', label: 'RARE', labelBg: 'bg-orange-500' };
    if (damage >= 15) return { border: 'border-blue-500', glow: 'shadow-blue-500/30', label: 'GOOD', labelBg: 'bg-blue-500' };
    return { border: 'border-gray-500', glow: 'shadow-gray-500/20', label: '', labelBg: '' };
  };

  const grade = getCardGrade(mission.damage);

  return (
    <button
      onClick={handleClick}
      disabled={isUsed || disabled}
      className={`
        group relative flex flex-col rounded-lg overflow-hidden transition-all duration-200
        ${isUsed
          ? 'opacity-40 cursor-default grayscale'
          : disabled
            ? 'opacity-30 cursor-not-allowed grayscale'
            : `hover:scale-[1.02] hover:shadow-lg ${grade.glow} active:scale-[0.98]`
        }
        ${isAttacking ? 'animate-pulse scale-95' : ''}
      `}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* 카드 배경 */}
      <div className={`
        relative border-2 ${isUsed ? 'border-emerald-500/50 bg-emerald-900/20' : grade.border} 
        bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg p-2
      `}>
        {/* 등급 라벨 */}
        {grade.label && !isUsed && (
          <div className={`absolute -top-0.5 -right-0.5 ${grade.labelBg} text-[8px] font-black text-white px-1.5 py-0.5 rounded-bl-md rounded-tr-md`}>
            {grade.label}
          </div>
        )}

        {/* 완료 체크 오버레이 */}
        {isUsed && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-lg z-10">
            <div className="bg-emerald-500 rounded-full p-1">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* 데미지 표시 (상단) */}
        <div className="flex justify-center mb-1">
          <div className={`
            flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black
            ${isUsed ? 'bg-emerald-500/30 text-emerald-300' : 'bg-red-500/30 text-red-300'}
          `}>
            <span className="text-sm">⚔️</span>
            <span>{mission.damage}</span>
          </div>
        </div>

        {/* 미션 텍스트 */}
        <div className="min-h-[40px] flex items-center justify-center">
          <p className={`text-[11px] font-medium text-center line-clamp-2 leading-tight ${isUsed ? 'text-emerald-200' : 'text-gray-200'}`}>
            {mission.text}
          </p>
        </div>

        {/* 공격 버튼 영역 */}
        {!isUsed && !disabled && (
          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1 rounded text-center">
              공격!
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * 보스 HP 바 컴포넌트
 */
function BossHPBar({ current, max }: { current: number; max: number }) {
  const percentage = (current / max) * 100;
  const isLow = percentage <= 30;
  const isCritical = percentage <= 15;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-red-400">HP</span>
        <span className={`text-sm font-mono font-bold ${isCritical ? 'text-red-500 animate-pulse' : isLow ? 'text-orange-400' : 'text-red-300'}`}>
          {current} / {max}
        </span>
      </div>
      <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-red-900/50">
        <div
          className={`h-full transition-all duration-500 ${
            isCritical 
              ? 'bg-gradient-to-r from-red-700 via-red-500 to-red-700 animate-pulse' 
              : isLow 
                ? 'bg-gradient-to-r from-orange-600 to-red-500' 
                : 'bg-gradient-to-r from-red-600 via-red-500 to-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 전투 미션 선택 모달 - 배틀 스타일
 */
export function MissionModal({ open, onClose }: MissionModalProps) {
  const {
    missions,
    settings,
    dailyState,
    completeMission,
    spawnBossByDifficulty,
    getCurrentBoss,
    getRemainingBossCount,
    getTotalRemainingBossCount,
  } = useBattleStore();

  const addXP = useGameStateStore(state => state.addXP);
  const [lastDamage, setLastDamage] = useState<number | null>(null);

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

  // 현재 보스
  const currentBossProgress = dailyState ? getCurrentBoss() : null;
  const currentBoss = useMemo(
    () => (currentBossProgress ? getBossById(currentBossProgress.bossId) : null),
    [currentBossProgress],
  );
  const isCurrentBossDefeated = currentBossProgress?.defeatedAt !== undefined;

  // 남은 보스 수
  const remainingCounts = useMemo(() => ({
    easy: getRemainingBossCount('easy'),
    normal: getRemainingBossCount('normal'),
    hard: getRemainingBossCount('hard'),
    epic: getRemainingBossCount('epic'),
  }), [getRemainingBossCount, dailyState]);

  const totalRemaining = getTotalRemainingBossCount();

  // ESC로 모달 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 미션 완료 핸들러
  const handleCompleteMission = useCallback(async (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    // 효과음 재생
    if (settings.battleSoundEffects) {
      playAttackSound();
    }

    // 데미지 표시
    setLastDamage(mission.damage);
    setTimeout(() => setLastDamage(null), 1000);

    const result = await completeMission(missionId);

    // 보스 처치 시
    if (result.bossDefeated) {
      if (settings.battleSoundEffects) {
        setTimeout(() => playBossDefeatSound(), 200);
      }
      toast.success(`🎉 보스 처치! +${result.xpEarned} XP`, { duration: 2500 });
    }

    // XP 보상 지급
    if (result.xpEarned > 0) {
      addXP(result.xpEarned, 'boss_defeat');
    }
  }, [completeMission, addXP, missions, settings.battleSoundEffects]);

  // 난이도 선택 핸들러
  const handleSelectDifficulty = useCallback(async (difficulty: BossDifficulty) => {
    await spawnBossByDifficulty(difficulty);
    toast.success(`${difficulty.toUpperCase()} 보스 등장!`, { duration: 1500 });
  }, [spawnBossByDifficulty]);

  if (!open) return null;

  const noBoss = !currentBoss || isCurrentBossDefeated;
  const allBossesExhausted = totalRemaining === 0 && isCurrentBossDefeated;

  // 난이도 색상
  const difficultyColors: Record<string, string> = {
    easy: 'text-green-400 bg-green-500/20 border-green-500/50',
    normal: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
    hard: 'text-orange-400 bg-orange-500/20 border-orange-500/50',
    epic: 'text-purple-400 bg-purple-500/20 border-purple-500/50',
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      {/* 배경 오버레이 - 배틀 분위기 */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-black/90 via-red-950/30 to-black/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* 메인 컨테이너 - 좌우 배치 */}
      <div className="relative w-full max-w-5xl mx-4 max-h-[90vh] flex gap-4">
        
        {/* 왼쪽 - 보스 영역 (세로 직사각형) */}
        <div className="shrink-0 w-64 flex flex-col">
          {/* 보스가 있을 때 */}
          {currentBoss && currentBossProgress && !isCurrentBossDefeated && (
            <div className="flex-1 flex flex-col bg-slate-900/90 rounded-2xl border border-red-900/30 overflow-hidden">
              {/* 보스 세로 이미지 */}
              <div className="relative flex-1 min-h-[300px]">
                <img
                  src={`/assets/bosses/${currentBoss.image}`}
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
                <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold border ${difficultyColors[currentBoss.difficulty]}`}>
                  {currentBoss.difficulty.toUpperCase()}
                </div>

                {/* 보스 정보 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-xl font-black text-white drop-shadow-lg">{currentBoss.name}</p>
                  <p className="text-xs text-gray-400 mt-1">오늘 처치: <span className="text-yellow-400 font-bold">{dailyState?.totalDefeated ?? 0}마리</span></p>
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
          )}

          {/* 보스 처치됨 - 난이도 선택 */}
          {isCurrentBossDefeated && totalRemaining > 0 && (
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
                  onSelect={handleSelectDifficulty}
                  remainingCounts={remainingCounts}
                />
              </div>
            </div>
          )}

          {/* 모든 보스 소진 */}
          {allBossesExhausted && (
            <div className="flex-1 bg-gradient-to-b from-yellow-900/30 via-yellow-800/20 to-yellow-900/30 rounded-2xl p-6 border border-yellow-500/30 flex flex-col items-center justify-center text-center">
              <div className="inline-block animate-pulse">
                <span className="text-6xl">🏆</span>
              </div>
              <p className="text-xl font-black text-yellow-400 mt-3">전투 완료!</p>
              <p className="text-sm text-gray-400 mt-1">모든 보스를<br/>처치했습니다</p>
            </div>
          )}

          {/* 보스 없는 초기 상태 */}
          {!currentBoss && !isCurrentBossDefeated && (
            <div className="flex-1 bg-slate-900/90 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-5xl opacity-50">👹</span>
              <p className="text-gray-400 mt-3">보스 없음</p>
              <p className="text-xs text-gray-500 mt-1">난이도를 선택하세요</p>
            </div>
          )}
        </div>

        {/* 오른쪽 - 미션 카드 영역 */}
        <div className="flex-1 min-h-0 bg-slate-900/80 rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col">
          {/* 미션 헤더 */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚔️</span>
              <span className="font-bold text-white">미션 카드</span>
              <span className="text-xs text-gray-400 ml-2">
                사용 가능: <span className="text-red-400 font-bold">{availableMissionsCount}</span>/{enabledMissionsList.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition text-xl"
            >
              ✕
            </button>
          </div>

          {/* 미션 그리드 */}
          <div className="flex-1 overflow-y-auto p-4">
            {enabledMissionsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <span className="text-5xl opacity-50">📋</span>
                <p className="text-gray-400">등록된 미션이 없습니다</p>
                <p className="text-xs text-gray-500">설정 → 전투에서 미션을 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {enabledMissionsList.map((mission, index) => (
                  <BattleMissionCard
                    key={mission.id}
                    mission={mission}
                    isUsed={usedMissionIds.has(mission.id)}
                    onComplete={handleCompleteMission}
                    disabled={noBoss}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 하단 안내 */}
          <div className="shrink-0 px-4 py-2 border-t border-slate-700/50 bg-slate-800/50">
            <p className="text-[10px] text-gray-500 text-center">
              💡 미션은 하루에 한 번씩만 사용 가능 • 보스 처치 시 XP 획득 • ESC로 닫기
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
