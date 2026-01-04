/**
 * BattleMissionCard - 전투 미션 카드 컴포넌트
 *
 * @role 개별 미션 카드 UI 및 상호작용
 * @description
 *   - 미션 정보 표시 (텍스트, 데미지, 쿨다운)
 *   - 보스 HP 대비 데미지 바 시각화
 *   - 완료 스탬프 + "오늘 완료!" 배지
 *   - 쿨다운 상태 표시
 *   - 공격/스케줄 추가 액션
 */

import { useState } from 'react';
import type { BattleMission } from '@/shared/types/domain';
import { useTimeout } from '@/shared/hooks';
import {
  formatCooldownTime,
  ATTACK_ANIMATION_DURATION_MS,
  MISSION_CARD_ANIMATION_DELAY_MS,
} from '../../constants/battleConstants';

interface BattleMissionCardProps {
  /** 미션 데이터 */
  mission: BattleMission;
  /** 하루 1회 제한으로 사용 완료됨 */
  isUsed: boolean;
  /** 쿨다운 중 여부 */
  isOnCooldown: boolean;
  /** 남은 쿨다운 (분), -1이면 하루 1회 제한 */
  cooldownRemaining: number;
  /** 미션 완료 핸들러 */
  onComplete: (missionId: string) => void;
  /** 스케줄에 추가 핸들러 */
  onAddToSchedule: (mission: BattleMission) => void;
  /** 보스 없음 등으로 비활성화 */
  disabled: boolean;
  /** 카드 인덱스 (애니메이션 지연용) */
  index: number;
  /** 현재 보스 HP (데미지 바 비율 계산용) */
  currentBossHp?: number;
  /** 추천 미션 여부 */
  isRecommended?: boolean;
}

/**
 * 전투 미션 카드 컴포넌트
 */
