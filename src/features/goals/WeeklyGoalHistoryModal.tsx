/**
 * WeeklyGoalHistoryModal.tsx
 *
 * @file 장기목표 히스토리 모달 (지난주 성과 그래프)
 * @description
 *   - Role: 지난 주간 성과를 그래프로 시각화
 *   - Responsibilities:
 *     - 최근 5주간 성과 막대 그래프
 *     - 목표 달성 여부 표시
 *     - 통계 요약 (평균 달성률 등)
 */

import type { WeeklyGoal } from '@/shared/types/domain';
import { useModalEscapeClose } from '@/shared/hooks';

interface WeeklyGoalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: WeeklyGoal;
}

/**
 * 주차 라벨 포맷팅 (예: "11/25 ~ 12/1")
 */
function formatWeekLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
  const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
  
  return `${startStr} ~ ${endStr}`;
}

/**
 * 장기목표 히스토리 모달
 */
export default function WeeklyGoalHistoryModal({ isOpen, onClose, goal }: WeeklyGoalHistoryModalProps) {
  useModalEscapeClose(isOpen, onClose);

  if (!isOpen) return null;

  const history = goal.history || [];
  const hasHistory = history.length > 0;

  // 통계 계산
  const completedWeeks = history.filter(h => h.completed).length;
  const validWeeks = history.filter(h => h.target > 0);
  const averageProgress = validWeeks.length > 0
    ? Math.round(validWeeks.reduce((sum, h) => sum + (h.finalProgress / h.target) * 100, 0) / validWeeks.length)
    : 0;
  const maxProgress = history.length > 0
    ? Math.max(...history.map(h => h.finalProgress))
    : 0;

  // 현재 주 데이터
  const currentWeekProgress = goal.target > 0 ? (goal.currentProgress / goal.target) * 100 : 0;

  const accent = goal.color || '#6366f1';

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{goal.icon || '📚'}</span>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)]">{goal.title}</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">주간 성과 기록</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* 현재 주 진행 상황 */}
          <div className="rounded-xl bg-white/5 p-4">
            <h3 className="text-sm font-bold text-white mb-3">📅 이번 주</h3>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-white">
                  {goal.currentProgress.toLocaleString()}
                  <span className="text-lg text-white/60 ml-1">/ {goal.target.toLocaleString()} {goal.unit}</span>
                </p>
                <p className="text-sm text-white/50 mt-1">{currentWeekProgress.toFixed(1)}% 달성</p>
              </div>
              <div 
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ 
                  background: `conic-gradient(${accent} ${currentWeekProgress}%, transparent ${currentWeekProgress}%)`,
                }}
              >
                <div className="h-12 w-12 rounded-full bg-[var(--color-bg-surface)] flex items-center justify-center text-sm">
                  {Math.round(currentWeekProgress)}%
                </div>
              </div>
            </div>
          </div>

          {/* 통계 요약 */}
          {hasHistory && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{completedWeeks}</p>
                <p className="text-xs text-white/50">목표 달성</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{averageProgress}%</p>
                <p className="text-xs text-white/50">평균 달성률</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{maxProgress.toLocaleString()}</p>
                <p className="text-xs text-white/50">최고 기록</p>
              </div>
            </div>
          )}

          {/* 히스토리 그래프 */}
          {hasHistory ? (
            <div>
              <h3 className="text-sm font-bold text-white mb-3">📊 지난 성과</h3>
              <div className="space-y-3">
                {history.slice().reverse().map((week) => {
                  const progressPercent = week.target > 0 ? Math.min(100, (week.finalProgress / week.target) * 100) : 0;
                  
                  return (
                    <div key={week.weekStartDate} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white/60">{formatWeekLabel(week.weekStartDate)}</span>
                        <span className={`font-bold ${week.completed ? 'text-emerald-400' : 'text-white/80'}`}>
                          {week.finalProgress.toLocaleString()} / {week.target.toLocaleString()} {goal.unit}
                          {week.completed && ' ✓'}
                        </span>
                      </div>
                      <div className="h-4 w-full rounded-full bg-gray-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressPercent}%`,
                            background: week.completed
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : `linear-gradient(90deg, ${accent}, ${accent}bb)`,
                          }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-white/40 mt-0.5">
                        {progressPercent.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-white/50">
              <p className="text-4xl mb-2">📈</p>
              <p>아직 기록된 히스토리가 없습니다</p>
              <p className="text-xs mt-1">다음 주부터 기록이 저장됩니다</p>
            </div>
          )}

          {/* 안내 */}
          <div className="rounded-lg bg-blue-500/10 p-3 text-xs text-blue-300">
            💡 매주 월요일에 새로운 주가 시작되며, 이전 주의 기록은 히스토리에 저장됩니다.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-base)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
