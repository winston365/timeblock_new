/**
 * TaskCard
 *
 * @role 개별 작업을 표시하고 인라인 편집(난이도, 시간) 및 완료/삭제 기능을 제공하는 카드 컴포넌트
 * @input task (작업 데이터), 각종 핸들러 함수들, hideMetadata (메타데이터 숨김 옵션)
 * @output 드래그 가능한 작업 카드 UI (체크박스, 제목, 난이도, 시간, XP, 메모)
 * @external_dependencies
 *   - utils: XP 계산 및 시간 포맷팅 함수
 */

import { useState } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { RESISTANCE_LABELS } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP } from '@/shared/lib/utils';
import { TimerConfirmModal } from './TimerConfirmModal';
import { CompletionCelebrationModal } from './CompletionCelebrationModal';
import { useGameState } from '@/shared/hooks';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDragStart?: (taskId: string) => void;
  hideMetadata?: boolean; // 인박스에서 난이도/XP 숨기기 옵션
}

/**
 * 작업 카드 컴포넌트
 *
 * @param {TaskCardProps} props - 컴포넌트 props
 * @returns {JSX.Element} 작업 카드 UI
 * @sideEffects
 *   - 드래그앤드롭으로 작업 이동
 *   - 인라인 난이도/시간 변경 시 즉시 업데이트
 */
export default function TaskCard({ task, onEdit, onDelete, onToggle, onUpdateTask, onDragStart, hideMetadata = false }: TaskCardProps) {
  const [showResistancePicker, setShowResistancePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [showTimerConfirm, setShowTimerConfirm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationXP, setCelebrationXP] = useState(0);
  const [timerBonus, setTimerBonus] = useState(0);

  // 게임 상태에서 퀘스트 업데이트 함수 가져오기
  const { updateQuestProgress } = useGameState();

  // XP 계산
  const xp = calculateTaskXP(task);

  // 준비된 할일인지 확인 (3개 모두 채워진 경우)
  const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);

  // 심리적부담감 변경
  const handleResistanceChange = (resistance: Resistance) => {
    if (onUpdateTask) {
      const multiplier = resistance === 'low' ? 1.0 : resistance === 'medium' ? 1.3 : 1.6;
      onUpdateTask({
        resistance,
        adjustedDuration: Math.round(task.baseDuration * multiplier),
      });
    }
    setShowResistancePicker(false);
  };

  // 소요시간 변경
  const handleDurationChange = (baseDuration: number) => {
    if (onUpdateTask) {
      const multiplier = task.resistance === 'low' ? 1.0 : task.resistance === 'medium' ? 1.3 : 1.6;
      onUpdateTask({
        baseDuration,
        adjustedDuration: Math.round(baseDuration * multiplier),
      });
    }
    setShowDurationPicker(false);
  };

  const durationOptions = [15, 30, 45, 60, 90, 120, 180];

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setIsDragging(true);
    if (onDragStart) {
      onDragStart(task.id);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 작업 완료 체크 핸들러
  const handleToggleClick = () => {
    // 완료 취소하는 경우 (이미 완료된 작업)
    if (task.completed) {
      onToggle();
      return;
    }

    // 완료하려는 경우 - 타이머 확인 모달 표시
    setShowTimerConfirm(true);
  };

  // 타이머 확인 모달에서 선택한 경우
  const handleTimerConfirm = async (timerUsed: boolean) => {
    setShowTimerConfirm(false);

    // timerUsed 필드 업데이트
    if (onUpdateTask) {
      onUpdateTask({ timerUsed });
    }

    // 완료 처리
    onToggle();

    // 타이머 사용했으면 퀘스트 진행도 업데이트 및 축하 모달 표시
    if (timerUsed) {
      // 타이머 퀘스트 진행도 업데이트
      await updateQuestProgress('use_timer', 1);

      const TIMER_BONUS = 20;
      const baseXP = xp;
      const totalXP = baseXP + TIMER_BONUS;

      setCelebrationXP(totalXP);
      setTimerBonus(TIMER_BONUS);
      setShowCelebration(true);
    }
  };

  // 축하 모달 닫기
  const handleCelebrationClose = () => {
    setShowCelebration(false);
  };


  return (
    <>
      <div
        className={`task-card ${task.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isPrepared ? 'prepared' : ''}`}
        draggable="true"
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDoubleClick={onEdit}
      >
      <div className="task-main">
        <button
          className="task-checkbox"
          onClick={handleToggleClick}
          aria-label={task.completed ? '완료 취소' : '완료'}
        >
          {task.completed ? '✅' : '⬜'}
        </button>

        <div className="task-details" onClick={() => task.memo && setShowMemo(!showMemo)}>
          {/* 작업명과 아이콘을 같은 행에 배치 */}
          <div className="task-header-row">
            <div className="task-text">
              {isPrepared && <span className="prepared-icon" title="완벽하게 준비된 작업">⭐</span>}
              {task.text}
            </div>

            <div className="task-inline-badges">
              {/* 심리적부담감 - 클릭 가능 (hideMetadata가 false일 때만 표시) */}
              {!hideMetadata && (
                <div className="task-meta-item">
                  <button
                    className={`resistance-badge ${task.resistance} clickable`}
                    onClick={() => setShowResistancePicker(!showResistancePicker)}
                    title="클릭하여 변경"
                  >
                    {RESISTANCE_LABELS[task.resistance]}
                  </button>

                  {showResistancePicker && (
                    <div className="picker-dropdown resistance-picker">
                      <button onClick={() => handleResistanceChange('low')}>🟢 쉬움</button>
                      <button onClick={() => handleResistanceChange('medium')}>🟡 보통</button>
                      <button onClick={() => handleResistanceChange('high')}>🔴 어려움</button>
                    </div>
                  )}
                </div>
              )}

              {/* 소요시간 - 클릭 가능 */}
              <div className="task-meta-item">
                <button
                  className="duration-badge clickable"
                  onClick={() => setShowDurationPicker(!showDurationPicker)}
                  title="클릭하여 변경"
                >
                  ⏱️ {formatDuration(task.baseDuration)}
                </button>

                {showDurationPicker && (
                  <div className="picker-dropdown duration-picker">
                    {durationOptions.map(duration => (
                      <button key={duration} onClick={() => handleDurationChange(duration)}>
                        {duration}분
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* XP 범위 (hideMetadata가 false일 때만 표시) */}
              {!hideMetadata && (
                <span className="xp-badge">~{xp} XP</span>
              )}

              {/* 메모 아이콘 */}
              {task.memo && (
                <span className="memo-indicator" title="메모 있음">📝</span>
              )}

              {/* 삭제 버튼 */}
              <button
                className="task-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="삭제"
                aria-label="작업 삭제"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* 메모는 아래에 (클릭 시 표시) */}
          {task.memo && showMemo && (
            <div className="task-memo" onClick={(e) => e.stopPropagation()}>📝 {task.memo}</div>
          )}
        </div>
      </div>
      </div>

      {/* 타이머 확인 모달 */}
      {showTimerConfirm && (
        <TimerConfirmModal
          taskName={task.text}
          onConfirm={handleTimerConfirm}
        />
      )}

      {/* 축하 모달 */}
      {showCelebration && (
        <CompletionCelebrationModal
          task={task}
          xpGained={celebrationXP}
          timerBonus={timerBonus}
          onClose={handleCelebrationClose}
        />
      )}
    </>
  );
}
