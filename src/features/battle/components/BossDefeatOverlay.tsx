/**
 * BossDefeatOverlay - 보스 처치 연출 오버레이
 *
 * @role 보스 처치 시 화려한 축하 연출 + 다음 보스 난이도 선택
 * @input 처치된 보스 정보, XP 보상, 남은 보스 수
 * @output 풀스크린 오버레이 애니메이션
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Boss, BossDifficulty } from '@/shared/types/domain';
import { pickRandomQuote } from '../utils/quotes';
import { useModalHotkeys } from '@/shared/hooks';

interface BossDefeatOverlayProps {
  boss: Boss;
  xpEarned: number;
  onClose: () => void;
  /** 남은 보스 수 (난이도별) */
  remainingCounts?: Record<BossDifficulty, number>;
  /** 난이도 선택 시 콜백 */
  onSelectDifficulty?: (difficulty: BossDifficulty) => void;
  /** 오버킬 데미지 (다음 보스에 이월될 데미지) */
  overkillDamage?: number;
  /** 순차 진행 완료 여부 (true면 난이도 선택 UI 표시) */
  isSequentialComplete?: boolean;
  /** 다음 순차 진행 단계 (0~5) */
  nextSequentialPhase?: number;
}

/**
 * 순차 진행 단계별 난이도 라벨
 */
const PHASE_LABELS: Record<number, { difficulty: string; emoji: string; label: string }> = {
  1: { difficulty: 'normal', emoji: '🟡', label: '보통' },
  2: { difficulty: 'hard', emoji: '🔴', label: '어려움' },
  3: { difficulty: 'hard', emoji: '🔴', label: '어려움 (2회차)' },
  4: { difficulty: 'epic', emoji: '🟣', label: '에픽' },
};