export function BattleMissionCard({
  mission,
  isUsed,
  isOnCooldown,
  cooldownRemaining,
  onComplete,
  onAddToSchedule,
  disabled,
  index,
  currentBossHp,
  isRecommended = false,
}: BattleMissionCardProps) {
  const [isAttacking, setIsAttacking] = useState(false);
  const attackTimer = useTimeout();

  const triggerAttack = () => {
    if (isUsed || isOnCooldown || disabled) return;

    setIsAttacking(true);
    attackTimer.set(() => {
      setIsAttacking(false);
      onComplete(mission.id);
    }, ATTACK_ANIMATION_DURATION_MS);
  };

  const handleCardClick = () => {
    triggerAttack();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      !isUsed &&
      !isOnCooldown &&
      !disabled
    ) {
      event.preventDefault();
      triggerAttack();
    }
  };

  const handleAttackButtonClick: React.MouseEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    event.stopPropagation();
    triggerAttack();
  };

  const handleAddToSchedule = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAddToSchedule(mission);
  };

  const isUnavailable = isUsed || isOnCooldown;
  const cooldownLabel =
    mission.cooldownMinutes && mission.cooldownMinutes > 0
      ? isOnCooldown
        ? formatCooldownTime(cooldownRemaining)
        : formatCooldownTime(mission.cooldownMinutes)
      : '';
  const attackLabel = isOnCooldown ? '쿨다운 중' : isUsed ? '완료됨' : '공격!';

  // 데미지 바 비율 계산 (보스 HP 대비)
  const damagePercent = currentBossHp && currentBossHp > 0
    ? Math.min(100, Math.round((mission.damage / currentBossHp) * 100))
    : 0;

  return (
    <div
      role="button"
      tabIndex={isUnavailable || disabled ? -1 : 0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={`
        group relative flex flex-col rounded-xl overflow-hidden transition-all duration-200 min-h-[180px]
        ${
          isUnavailable
            ? 'cursor-default'
            : disabled
              ? 'opacity-50 cursor-not-allowed grayscale'
              : `hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98] cursor-pointer`
        }
        ${isAttacking ? 'animate-pulse scale-95' : ''}
        ${isRecommended && !isUnavailable ? 'ring-2 ring-amber-400/60' : ''}
      `}
      style={{ animationDelay: `${index * MISSION_CARD_ANIMATION_DELAY_MS}ms` }}
      aria-disabled={isUnavailable || disabled}
    >
      {/* 카드 배경 */}
      <div
        className={`
        relative border-2 ${isUnavailable ? (isOnCooldown ? 'border-cyan-500/50' : 'border-emerald-500/50') : 'border-slate-600'} 
        bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-3 h-full flex flex-col gap-2
      `}
      >
        {/* 완료 스탬프 오버레이 */}
        {isUsed && !isOnCooldown && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="relative">
              {/* 스탬프 배경 */}
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl scale-150" />
              {/* 스탬프 */}
              <div className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl border-2 border-emerald-400/60 bg-emerald-500/30 backdrop-blur-sm transform -rotate-12">
                <span className="text-2xl">✅</span>
                <span className="text-xs font-black text-emerald-200 whitespace-nowrap">오늘 완료!</span>
              </div>
            </div>
          </div>
        )}

        {/* 추천 미션 배지 */}
        {isRecommended && !isUnavailable && (
          <div className="absolute -top-1 -right-1 z-20">
            <div className="px-2 py-0.5 rounded-full bg-amber-500 text-[9px] font-black text-black shadow-lg">
              ⭐ 추천
            </div>
          </div>
        )}

        {/* 상단 영역: 상태 뱃지 */}
        <div className="flex items-center justify-between gap-2">
          {/* 쿨다운 뱃지 */}
          {isOnCooldown && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40">
              <span className="text-xs">⏱️</span>
              <span className="text-[10px] font-bold text-cyan-300">
                {formatCooldownTime(cooldownRemaining)}
              </span>
            </div>
          )}
          {!isUnavailable && <div />}
        </div>

        {/* 미션 텍스트 + 데미지 */}
        <div className={`flex items-start justify-between gap-2 ${isUsed && !isOnCooldown ? 'opacity-40' : ''}`}>
          <p
            className={`text-sm font-semibold leading-snug break-words flex-1 ${
              isUsed
                ? 'text-emerald-200'
                : isOnCooldown
                  ? 'text-cyan-200'
                  : 'text-gray-100'
            }`}
          >
            {mission.text}
          </p>
          <div
            className={`
            shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black
            ${isUsed ? 'bg-emerald-500/30 text-emerald-300' : isOnCooldown ? 'bg-cyan-500/30 text-cyan-300' : 'bg-red-500/30 text-red-300'}
          `}
          >
            <span className="text-sm leading-none">⚔️</span>
            <span className="text-sm leading-none font-black">
              {mission.damage}
            </span>
          </div>
        </div>

        {/* 데미지 바 (보스 HP 대비) */}
        {currentBossHp && currentBossHp > 0 && !isUsed && (
          <div className={`${isOnCooldown ? 'opacity-50' : ''}`}>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  damagePercent >= 100 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-600 to-red-400'
                }`}
                style={{ width: `${Math.min(100, damagePercent)}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-slate-400">
                {damagePercent >= 100 ? '💀 처치 가능!' : `${damagePercent}%`}
              </span>
            </div>
          </div>
        )}

        {/* 쿨다운 표시 (설정된 쿨다운 시간) - 사용 전에만 표시 */}
        {cooldownLabel && !isOnCooldown && !isUsed && (
          <div className="flex justify-start">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-[9px] font-medium text-slate-300 whitespace-nowrap">
              <span>🔄</span>
              <span>{cooldownLabel}</span>
            </span>
          </div>
        )}

        {/* 여백용 flex-grow */}
        <div className="flex-1" />

        {/* 액션 버튼 */}
        <div className={`flex gap-2 ${isUsed && !isOnCooldown ? 'opacity-40' : ''}`}>
          <button
            type="button"
            onClick={handleAttackButtonClick}
            disabled={isUnavailable || disabled}
            className={`
              flex-1 rounded-lg px-3 py-2 text-[11px] font-bold text-white transition
              ${
                isUnavailable || disabled
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 shadow-md shadow-red-900/30'
              }
            `}
          >
            {attackLabel}
          </button>
          <button
            type="button"
            onClick={handleAddToSchedule}
            className="flex-1 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-[11px] font-bold text-indigo-100 transition hover:border-indigo-300 hover:bg-indigo-500/20"
          >
            할일 추가
          </button>
        </div>
      </div>
    </div>
  );
}
