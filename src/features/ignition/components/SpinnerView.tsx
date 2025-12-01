/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file SpinnerView.tsx
 * @role 점화 스피너 화면 컴포넌트
 * @input weightedPool, totalWeight, sortedTasks, history, pendingSelection
 * @output 확률 분포 패널, 스피너 컴포넌트, 최근 기록 패널 UI
 * @dependencies TaskSpinner, WeightedTask 타입
 */

import { useCallback } from 'react';
import TaskSpinner from './TaskSpinner';
import type { WeightedTask } from '../hooks/useIgnitionPool';
import type { Task } from '@/shared/types/domain';

/**
 * SpinnerView 컴포넌트 Props
 */
interface SpinnerViewProps {
  weightedPool: WeightedTask[];
  totalWeight: number;
  sortedTasks: WeightedTask[];
  poolComputedAt: Date | null;
  history: Task[];
  pendingSelection: WeightedTask | null;
  confirmCountdown: number | null;
  onTaskSelect: (task: WeightedTask) => void;
  onSpinStart: () => void;
  onConfirmSelection: (selection: WeightedTask) => void;
}

/**
 * 점화 스피너 화면 컴포넌트
 * 확률 분포 패널, 스피너, 최근 기록을 포함한 전체 스피너 뷰 렌더링
 *
 * @param props - SpinnerViewProps
 * @returns 스피너 화면 UI
 */
export default function SpinnerView({
  weightedPool,
  totalWeight,
  sortedTasks,
  poolComputedAt,
  history,
  pendingSelection,
  confirmCountdown,
  onTaskSelect,
  onSpinStart,
  onConfirmSelection,
}: SpinnerViewProps) {
  const handleConfirm = useCallback(() => {
    if (pendingSelection) {
      onConfirmSelection(pendingSelection);
    }
  }, [pendingSelection, onConfirmSelection]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-8">
        {/* Left: Weights Panel */}
        <div className="w-1/3 flex flex-col gap-3 text-left border-r border-white/10 pr-6">
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
            확률 분포
          </h3>
          <div className="text-[10px] text-white/40 flex items-center justify-between pr-1">
            <span>
              {poolComputedAt ? poolComputedAt.toLocaleTimeString() : '계산 대기'}
            </span>
            <span>
              항목 {weightedPool.length} · 총가중치 {totalWeight || 0}
            </span>
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedTasks.map((task) => {
              const percent = totalWeight > 0 
                ? ((task.weight || 0) / totalWeight * 100).toFixed(1) 
                : '0';
              return (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between text-xs group"
                >
                  <span className="text-white/80 truncate max-w-[70%] group-hover:text-white transition-colors">
                    {task.text}
                  </span>
                  <span className="text-white/40 font-mono">{percent}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Spinner */}
        <div className="w-2/3 flex flex-col justify-center">
          <TaskSpinner
            tasks={weightedPool as Task[]}
            onSelect={onTaskSelect as (task: Task) => void}
            onSpinStart={onSpinStart}
            disabled={!!pendingSelection}
            resultTask={pendingSelection as Task | null}
            statusText={pendingSelection ? `자동 확인 ${confirmCountdown ?? 5}s` : undefined}
          />
          
          {/* Confirm Button */}
          {pendingSelection && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {pendingSelection.rarity && (
                <span 
                  className={`rounded-full border px-3 py-1 text-xs font-semibold text-white/80 ${
                    pendingSelection.rarity === 'legendary'
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-100'
                      : pendingSelection.rarity === 'epic'
                        ? 'border-purple-400/60 bg-purple-400/10 text-purple-100'
                        : pendingSelection.rarity === 'rare'
                          ? 'border-blue-400/60 bg-blue-400/10 text-blue-100'
                          : 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100'
                  }`}
                >
                  {pendingSelection.rarity}
                </span>
              )}
              <button
                onClick={handleConfirm}
                className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-emerald-600 hover:shadow-emerald-500/40 transition"
                title="Enter"
              >
                결과 확인 (Enter)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: History */}
      <HistoryPanel history={history} />
    </div>
  );
}

// ============================================================================
// HistoryPanel Sub-Component
// ============================================================================

/**
 * HistoryPanel 컴포넌트 Props
 */
interface HistoryPanelProps {
  /** 점화 히스토리 작업 목록 */
  history: Task[];
}

/**
 * 점화 히스토리 패널 컴포넌트
 * 최근 점화 결과 목록을 가로 스크롤로 표시
 *
 * @param props - HistoryPanelProps
 * @returns 히스토리 패널 UI
 */
function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="text-sm font-bold text-white/50 text-left mb-3 uppercase tracking-wider">
        최근 기록
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {history.length === 0 ? (
          <div className="text-xs text-white/30 italic">
            아직 기록이 없습니다.
          </div>
        ) : (
          history.map((task, idx) => (
            <div 
              key={`${task.id}-${idx}`} 
              className="flex-shrink-0 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5"
            >
              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-white/10 text-white/60">
                {(task as any).source === 'bonus' ? '보너스' : '정상'}
              </span>
              <span className="text-xs text-white/80 whitespace-nowrap max-w-[150px] truncate">
                {task.text}
              </span>
              {(task as any).rarity && (
                <div 
                  className={`w-2 h-2 rounded-full ${
                    (task as any).rarity === 'legendary' ? 'bg-amber-400' :
                    (task as any).rarity === 'epic' ? 'bg-purple-400' :
                    (task as any).rarity === 'rare' ? 'bg-blue-400' :
                    'bg-emerald-400'
                  }`} 
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
