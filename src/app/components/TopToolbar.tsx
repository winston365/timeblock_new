/**
 * TopToolbar - 상단 툴바 (에너지/XP/와이푸 상태 + 주요 액션)
 */

import type { GameState } from '@/shared/types/domain';
import { useEnergy } from '@/features/energy/hooks/useEnergy';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { getAffectionColor } from '@/features/waifu/waifuImageUtils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { getDialogueFromAffection } from '@/data/repositories/waifuRepository';
import { audioService } from '@/shared/services/media/audioService';
import { useFocusStore } from '@/shared/stores/focusStore';

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
  const toolbarButtonClass =
    'rounded-xl border border-white/10 bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-[var(--color-primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40';

  return (
    <header
      className="flex flex-col gap-[var(--spacing-md)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[var(--color-text)] md:flex-row md:items-center"
      role="banner"
    >
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

      <div className="flex flex-wrap gap-[var(--spacing-sm)] md:ml-auto">
        <button
          className={toolbarButtonClass}
          onClick={toggleFocusMode}
          title="Zen Mode (Focus)"
        >
          🧘 Zen Mode
        </button>
        <button className={toolbarButtonClass} onClick={handleCallWaifu} title="와이푸 호출">
          💬 Waifu
        </button>
        <button className={toolbarButtonClass} onClick={onOpenTemplates} title="템플릿 관리">
          📋 Templates
        </button>
        <button className={toolbarButtonClass} onClick={onOpenGeminiChat} title="AI 대화">
          ✨ AI Chat
        </button>
      </div>
    </header>
  );
}
