/**
 * TopToolbar - 상단 툴바
 *
 * @role 에너지/XP/와이푸 상태 표시 및 주요 액션 버튼 제공
 * @input gameState - 게임 상태, 콜백 함수들
 * @output 툴바 UI (통계, 와이푸, 템플릿, AI채팅, 설정 버튼)
 * @dependencies 다수 스토어 및 서비스
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import type { GameState } from '@/shared/types/domain';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { getAffectionColor } from '@/features/waifu/waifuImageUtils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { getDialogueFromAffection } from '@/data/repositories/waifuRepository';
import { audioService } from '@/shared/services/media/audioService';
import { useTaskBreakdownStore } from '@/features/tasks/stores/breakdownStore';
import { useXPParticleStore } from '@/features/gamification/stores/xpParticleStore';
import WeatherWidget from '@/features/weather/WeatherWidget';
import { StatsModal } from '@/features/stats/StatsModal';
import DailySummaryModal from '@/features/insight/DailySummaryModal';
import { InboxModal } from '@/features/tasks/InboxModal';
import { GoalsModal } from '@/features/goals/GoalsModal';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { useScheduleViewStore } from '@/features/schedule/stores/scheduleViewStore';
import { TIME_BLOCKS } from '@/shared/types/domain';
import BossAlbumModal from '@/features/battle/components/BossAlbumModal';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import { TempScheduleModal } from '@/features/tempSchedule';

/** TopToolbar 컴포넌트 Props */
interface TopToolbarProps {
  /** 게임 상태 데이터 */
  gameState: GameState | null;
  /** Gemini 채팅 모달 열기 콜백 */
  onOpenGeminiChat?: () => void;
  /** 템플릿 모달 열기 콜백 */
  onOpenTemplates?: () => void;
  /** 설정 모달 열기 콜백 */
  onOpenSettings?: () => void;
  /** 타임라인 뷰 표시 상태 */
  timelineVisible?: boolean;
  /** 타임라인 뷰 토글 콜백 */
  onToggleTimeline?: () => void;
  /** 좌측 패널 토글 콜백 */
  onToggleLeftPanel?: () => void;
  /** 좌측 패널 표시 상태 */
  leftPanelVisible?: boolean;
}

/**
 * 상단 툴바 컴포넌트
 * @param props - TopToolbarProps
 * @returns 툴바 UI
 */
