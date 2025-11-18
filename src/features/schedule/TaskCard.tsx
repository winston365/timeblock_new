/**
 * TaskCard
 *
 * @role 개별 작업을 표시하고 인라인 편집(난이도, 시간) 및 완료/삭제 기능을 제공하는 카드 컴포넌트
 * @input task (작업 데이터), 각종 핸들러 함수들, hideMetadata (메타데이터 숨김 옵션)
 * @output 드래그 가능한 작업 카드 UI (체크박스, 제목, 난이도, 시간, XP, 메모)
 * @external_dependencies
 *   - utils: XP 계산 및 시간 포맷팅 함수
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { RESISTANCE_LABELS } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP } from '@/shared/lib/utils';
import { TimerConfirmModal } from './TimerConfirmModal';
import { MemoModal } from './MemoModal';
import { useGameState } from '@/shared/hooks';
import { useDragDropManager } from './hooks/useDragDropManager';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  hideMetadata?: boolean; // 인박스에서 난이도/XP 숨기기 옵션
  blockIsLocked?: boolean; // 블록 잠금 여부 (인박스일 경우 undefined)
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
export default function TaskCard({ task, onEdit, onDelete, onToggle, onUpdateTask, onDragStart, onDragEnd, hideMetadata = false, blockIsLocked }: TaskCardProps) {
  const [showResistancePicker, setShowResistancePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [showTimerConfirm, setShowTimerConfirm] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(task.text);
  const [timerIconActive, setTimerIconActive] = useState(false); // 타이머 아이콘 상태 (▶️ ↔ ⏰)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // 초 단위

  // 게임 상태에서 퀘스트 업데이트 함수 가져오기
  const { updateQuestProgress } = useGameState();

  // 통합 드래그 앤 드롭 관리 훅
  const { setDragData } = useDragDropManager();

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

  const durationOptions = [5, 10, 15, 30, 45, 60];

  // 드래그 핸들러 (통합 드래그 시스템 사용)
  const handleDragStart = (e: React.DragEvent) => {
    // 구조화된 드래그 데이터 설정 (task 전체 객체 포함)
    setDragData(
      {
        taskId: task.id,
        sourceBlockId: task.timeBlock,
        sourceHourSlot: task.hourSlot,
        taskData: task,
      },
      e
    );

    setIsDragging(true);
    if (onDragStart) {
      onDragStart(task.id);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  // 작업 완료 체크 핸들러
  const handleToggleClick = () => {
    // 완료 취소하는 경우 (이미 완료된 작업)
    if (task.completed) {
      onToggle();
      return;
    }

    // 블록 작업인 경우 (task.timeBlock !== null) 잠금 체크
    if (task.timeBlock && blockIsLocked === false) {
      alert('⚠️ 블록을 먼저 잠궈야 작업을 완료할 수 있습니다!\n\n블록 잠금 버튼(⚠️)을 눌러주세요. (비용: 15 XP)');
      return;
    }

    // 완료하려는 경우 - 타이머 확인 모달 표시
    setShowTimerConfirm(true);
  };

  // 타이머 확인 모달에서 선택한 경우
  const handleTimerConfirm = async (timerUsed: boolean) => {
    setShowTimerConfirm(false);

    // 1. 먼저 timerUsed 업데이트 (완료 처리 전에 실행)
    if (onUpdateTask) {
      await onUpdateTask({ timerUsed });
    }

    // 2. 완료 처리 (이제 task.timerUsed가 업데이트된 상태)
    // taskCompletionService가 calculateTaskXP를 호출하여 타이머 보너스 포함 XP 계산
    onToggle();

    // 3. 타이머 사용 시 퀘스트 업데이트만 수행
    // (XP는 taskCompletionService에서 자동으로 처리됨)
    if (timerUsed) {
      await updateQuestProgress('use_timer', 1);
    }
  };

  // 메모 모달 핸들러
  const handleMemoModalSave = (newMemo: string) => {
    if (onUpdateTask) {
      onUpdateTask({ memo: newMemo });
    }
  };

  const handleMemoModalClose = () => {
    setShowMemoModal(false);
  };

  // 텍스트 편집 시작
  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingText(true);
    setEditedText(task.text);
  };

  // 텍스트 편집 저장
  const handleTextSave = () => {
    const trimmedText = editedText.trim();
    if (trimmedText && trimmedText !== task.text && onUpdateTask) {
      onUpdateTask({ text: trimmedText });
    }
    setIsEditingText(false);
  };

  // 텍스트 편집 취소
  const handleTextCancel = () => {
    setEditedText(task.text);
    setIsEditingText(false);
  };

  // 텍스트 입력 핸들러
  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTextCancel();
    }
  };

  // 타이머 토글 핸들러
  const handleTimerToggle = () => {
    if (!timerIconActive) {
      // 타이머 시작
      setTimerStartTime(Date.now());
      setElapsedTime(0);
    } else {
      // 타이머 정지
      setTimerStartTime(null);
    }
    setTimerIconActive(!timerIconActive);
  };

  // 타이머 경과 시간 업데이트
  useEffect(() => {
    if (!timerIconActive || timerStartTime === null) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerIconActive, timerStartTime]);

  // 경과 시간 포맷팅 (MM:SS)
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <>
      <div
        className={`task-card ${task.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isPrepared ? 'prepared' : ''}`}
        draggable="true"
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          // 체크박스, 버튼 등 다른 요소를 클릭한 경우 무시
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.task-details')) {
            if (!(e.target as HTMLElement).closest('.task-inline-badges') &&
                !(e.target as HTMLElement).closest('.task-checkbox') &&
                !isEditingText) {
              onEdit();
            }
          }
        }}
      >
      <div className="task-main">
        <button
          className="task-checkbox"
          onClick={handleToggleClick}
          aria-label={task.completed ? '완료 취소' : '완료'}
        >
          {task.completed ? '✅' : '⬜'}
        </button>

        <div className="task-details">
          {/* 작업명과 아이콘을 같은 행에 배치 */}
          <div className="task-header-row">
            <div className="task-text">
              {isPrepared && <span className="prepared-icon" title="완벽하게 준비된 작업">⭐</span>}
              {isEditingText ? (
                <input
                  type="text"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  onBlur={handleTextSave}
                  onKeyDown={handleTextKeyDown}
                  autoFocus
                  className="task-text-input"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span onClick={handleTextClick} style={{ cursor: 'pointer' }} title="클릭하여 수정">
                  {task.text}
                </span>
              )}
            </div>

            <div className="task-inline-badges">
              {/* 심리적부담감 - 클릭 가능 (hideMetadata가 false일 때만 표시) */}
              {!hideMetadata && (
                <div className="task-meta-item">
                  <button
                    className={`resistance-badge ${task.resistance} clickable`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResistancePicker(!showResistancePicker);
                    }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDurationPicker(!showDurationPicker);
                  }}
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
                <button
                  className="memo-indicator"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMemoModal(true);
                  }}
                  title="메모 보기 (클릭)"
                  aria-label="메모 보기"
                >
                  📝
                </button>
              )}

              {/* 타이머 아이콘 - 토글 */}
              <button
                className={`timer-icon-btn ${timerIconActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimerToggle();
                }}
                title={timerIconActive ? `타이머 진행 중: ${formatElapsedTime(elapsedTime)}` : "타이머 시작"}
                aria-label="타이머 토글"
              >
                {timerIconActive ? '⏰' : '▶️'}
              </button>

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
        </div>
      </div>

      {/* 타이머 진행 바 - 하단에 표시 */}
      {timerIconActive && (
        <div className="task-timer-progress-bar" onClick={(e) => e.stopPropagation()}>
          <div className="timer-progress-content">
            <span className="timer-progress-label">⏰ 타이머 진행 중</span>
            <span className="timer-progress-time">{formatElapsedTime(elapsedTime)}</span>
          </div>
          <div className="timer-progress-bar-fill"></div>
        </div>
      )}
      </div>

      {/* 타이머 확인 모달 */}
      {showTimerConfirm && (
        <TimerConfirmModal
          taskName={task.text}
          onConfirm={handleTimerConfirm}
        />
      )}

      {/* 메모 모달 */}
      {showMemoModal && (
        <MemoModal
          memo={task.memo}
          onSave={handleMemoModalSave}
          onClose={handleMemoModalClose}
        />
      )}
    </>
  );
}
