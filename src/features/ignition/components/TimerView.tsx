/**
 * TimerView Component
 * 
 * @role 점화 타이머 화면 (선택된 작업 정보, AI 마이크로스텝, 타이머, 버튼)
 */

import type { Task, TimeBlockId } from '@/shared/types/domain';
import TaskModalInline from './TaskModalInline';

// ============================================================================
// Types
// ============================================================================

interface TimerViewProps {
  selectedTask: Task;
  microStepText: string;
  isLoadingPrompt: boolean;
  timerState: 'idle' | 'running' | 'paused' | 'completed';
  timeLeft: number;
  isTaskModalOpen: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onCompleteAndReward: () => void;
  onClose: () => void;
  onOpenTaskModal: () => void;
  onCloseTaskModal: () => void;
  onSaveTask: (taskData: Partial<Task>) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getRarityStyle(rarity: string | undefined): string {
  switch (rarity) {
    case 'legendary':
      return 'border-amber-400/60 bg-amber-400/10 text-amber-100';
    case 'epic':
      return 'border-purple-400/60 bg-purple-400/10 text-purple-100';
    case 'rare':
      return 'border-blue-400/60 bg-blue-400/10 text-blue-100';
    default:
      return 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100';
  }
}

function getRarityLabel(rarity: string | undefined): string {
  switch (rarity) {
    case 'legendary':
      return '레전더리';
    case 'epic':
      return '에픽';
    case 'rare':
      return '레어';
    default:
      return '커먼';
  }
}

// ============================================================================
// Component
// ============================================================================

export default function TimerView({
  selectedTask,
  microStepText,
  isLoadingPrompt,
  timerState,
  timeLeft,
  isTaskModalOpen,
  onStartTimer,
  onPauseTimer,
  onCompleteAndReward,
  onClose,
  onOpenTaskModal,
  onCloseTaskModal,
  onSaveTask,
}: TimerViewProps) {
  const isTicket = (selectedTask as any)?.isTicket;
  const rarity = (selectedTask as any)?.rarity;

  return (
    <div className={`flex ${isTaskModalOpen ? 'flex-row gap-6' : 'flex-col items-center gap-6'}`}>
      {/* Left Panel: Timer & Micro Step */}
      <div className={`flex flex-col ${isTaskModalOpen ? 'w-1/2 items-center' : 'items-center'} gap-6`}>
        {/* Selected Task Info */}
        <TaskInfo
          task={selectedTask}
          isTicket={isTicket}
          rarity={rarity}
          onOpenTaskModal={onOpenTaskModal}
        />

        {/* AI Micro Step Prompt */}
        <MicroStepPanel
          microStepText={microStepText}
          isLoading={isLoadingPrompt}
        />

        {/* Timer Display */}
        <TimerDisplay
          timerState={timerState}
          timeLeft={timeLeft}
          onStartTimer={onStartTimer}
          onPauseTimer={onPauseTimer}
          onCompleteAndReward={onCompleteAndReward}
          onClose={onClose}
        />
      </div>

      {/* Right Panel: Task Modal (Inline) */}
      {isTaskModalOpen && selectedTask && !isTicket && (
        <div className="w-1/2 border-l border-white/10 pl-6">
          <TaskModalInline
            key={selectedTask.id}
            task={selectedTask}
            initialBlockId={(selectedTask.timeBlock || null) as TimeBlockId}
            onSave={onSaveTask}
            onClose={onCloseTaskModal}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TaskInfoProps {
  task: Task;
  isTicket: boolean;
  rarity: string | undefined;
  onOpenTaskModal: () => void;
}

function TaskInfo({ task, isTicket, rarity, onOpenTaskModal }: TaskInfoProps) {
  return (
    <div className="space-y-2 text-center">
      <h2 className="text-2xl font-bold text-white">{task?.text}</h2>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          {task?.resistance === 'low'
            ? '🟢 쉬움'
            : task?.resistance === 'medium'
              ? '🟡 보통'
              : '🔴 어려움'}
        </span>

        {rarity && (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRarityStyle(rarity)}`}>
            휴식권 · {getRarityLabel(rarity)}
          </span>
        )}

        {task && !isTicket && (
          <button
            onClick={onOpenTaskModal}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/50 hover:text-white"
          >
            ✏️ 작업 열기
          </button>
        )}
      </div>
    </div>
  );
}

interface MicroStepPanelProps {
  microStepText: string;
  isLoading: boolean;
}

function MicroStepPanel({ microStepText, isLoading }: MicroStepPanelProps) {
  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 p-6 border border-amber-500/20 max-h-[360px] overflow-y-auto custom-scrollbar">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-amber-500">
          <span className="animate-spin">⏳</span>
          <span className="text-sm font-medium">
            혜은이가 아주 쉬운 시작 방법을 찾는 중...
          </span>
        </div>
      ) : (
        <p className="text-lg font-medium leading-relaxed text-amber-100 whitespace-pre-line leading-[1.45] space-y-1.5">
          "{microStepText}"
        </p>
      )}
    </div>
  );
}

interface TimerDisplayProps {
  timerState: 'idle' | 'running' | 'paused' | 'completed';
  timeLeft: number;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onCompleteAndReward: () => void;
  onClose: () => void;
}

function TimerDisplay({
  timerState,
  timeLeft,
  onStartTimer,
  onPauseTimer,
  onCompleteAndReward,
  onClose,
}: TimerDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="font-mono text-6xl font-bold tracking-wider text-white">
        {formatTime(timeLeft)}
      </div>

      {timerState === 'completed' ? (
        <div className="space-y-4">
          <p className="text-xl font-bold text-emerald-400">🎉 점화 성공!</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20"
            >
              닫기
            </button>
            <button
              onClick={onCompleteAndReward}
              className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
            >
              점화 성공 (30 XP)
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          {timerState === 'idle' && (
            <button
              onClick={onStartTimer}
              className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-orange-500/25"
            >
              <span>🚀</span>
              <span>지금 시작하기</span>
            </button>
          )}

          {timerState === 'running' && (
            <button
              onClick={onPauseTimer}
              className="rounded-xl bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20"
            >
              일시정지
            </button>
          )}

          {timerState === 'paused' && (
            <button
              onClick={onStartTimer}
              className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600"
            >
              다시 시작
            </button>
          )}
        </div>
      )}
    </div>
  );
}
