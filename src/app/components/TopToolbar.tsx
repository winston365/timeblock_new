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
import { useTaskBreakdownStore } from '@/features/tasks/stores/breakdownStore';
import { useXPParticleStore } from '@/features/gamification/stores/xpParticleStore';
import { useEffect, useRef } from 'react';
import WeatherWidget from '@/features/weather/WeatherWidget';
import IgnitionButton from '@/features/ignition/components/IgnitionButton';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { StatsModal } from '@/features/stats/StatsModal';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { useScheduleViewStore } from '@/features/schedule/stores/scheduleViewStore';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { BingoModal, BINGO_PROGRESS_STORAGE_KEY } from '@/features/gamification/BingoModal';
import { DEFAULT_BINGO_CELLS, SETTING_DEFAULTS } from '@/shared/constants/defaults';
import { fetchFromFirebase, listenToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { bingoProgressStrategy } from '@/shared/services/sync/firebase/strategies';
import { getLocalDate } from '@/shared/lib/utils';
import { db } from '@/data/db/dexieClient';
import type { BingoProgress } from '@/shared/types/domain';

interface TopToolbarProps {
  gameState: GameState | null;
  onOpenGeminiChat?: () => void;
  onOpenTemplates?: () => void;
  onOpenSettings?: () => void;
}

export default function TopToolbar({ gameState, onOpenGeminiChat, onOpenTemplates, onOpenSettings }: TopToolbarProps) {
  const { currentEnergy } = useEnergy();
  const { waifuState, currentMood } = useWaifu();
  const { show } = useWaifuCompanionStore();
  const { isLoading: aiAnalyzing, cancelBreakdown } = useTaskBreakdownStore();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showBingo, setShowBingo] = useState(false);
  const [bingoCompletedCells, setBingoCompletedCells] = useState(0);
  const { settings } = useSettingsStore();
  const isNormalWaifu = settings?.waifuMode === 'normal';

  // Schedule View 상태 (워밍업, 지금모드, 지난블록)
  const { isFocusMode, toggleFocusMode } = useFocusModeStore();
  const { showPastBlocks, toggleShowPastBlocks, openWarmupModal } = useScheduleViewStore();
  
  // 현재 시간 기준 타임블록 계산
  const currentHour = new Date().getHours();
  const currentBlockId = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end)?.id ?? null;
  const pastBlocksCount = TIME_BLOCKS.filter(block => currentHour >= block.end).length;

  const handleCallWaifu = () => {
    if (isNormalWaifu) return;

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

  const statItemClass =
    'flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text)]';
  const statValueClass = 'font-mono font-bold text-sm text-[var(--color-text)]';

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
    'relative inline-flex items-center justify-center rounded-md border-0 px-3.5 py-2 text-xs font-bold text-white shadow transition duration-200 ease-out will-change-transform';

  const bingoCells = Array.isArray(settings?.bingoCells) && settings.bingoCells.length === 9 ? settings.bingoCells : DEFAULT_BINGO_CELLS;
  const bingoMaxLines = settings?.bingoMaxLines ?? SETTING_DEFAULTS.bingoMaxLines;
  const bingoLineRewardXP = settings?.bingoLineRewardXP ?? SETTING_DEFAULTS.bingoLineRewardXP;
  const today = getLocalDate();

  // Load bingo progress summary (completed cells) and keep synced
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const remote = await fetchFromFirebase(bingoProgressStrategy, today);
        if (mounted && remote?.date === today) {
          setBingoCompletedCells(remote.completedCells.length);
          // 캐시
          await db.systemState.put({ key: `${BINGO_PROGRESS_STORAGE_KEY}:${today}`, value: remote as BingoProgress });
          return;
        }
      } catch (error) {
        console.error('Failed to fetch bingo summary:', error);
      }
      try {
        const stored = await db.systemState.get(`${BINGO_PROGRESS_STORAGE_KEY}:${today}`);
        const value = stored?.value as BingoProgress | undefined;
        if (mounted && value && value.date === today && Array.isArray(value.completedCells)) {
          setBingoCompletedCells(value.completedCells.length);
          return;
        }
      } catch (error) {
        console.error('Failed to read local bingo summary (Dexie):', error);
      }
      if (mounted) {
        setBingoCompletedCells(0);
      }
    };

    load();
    const unsubscribe = listenToFirebase(bingoProgressStrategy, (remote) => {
      if (remote?.date === today) {
        setBingoCompletedCells(remote.completedCells.length);
        db.systemState.put({ key: `${BINGO_PROGRESS_STORAGE_KEY}:${today}`, value: remote as BingoProgress }).catch(() => { });
      }
    }, today);

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [today]);

  const renderCTA = (id: string, label: string, onClick?: () => void, badge?: string | number) => {
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
        {badge !== undefined && badge !== null && badge !== '' && (
          <span className="absolute -right-1 -top-1 z-20 flex h-5 min-w-[32px] items-center justify-center rounded-full bg-emerald-500 px-2 text-[10px] font-bold leading-none text-white shadow">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <header
        className="flex flex-col gap-[var(--spacing-sm)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--spacing-lg)] py-[calc(var(--spacing-sm)+2px)] text-[var(--color-text)] md:flex-row md:items-center"
        role="banner"
      >
        <style>{`@keyframes dance6123 { to { background-position: var(--btn-width); } }`}</style>
        <h1 className="text-sm font-semibold tracking-tight">하루 루틴 컨트롤러</h1>

      <div className="flex flex-1 flex-wrap items-center gap-[var(--spacing-md)] text-[13px]">
        <div className={statItemClass}>
          <span>⚡ 에너지:</span>
          <span className={statValueClass}>{currentEnergy > 0 ? `${currentEnergy}%` : '-'}</span>
        </div>
        <div className={statItemClass}>
          <span>⭐ 오늘 XP:</span>
          <span
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                // Update target position only if it changes significantly to avoid loops
                // But for now, just setting it on mount/resize is enough.
                // We'll use a useEffect for cleaner logic.
              }
            }}
            className={statValueClass}
          >
            {gameState?.dailyXP ?? 0}
          </span>
          <XPPositionRegistrar />
        </div>
        <div className={statItemClass}>
          <span>⭐ 사용 가능:</span>
          <span className={statValueClass}>{gameState?.availableXP ?? 0}</span>
        </div>
        <div className={statItemClass}>
          <span>✅ 세션:</span>
          <span className={statValueClass}>{gameState?.dailyTimerCount ?? 0}회</span>
        </div>

        {waifuState && (
          <div className={`${statItemClass} gap-3`}>
            {!isNormalWaifu && <span>와이푸 애정도</span>}
            <div className="relative h-2 w-16 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: `${waifuState.affection}%`,
                  backgroundColor: getAffectionColor(waifuState.affection),
                }}
              />
            </div>
            {!isNormalWaifu && <span>{waifuState.affection}%</span>}
          </div>
        )}

        {waifuState && currentMood && (
          <div className={`${statItemClass} gap-2.5`}>
            <span>분위기:</span>
            <span className="text-base" title={currentMood}>
              {currentMood}
            </span>
          </div>
        )}

        {/* Weather Widget */}
        <WeatherWidget />

        {/* Schedule View 컨트롤 (압축형) */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">
          <button
            type="button"
            onClick={openWarmupModal}
            className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition"
            title="워밍업 세트"
          >
            🧊
          </button>
          <button
            type="button"
            onClick={() => {
              if (!currentBlockId) {
                alert('현재 진행 중인 타임블록이 있을 때만 켤 수 있어.');
                return;
              }
              toggleFocusMode();
            }}
            className={`rounded px-2 py-1 text-xs transition ${
              isFocusMode
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
            }`}
            title={isFocusMode ? '지금모드 종료' : '지금모드 보기'}
          >
            ⏱
          </button>
          {pastBlocksCount > 0 && (
            <button
              type="button"
              onClick={toggleShowPastBlocks}
              className={`rounded px-2 py-1 text-xs transition ${
                showPastBlocks
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
              }`}
              title={showPastBlocks ? '지난 블록 숨기기' : `지난 블록 보기 (${pastBlocksCount})`}
            >
              📜{pastBlocksCount}
            </button>
          )}
        </div>
      </div>

        <div className="flex flex-wrap items-center gap-[var(--spacing-xs)] md:ml-auto">
          {/* AI 분석 인디케이터 */}
          {aiAnalyzing && (
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] animate-pulse">
              <span className="animate-spin text-sm">🧠</span>
              <span>AI 분석 중...</span>
              <button
                onClick={cancelBreakdown}
                className="ml-1.5 rounded-lg bg-[var(--color-primary)]/20 px-1.5 py-0.5 text-[11px] hover:bg-[var(--color-primary)]/30 transition"
                title="취소"
              >
                ✕
              </button>
            </div>
          )}
          {/* 점화 버튼 */}
          <IgnitionButton />
          {renderCTA('stats', '📊 통계', () => setShowStats(true))}
          {renderCTA('bingo', '🟦 빙고', () => setShowBingo(true), `🟦 ${bingoCompletedCells}/9`)}
          {!isNormalWaifu && renderCTA('waifu', '💬 와이푸', handleCallWaifu)}
          {renderCTA('templates', '📋 템플릿', onOpenTemplates)}
          {renderCTA('chat', '✨ AI 채팅', onOpenGeminiChat)}
          {renderCTA('settings', '⚙️ 설정', onOpenSettings)}
        </div>
      </header>
      {showStats && <StatsModal open={showStats} onClose={() => setShowStats(false)} />}
      {showBingo && (
        <BingoModal
          open={showBingo}
          onClose={() => setShowBingo(false)}
          cells={bingoCells}
          maxLines={bingoMaxLines}
          lineRewardXP={bingoLineRewardXP}
          onProgressChange={(p) => setBingoCompletedCells(p.completedCells.length)}
        />
      )}
    </>
  );
}

// Helper component to register position
function XPPositionRegistrar() {
  const setTargetPosition = useXPParticleStore(state => state.setTargetPosition);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        // Target center of the element
        setTargetPosition(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [setTargetPosition]);

  return <span ref={ref} className="absolute opacity-0 pointer-events-none" />;
}
