/**
 * BossDefeatOverlay - 보스 처치 연출 오버레이
 *
 * @role 보스 처치 시 화려한 축하 연출
 * @input 처치된 보스 정보, XP 보상
 * @output 풀스크린 오버레이 애니메이션
 */

import { useEffect, useMemo, useState } from 'react';
import type { Boss } from '@/shared/types/domain';
import { pickRandomQuote } from '../utils/quotes';

interface BossDefeatOverlayProps {
  boss: Boss;
  xpEarned: number;
  onClose: () => void;
  /** 자동 닫힘 시간 (ms) */
  autoCloseDelay?: number;
}

export function BossDefeatOverlay({
  boss,
  xpEarned,
  onClose,
  autoCloseDelay = 4000,
}: BossDefeatOverlayProps) {
  const [stage, setStage] = useState<'flash' | 'reveal' | 'quote' | 'reward'>('flash');
  const defeatQuote = useMemo(
    () => pickRandomQuote(boss.defeatQuotes, boss.defeatQuote),
    [boss.defeatQuotes, boss.defeatQuote, boss.id],
  );

  useEffect(() => {
    // 단계별 애니메이션 타이밍
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStage('reveal'), 300));
    timers.push(setTimeout(() => setStage('quote'), 1200));
    timers.push(setTimeout(() => setStage('reward'), 2200));
    timers.push(setTimeout(() => onClose(), autoCloseDelay));

    return () => timers.forEach(clearTimeout);
  }, [autoCloseDelay, onClose]);

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
        className={`absolute inset-0 transition-all duration-500 ${
          stage === 'flash' ? 'bg-white' : 'bg-black/80 backdrop-blur-sm'
        }`}
      />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center">
        {/* 처치 텍스트 */}
        <div
          className={`transform transition-all duration-500 ${
            stage === 'flash' ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
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
          className={`transform transition-all duration-700 delay-200 ${
            stage === 'flash' || stage === 'reveal' ? 'scale-0 rotate-180' : 'scale-100 rotate-0'
          }`}
        >
          <div className="relative">
            {/* 글로우 */}
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30 blur-xl" />
            {/* 스컬 아이콘 */}
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-red-500 bg-gradient-to-br from-red-900 to-red-700 text-6xl shadow-2xl">
              💀
            </div>
          </div>
        </div>

        {/* 처치 대사 */}
        <div
          className={`max-w-md transform transition-all duration-500 ${
            stage === 'quote' || stage === 'reward'
              ? 'translate-y-0 opacity-100'
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
          className={`transform transition-all duration-500 ${
            stage === 'reward' ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-75 opacity-0'
          }`}
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

        {/* 닫기 안내 */}
        <p
          className={`text-xs text-gray-500 transition-opacity duration-500 ${
            stage === 'reward' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          화면을 클릭하면 닫힙니다
        </p>
      </div>

      {/* 파티클 효과 (간단한 CSS 애니메이션) */}
      {stage !== 'flash' && (
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