export default function TopToolbar({
  gameState,
  onOpenGeminiChat,
  onOpenTemplates,
  onOpenSettings,
  timelineVisible,
  onToggleTimeline,
  onToggleLeftPanel,
  leftPanelVisible = true
}: TopToolbarProps) {
  const { waifuState, currentMood, currentAudio } = useWaifu();
  const { show: showWaifu } = useWaifuCompanionStore();
  const { isLoading: aiAnalyzing, cancelBreakdown } = useTaskBreakdownStore();
  const { isFocusMode, toggleFocusMode } = useFocusModeStore();
  const { showPastBlocks, toggleShowPastBlocks, openWarmupModal } = useScheduleViewStore();
  const { dailyState } = useBattleStore();

  const [showStats, setShowStats] = useState(false);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showBossAlbum, setShowBossAlbum] = useState(false);
  const [showTempSchedule, setShowTempSchedule] = useState(false);

  const toolbarHeightClass = 'h-10'; // CTA/우측 영역
  const leftHeightClass = 'h-8'; // 좌측 컴팩트 영역
  const statItemClass =
    `flex items-center gap-1.5 px-1 ${leftHeightClass} text-[var(--color-text)]`;
  const statValueClass = 'font-bold text-[var(--color-primary)]';

  const todayDefeatedCount = dailyState?.defeatedBossIds?.length ?? 0;
  const isNormalWaifu = (waifuState?.affection ?? 50) >= 40;

  const currentBlockId = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block?.id ?? null;
  }, []);

  const pastBlocksCount = useMemo(() => {
    const nowHour = new Date().getHours();
    return TIME_BLOCKS.filter(block => block.end <= nowHour).length;
  }, []);

  const handleCallWaifu = () => {
    const dialogue = waifuState
      ? getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday)
      : { text: '오늘도 화이팅!' };
    showWaifu(dialogue.text, dialogue.audio ? { audioPath: dialogue.audio } : undefined);
    if (currentAudio) {
      audioService.play(currentAudio).catch(() => {
        /* ignore audio errors */
      });
    }
  };

  const renderCTA = (key: string, label: string, onClick?: () => void, badge?: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 ${toolbarHeightClass} min-w-[72px] text-xs font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]`}
    >
      {label}
      {badge && (
        <span className="absolute -top-1 -right-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <>
      <header
        className="flex h-auto min-h-[40px] max-h-[40px] shrink-0 items-center gap-[var(--spacing-sm)] overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[var(--color-text)]"
        role="banner"
      >
        <style>{`@keyframes dance6123 { to { background-position: var(--btn-width); } }`}</style>

        {/* 좌측 패널 토글 버튼 */}
        <button
          type="button"
          onClick={onToggleLeftPanel}
          className={`shrink-0 flex ${leftHeightClass} w-8 items-center justify-center rounded text-xs transition ${leftPanelVisible
            ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
            }`}
          title={leftPanelVisible ? '보스 패널 숨기기 (Ctrl+B)' : '보스 패널 보기 (Ctrl+B)'}
        >
          🛡️
        </button>

        <h1 className="shrink-0 text-sm font-semibold tracking-tight">하루 루틴 컨트롤러</h1>

        {/* ... rest of the header content ... */}

        <div className={`flex flex-1 shrink-0 items-center gap-[var(--spacing-md)] text-[12px] ${leftHeightClass}`}>
          <div className={statItemClass}>
            <span>⭐ 오늘 XP:</span>
            <span
              ref={(el) => {
                if (el) {
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
            <div className={`${statItemClass} gap-2.5`}>
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
            <div className={`${statItemClass} gap-2`}>
              <span>분위기:</span>
              <span className="text-base" title={currentMood}>
                {currentMood}
              </span>
            </div>
          )}

          {/* Weather Widget */}
          <WeatherWidget />

          {/* Schedule View 컨트롤 (압축형) */}
          <div className={`flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1.5 py-1 ${toolbarHeightClass}`}>
            <button
              type="button"
              onClick={onToggleTimeline}
              className={`flex h-8 w-8 items-center justify-center rounded text-xs transition ${timelineVisible
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                }`}
              title={timelineVisible ? '타임라인 숨기기' : '타임라인 보기'}
            >
              📅
            </button>
            <button
              type="button"
              onClick={openWarmupModal}
              className="flex h-8 w-8 items-center justify-center rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition"
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
              className={`flex h-8 w-8 items-center justify-center rounded text-xs transition ${isFocusMode
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
                className={`flex h-8 w-9 items-center justify-center rounded text-xs transition ${showPastBlocks
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

        <div className={`flex shrink-0 items-center gap-[var(--spacing-sm)] ml-auto ${toolbarHeightClass}`}>
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
          {renderCTA('temp-schedule', '📅 스케줄', () => setShowTempSchedule(true))}
          {renderCTA('goals', '🎯 목표', () => setShowGoals(true))}
          {renderCTA('inbox', '📥 인박스', () => setShowInbox(true))}
          {renderCTA('boss-album', '🏆 보스', () => setShowBossAlbum(true), todayDefeatedCount > 0 ? `⚔️ ${todayDefeatedCount}` : undefined)}
          {renderCTA('stats', '📊 통계', () => setShowStats(true))}
          {renderCTA('daily-summary', '📝 AI 요약', () => setShowDailySummary(true))}
          {!isNormalWaifu && renderCTA('waifu', '💬 와이푸', handleCallWaifu)}
          {renderCTA('templates', '📋 템플릿', onOpenTemplates)}
          {renderCTA('chat', '✨ AI 채팅', onOpenGeminiChat)}
          {renderCTA('settings', '⚙️ 설정', onOpenSettings)}
        </div>
      </header>
      {showStats && <StatsModal open={showStats} onClose={() => setShowStats(false)} />}
      {showDailySummary && <DailySummaryModal open={showDailySummary} onClose={() => setShowDailySummary(false)} />}
      {showInbox && <InboxModal open={showInbox} onClose={() => setShowInbox(false)} />}
      {showGoals && <GoalsModal open={showGoals} onClose={() => setShowGoals(false)} />}
      {showBossAlbum && <BossAlbumModal isOpen={showBossAlbum} onClose={() => setShowBossAlbum(false)} />}
      {showTempSchedule && <TempScheduleModal isOpen={showTempSchedule} onClose={() => setShowTempSchedule(false)} />}
    </>
  );
}

/**
 * XP 파티클 애니메이션 타겟 위치 등록 헬퍼 컴포넌트
 * @returns 보이지 않는 위치 추적용 span 엘리먼트
 */
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