export function BossDefeatOverlay({
  boss,
  xpEarned,
  onClose,
  remainingCounts,
  onSelectDifficulty,
  overkillDamage,
  isSequentialComplete = false,
  nextSequentialPhase = 5,
}: BossDefeatOverlayProps) {
  const [stage, setStage] = useState<'flash' | 'reveal' | 'quote' | 'reward' | 'select'>('flash');
  const defeatQuote = useMemo(
    () => pickRandomQuote(boss.defeatQuotes, boss.defeatQuote),
    [boss.defeatQuotes, boss.defeatQuote],
  );

  // 남은 보스가 있는지 확인
  const hasRemainingBosses = useMemo(() => {
    if (!remainingCounts) return false;
    return Object.values(remainingCounts).some(count => count > 0);
  }, [remainingCounts]);

  // ESC 키로 오버레이 닫기 (click-to-close, auto-close와 별도로 동작)
  useModalHotkeys({
    isOpen: true,
    onEscapeClose: onClose,
  });

  // 순차 진행 중 다음 단계 정보
  const nextPhaseInfo = PHASE_LABELS[nextSequentialPhase];

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStage('reveal'), 300));
    timers.push(setTimeout(() => setStage('quote'), 1200));
    timers.push(setTimeout(() => setStage('reward'), 2200));

    // 순차 진행 완료 & 남은 보스가 있으면 선택 단계로
    if (isSequentialComplete && hasRemainingBosses && onSelectDifficulty) {
      timers.push(setTimeout(() => setStage('select'), 3500));
    } else {
      // 순차 진행 중이거나 보스 없으면 자동 닫힘
      timers.push(setTimeout(() => onClose(), 4000));
    }

    return () => timers.forEach(clearTimeout);
  }, [onClose, hasRemainingBosses, onSelectDifficulty, isSequentialComplete]);

  const handleSelectDifficulty = useCallback((difficulty: BossDifficulty) => {
    if (onSelectDifficulty) {
      onSelectDifficulty(difficulty);
    }
    onClose();
  }, [onSelectDifficulty, onClose]);

  const difficulties: Array<{ key: BossDifficulty; label: string; emoji: string; color: string }> = [
    { key: 'easy', label: '쉬움', emoji: '🟢', color: 'green' },
    { key: 'normal', label: '보통', emoji: '🟡', color: 'yellow' },
    { key: 'hard', label: '어려움', emoji: '🔴', color: 'red' },
    { key: 'epic', label: '에픽', emoji: '🟣', color: 'purple' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="보스 처치 완료"
    >
      {/* 배경 오버레이 */}
      <div
        className={`absolute inset-0 transition-all duration-500 ${stage === 'flash' ? 'bg-white' : 'bg-black/80 backdrop-blur-sm'
          }`}
      />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center">
        {/* 처치 텍스트 */}
        <div
          className={`transform transition-all duration-500 ${stage === 'flash' ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
            }`}
        >
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-gray-400">
            ENEMY DEFEATED
          </p>
          <h1
            className="text-4xl font-black text-white drop-shadow-2xl md:text-5xl"
            style={{
              fontFamily: "'Black Ops One', 'Noto Sans KR', sans-serif",
              textShadow: '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.4)',
            }}
          >
            {boss.name}
          </h1>
        </div>

        {/* 보스 아이콘 */}
        <div
          className={`transform transition-all duration-700 delay-200 ${stage === 'flash' || stage === 'reveal' ? 'scale-0 rotate-180' : 'scale-100 rotate-0'
            } ${stage === 'select' ? 'scale-75' : ''}`}
        >
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30 blur-xl" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-red-500 bg-gradient-to-br from-red-900 to-red-700 text-6xl shadow-2xl">
              💀
            </div>
          </div>
        </div>

        {/* 처치 대사 */}
        <div
          className={`max-w-md transform transition-all duration-500 ${(stage === 'quote' || stage === 'reward')
              ? 'translate-y-0 opacity-100'
              : stage === 'select'
                ? 'scale-75 opacity-50'
                : 'translate-y-4 opacity-0'
            }`}
        >
          <blockquote className="rounded-lg border border-gray-700 bg-gray-900/80 px-6 py-4 italic text-gray-300 shadow-lg">
            <span className="text-2xl text-gray-500">"</span>
            {defeatQuote}
            <span className="text-2xl text-gray-500">"</span>
          </blockquote>
        </div>

        {/* XP 보상 */}
        <div
          className={`transform transition-all duration-500 ${stage === 'reward' || stage === 'select' ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-75 opacity-0'
            } ${stage === 'select' ? 'scale-75' : ''}`}
        >
          <div className="flex items-center gap-3 rounded-full border border-yellow-500/50 bg-yellow-500/20 px-6 py-3 shadow-lg">
            <span className="text-3xl">⭐</span>
            <div className="text-left">
              <p className="text-xs font-medium uppercase tracking-wider text-yellow-400">
                Reward
              </p>
              <p className="text-2xl font-black text-yellow-300">+{xpEarned} XP</p>
            </div>
          </div>
        </div>

        {/* 오버킬 데미지 표시 */}
        {overkillDamage !== undefined && overkillDamage > 0 && (stage === 'reward' || stage === 'select') && (
          <div
            className={`transform transition-all duration-500 delay-200 ${stage === 'reward' || stage === 'select' ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-75 opacity-0'
              } ${stage === 'select' ? 'scale-75' : ''}`}
          >
            <div className="flex items-center gap-2 rounded-full border border-orange-500/50 bg-orange-500/20 px-4 py-2 shadow-lg animate-pulse">
              <span className="text-xl">💥</span>
              <div className="text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-orange-400">
                  Overkill Damage
                </p>
                <p className="text-sm font-bold text-orange-300">
                  다음 보스 HP -{overkillDamage}분
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 순차 진행 중 다음 난이도 안내 */}
        {!isSequentialComplete && nextPhaseInfo && stage === 'reward' && (
          <div
            className="transform transition-all duration-500 delay-300 translate-y-0 scale-100 opacity-100"
          >
            <div className="flex items-center gap-2 rounded-full border border-blue-500/50 bg-blue-500/20 px-4 py-2 shadow-lg">
              <span className="text-xl">{nextPhaseInfo.emoji}</span>
              <div className="text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-400">
                  Next Challenge
                </p>
                <p className="text-sm font-bold text-blue-300">
                  {nextPhaseInfo.label} 보스 등장!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 순차 진행 완료 축하 메시지 */}
        {isSequentialComplete && nextSequentialPhase === 5 && stage === 'reward' && (
          <div
            className="transform transition-all duration-500 delay-300 translate-y-0 scale-100 opacity-100"
          >
            <div className="flex items-center gap-2 rounded-full border border-green-500/50 bg-green-500/20 px-4 py-2 shadow-lg animate-pulse">
              <span className="text-xl">🏆</span>
              <div className="text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-green-400">
                  Sequential Complete!
                </p>
                <p className="text-sm font-bold text-green-300">
                  자유 선택 모드 해금!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 난이도 선택 단계 */}
        {stage === 'select' && remainingCounts && (
          <div className="transform animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm text-gray-300 mb-4">다음 보스 난이도를 선택하세요</p>
            <div className="grid grid-cols-2 gap-3 w-80">
              {difficulties.map(({ key, label, emoji, color }) => {
                const count = remainingCounts[key] ?? 0;
                const isDisabled = count === 0;

                return (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDisabled) handleSelectDifficulty(key);
                    }}
                    disabled={isDisabled}
                    className={`
                      flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all
                      ${isDisabled
                        ? 'border-gray-700 bg-gray-800/50 opacity-40 cursor-not-allowed'
                        : `border-${color}-500/50 bg-${color}-500/20 hover:border-${color}-500 hover:bg-${color}-500/30 hover:scale-105 active:scale-95`
                      }
                    `}
                    style={!isDisabled ? {
                      borderColor: color === 'green' ? '#22c55e80' : color === 'yellow' ? '#eab30880' : color === 'red' ? '#ef444480' : '#a855f780',
                      backgroundColor: color === 'green' ? '#22c55e20' : color === 'yellow' ? '#eab30820' : color === 'red' ? '#ef444420' : '#a855f720',
                    } : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{emoji}</span>
                      <span className={`font-bold ${isDisabled ? 'text-gray-500' : 'text-white'}`}>
                        {label}
                      </span>
                    </span>
                    <span className={`text-sm font-mono ${isDisabled ? 'text-gray-600' : 'text-gray-300'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              또는 아무 곳이나 클릭하여 나중에 선택
            </p>
          </div>
        )}

        {/* 닫기 안내 (선택 단계 아닐 때만) */}
        {stage !== 'select' && (
          <p
            className={`text-xs text-gray-500 transition-opacity duration-500 ${stage === 'reward' ? 'opacity-100' : 'opacity-0'
              }`}
          >
            화면을 클릭하면 닫힙니다
          </p>
        )}
      </div>

      {/* 파티클 효과 */}
      {stage !== 'flash' && stage !== 'select' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
                opacity: 0.6,
              }}
            >
              {['⭐', '✨', '💫', '🔥', '💥'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
