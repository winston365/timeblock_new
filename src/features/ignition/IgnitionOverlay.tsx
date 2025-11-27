/**
 * IgnitionOverlay - 점화 오버레이 메인 컴포넌트
 * 
 * @role 점화 시스템 UI 컨테이너 (SpinnerView / TimerView 전환)
 * @refactored 2024-01 - 컴포넌트 분리 (SpinnerView, TimerView), 로직 분리 (useIgnitionPool)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Stores
import { useIgnitionStore } from './stores/useIgnitionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

// Hooks
import { useIgnitionPool, type WeightedTask } from './hooks/useIgnitionPool';

// Components
import SpinnerView from './components/SpinnerView';
import TimerView from './components/TimerView';

// Services
import { generateMicroStep } from '@/shared/services/ai/geminiApi';

// Types
import type { Task } from '@/shared/types/domain';

export default function IgnitionOverlay() {
  // ============================================================================
  // Store State
  // ============================================================================
  const {
    isOpen,
    isSpinning,
    selectedTask,
    microStepText,
    timerState,
    timeLeft,
    isBonus,
    closeIgnition,
    startSpin,
    stopSpin,
    setMicroStep,
    startTimer,
    pauseTimer,
    tickTimer,
    setSelectedTask: setSelectedTaskInStore,
    history,
    addToHistory,
  } = useIgnitionStore();

  const { addXP, addItem } = useGameStateStore();
  const { settings } = useSettingsStore();

  // ============================================================================
  // Pool Hook
  // ============================================================================
  const { weightedPool, totalWeight, sortedTasks, poolComputedAt } = useIgnitionPool(isOpen);

  // ============================================================================
  // Local State
  // ============================================================================
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<WeightedTask | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState<number | null>(null);

  // ============================================================================
  // Refs
  // ============================================================================
  const pendingSelectionRef = useRef<WeightedTask | null>(null);
  const autoConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConfirmingRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  // Instant XP Reward for Courage when opened
  useEffect(() => {
    if (isOpen) {
      addXP(5, undefined, true).catch(console.error);
    }
  }, [isOpen, addXP]);

  // Timer ticking
  useEffect(() => {
    if (timerState !== 'running') return;
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState, tickTimer]);

  // Enter 단축키로 결과 확인
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && pendingSelectionRef.current) {
        e.preventDefault();
        handleConfirmSelection(pendingSelectionRef.current);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // 자동 결과 확인 타이머 (5초 후 자동 확인)
  useEffect(() => {
    if (!pendingSelectionRef.current) {
      setConfirmCountdown(null);
      if (autoConfirmTimerRef.current) clearTimeout(autoConfirmTimerRef.current);
      return;
    }

    setConfirmCountdown(5);
    if (autoConfirmTimerRef.current) clearTimeout(autoConfirmTimerRef.current);

    const tick = () => {
      setConfirmCountdown((prev) => {
        if (!pendingSelectionRef.current) return null;
        if (prev && prev > 1) {
          autoConfirmTimerRef.current = setTimeout(tick, 1000);
          return prev - 1;
        }
        // 시간 만료 시 자동 확인
        handleConfirmSelection(pendingSelectionRef.current!);
        return null;
      });
    };

    autoConfirmTimerRef.current = setTimeout(tick, 1000);

    return () => {
      if (autoConfirmTimerRef.current) clearTimeout(autoConfirmTimerRef.current);
    };
  }, [pendingSelection]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleTaskSelect = useCallback((task: WeightedTask) => {
    setPendingSelection(task);
    pendingSelectionRef.current = task;
    stopSpin(task as Task);
  }, [stopSpin]);

  const handleConfirmSelection = useCallback(async (selection: WeightedTask) => {
    if (!selection) return;
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;

    if (autoConfirmTimerRef.current) {
      clearTimeout(autoConfirmTimerRef.current);
      autoConfirmTimerRef.current = null;
    }

    try {
      // 꽝 처리
      if (selection.id === 'boom' || selection.text?.includes('꽝')) {
        toast.error('꽝! 다음에 다시 시도하세요.');
        try {
          await addToHistory({ ...selection, rarity: 'common' } as Task, isBonus ? 'bonus' : 'normal');
        } catch (error) {
          console.error('[Ignition] Failed to persist history (boom):', error);
        }
        closeIgnition();
        return;
      }

      // 휴식권 처리
      if (selection.isTicket && selection.ticketType) {
        try {
          await addItem(selection.ticketType, 1);
          toast.success(`${selection.text} 획득!`);
          await addToHistory(selection as Task, isBonus ? 'bonus' : 'normal');
        } catch (error) {
          console.error('[Ignition] Failed to persist history or add item:', error);
          toast.error('보상 지급에 실패했습니다.');
        }
        closeIgnition();
        return;
      }

      // 일반 작업 선택
      stopSpin(selection as Task);
      try {
        await addToHistory(selection as Task, isBonus ? 'bonus' : 'normal');
      } catch (error) {
        console.error('[Ignition] Failed to persist history:', error);
      }

      // Generate micro-step
      setIsLoadingPrompt(true);
      const promptContext = [
        `작업: ${selection.text}`,
        selection.resistance ? `난이도: ${selection.resistance}` : '',
        (selection as any).memo ? `메모: ${(selection as any).memo}` : '',
        (selection as any).preparation1 || (selection as any).preparation2 || (selection as any).preparation3
          ? `준비사항: ${[(selection as any).preparation1, (selection as any).preparation2, (selection as any).preparation3].filter(Boolean).join(', ')}`
          : '',
      ].filter(Boolean).join('\n');

      generateMicroStep(promptContext, settings?.geminiApiKey || '')
        .then(step => {
          setMicroStep(step);
          setIsLoadingPrompt(false);
        })
        .catch(() => {
          setIsLoadingPrompt(false);
        });
    } finally {
      setPendingSelection(null);
      pendingSelectionRef.current = null;
      setConfirmCountdown(null);
      isConfirmingRef.current = false;
    }
  }, [addItem, addToHistory, closeIgnition, isBonus, setMicroStep, settings?.geminiApiKey, stopSpin]);

  const handleCompleteAndReward = async () => {
    if (!selectedTask) {
      closeIgnition();
      return;
    }

    try {
      await addXP(30);
      closeIgnition();
    } catch (error) {
      console.error('보상 지급 실패:', error);
      toast.error('보상 지급에 실패했습니다.');
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!selectedTask) return;

    try {
      const mergedTask = {
        ...selectedTask,
        ...taskData,
        timeBlock: taskData.timeBlock ?? selectedTask.timeBlock ?? null,
        memo: taskData.memo ?? selectedTask.memo ?? '',
      };

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');
      const updated = await updateAnyTask(selectedTask.id, mergedTask);

      if (updated) {
        setSelectedTaskInStore(mergedTask as Task);
        setIsTaskModalOpen(false);
        toast.success('작업이 저장되었습니다.');
      } else {
        toast.error('작업을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('작업 저장 실패:', error);
      toast.error('작업 저장에 실패했습니다.');
    }
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const showSpinnerView = !selectedTask || isSpinning || pendingSelection;
  const modalWidthClass = showSpinnerView
    ? 'max-w-4xl'
    : isTaskModalOpen
      ? 'max-w-[1400px]'
      : 'max-w-xl';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="fixed inset-0 z-[2000] flex items-start justify-center pt-24 px-4"
        >
          <motion.div
            className={`w-full ${modalWidthClass} overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1a] shadow-2xl transition-all duration-300`}
            drag
            dragMomentum
            dragElastic={0.2}
            dragTransition={{ power: 0.3, timeConstant: 80 }}
            dragConstraints={overlayRef}
            style={{ willChange: 'transform', cursor: 'grab' }}
            whileTap={{ cursor: 'grabbing' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-white/5 px-6 py-4">
              <div className="flex items-center gap-2 text-amber-500">
                <span className="text-xl">🔥</span>
                <span className="font-bold">3분 점화</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={closeIgnition}
                  className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`p-8 ${isTaskModalOpen ? 'text-left' : 'text-center'}`}>
              {showSpinnerView ? (
                <SpinnerView
                  weightedPool={weightedPool}
                  totalWeight={totalWeight}
                  sortedTasks={sortedTasks}
                  poolComputedAt={poolComputedAt}
                  history={history}
                  pendingSelection={pendingSelection}
                  confirmCountdown={confirmCountdown}
                  onTaskSelect={handleTaskSelect}
                  onSpinStart={startSpin}
                  onConfirmSelection={handleConfirmSelection}
                />
              ) : (
                <TimerView
                  selectedTask={selectedTask!}
                  microStepText={microStepText}
                  isLoadingPrompt={isLoadingPrompt}
                  timerState={timerState}
                  timeLeft={timeLeft}
                  isTaskModalOpen={isTaskModalOpen}
                  onStartTimer={startTimer}
                  onPauseTimer={pauseTimer}
                  onCompleteAndReward={handleCompleteAndReward}
                  onClose={closeIgnition}
                  onOpenTaskModal={() => setIsTaskModalOpen(true)}
                  onCloseTaskModal={() => setIsTaskModalOpen(false)}
                  onSaveTask={handleSaveTask}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
