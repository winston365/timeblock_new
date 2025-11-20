/**
 * TopToolbar - 상단 툴바 (에너지/XP/와이푸 상태 + 주요 액션)
 */

import { useState } from 'react';
import type React from 'react';
import type { GameState } from '@/shared/types/domain';
import { useEnergy } from '@/features/energy/hooks/useEnergy';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { getAffectionColor } from '@/features/waifu/waifuImageUtils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { getDialogueFromAffection } from '@/data/repositories/waifuRepository';
import { audioService } from '@/shared/services/media/audioService';
import { useFocusStore } from '@/shared/stores/focusStore';
import { useTaskBreakdownStore } from '@/features/tasks/stores/breakdownStore';

interface TopToolbarProps {
  gameState: GameState | null;
  onOpenGeminiChat?: () => void;
  onOpenTemplates?: () => void;
}

export default function TopToolbar({ gameState, onOpenGeminiChat, onOpenTemplates }: TopToolbarProps) {
  const { currentEnergy } = useEnergy();
  const { waifuState, currentMood } = useWaifu();
  const { show } = useWaifuCompanionStore();
  const { toggleFocusMode } = useFocusStore();
  const { isLoading: aiAnalyzing, cancelBreakdown } = useTaskBreakdownStore();
  const [hovered, setHovered] = useState<string | null>(null);

  const handleCallWaifu = () => {
    if (waifuState) {
      const dialogue = getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday);

      if (dialogue.audio) {
        audioService.play(dialogue.audio);
      }

      show(dialogue.text, dialogue.audio);
    } else {
      show('하루야~ 오늘도 힘내자!');
    }

    setTimeout(() => {
      useWaifuCompanionStore.getState().peek();
    }, 10000);
  };

  const statItemClass = 'flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]';

  const gradientString =
    'linear-gradient(to right,' +
    ' var(--color-primary),' +
    ' var(--color-primary) 16.65%,' +
    ' #7c3aed 16.65%,' +
    ' #7c3aed 33.3%,' +
    ' #22c55e 33.3%,' +
    ' #22c55e 49.95%,' +
    ' #0ea5e9 49.95%,' +
    ' #0ea5e9 66.6%,' +
    ' #f59e0b 66.6%,' +
    ' #f59e0b 83.25%,' +
    ' #ef4444 83.25%,' +
    ' #ef4444 100%)';

  const baseButtonClass =
    'relative inline-flex items-center justify-center rounded-md border-0 px-5 py-3 font-bold text-white shadow transition duration-200 ease-out will-change-transform';

  const renderCTA = (id: string, label: string, onClick?: () => void) => {
    const isHover = hovered === id;
    return (
      <button
        key={id}
        type="button"
        className={baseButtonClass}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        onClick={onClick}
        style={
          {
            ['--btn-width' as string]: '150px',
            ['--timing' as string]: '2s',
            background: isHover ? undefined : 'var(--color-primary)',
            backgroundImage: isHover ? gradientString : undefined,
            animation: isHover ? 'dance6123 var(--timing) linear infinite' : undefined,
            transform: isHover ? 'scale(1.08) translateY(-1px)' : undefined,
            boxShadow: isHover
              ? '0 12px 28px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.18)'
              : '0 6px 16px rgba(0,0,0,0.18)',
          } as React.CSSProperties
        }
      >
        <span className="relative z-10 text-sm uppercase tracking-[0.06em]">{label}</span>
      </button>
    );
  };

  return (
    <header
      className="flex flex-col gap-[var(--spacing-md)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[var(--color-text)] md:flex-row md:items-center"
      role="banner"
    >
      <style>{`@keyframes dance6123 { to { background-position: var(--btn-width); } }`}</style>
      <h1 className="text-base font-semibold tracking-tight">하루 루틴 컨트롤러</h1>

      <div className="flex flex-1 flex-wrap items-center gap-[var(--spacing-lg)] text-sm">
        <div className={statItemClass}>
          <span>현재 에너지:</span>
          <span>{currentEnergy > 0 ? `${currentEnergy}%` : '-'}</span>
        </div>
        <div className={statItemClass}>
          <span>오늘 획득 XP:</span>
          <span>{gameState?.dailyXP ?? 0}</span>
        </div>
        <div className={statItemClass}>
          <span>사용 가능 XP:</span>
          <span>{gameState?.availableXP ?? 0}</span>
        </div>
        <div className={statItemClass}>
          <span>집중 세션 기록:</span>
          <span className="font-mono">{gameState?.dailyTimerCount ?? 0}회</span>
        </div>

        {waifuState && (
          <div className={`${statItemClass} gap-3`}>
            <span>와이푸 애정도</span>
            <div className="relative h-2 w-16 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: `${waifuState.affection}%`,
                  backgroundColor: getAffectionColor(waifuState.affection),
                }}
              />
            </div>
            <span>{waifuState.affection}%</span>
          </div>
        )}

        {waifuState && currentMood && (
          <div className={`${statItemClass} gap-3`}>
            <span>분위기:</span>
            <span className="text-lg" title={currentMood}>
              {currentMood}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--spacing-sm)] md:ml-auto">
        {/* AI 분석 인디케이터 */}
        {aiAnalyzing && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] animate-pulse">
            <span className="animate-spin text-base">🧠</span>
            <span>AI 분석 중...</span>
            <button
              onClick={cancelBreakdown}
              className="ml-2 rounded-lg bg-[var(--color-primary)]/20 px-2 py-1 text-xs hover:bg-[var(--color-primary)]/30 transition"
              title="취소"
            >
              ✕
            </button>
          </div>
        )}
        {renderCTA('zen', '🧘 집중모드', toggleFocusMode)}
        {renderCTA('waifu', '💬 와이푸', handleCallWaifu)}
        {renderCTA('templates', '📋 템플릿', onOpenTemplates)}
        {renderCTA('chat', '✨ AI 채팅', onOpenGeminiChat)}
      </div>
    </header>
  );
}
