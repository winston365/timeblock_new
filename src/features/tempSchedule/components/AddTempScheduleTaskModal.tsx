/**
 * 임시 스케줄 작업 추가/편집 모달
 *
 * @role 스케줄 작업 생성 및 수정
 * @responsibilities
 *   - 작업 이름, 시간 범위 설정
 *   - 예정 날짜 설정
 *   - 반복 규칙 설정
 *   - 색상 선택
 *   - 부모 작업 선택 (중첩)
 * @dependencies useTempScheduleStore
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { RecurrenceRule, TempScheduleRecurrenceType } from '@/shared/types/tempSchedule';
import { TEMP_SCHEDULE_COLORS, TEMP_SCHEDULE_DEFAULTS } from '@/shared/types/tempSchedule';
import { useModalEscapeClose } from '@/shared/hooks';

// ============================================================================
// Constants
// ============================================================================

const WEEK_DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

const RECURRENCE_TYPES: { value: TempScheduleRecurrenceType; label: string }[] = [
  { value: 'none', label: '반복 안함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주 특정 요일' },
  { value: 'monthly', label: '매월' },
  { value: 'custom', label: 'N일 간격' },
];

// ============================================================================
// Main Component
// ============================================================================

function AddTempScheduleTaskModalComponent() {
  const { 
    isTaskModalOpen, 
    closeTaskModal, 
    editingTask, 
    addTask, 
    updateTask,
    deleteTask,
    tasks,
    selectedDate,
  } = useTempScheduleStore();

  useModalEscapeClose(isTaskModalOpen, closeTaskModal);

  // Form 상태
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [color, setColor] = useState<string>(TEMP_SCHEDULE_DEFAULTS.defaultColor);
  const [parentId, setParentId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<TempScheduleRecurrenceType>('none');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState(1);
  const [endDate, setEndDate] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);

  // 부모 후보 (중첩 가능한 작업들)
  const parentCandidates = tasks.filter(t => t.id !== editingTask?.id && !t.parentId);

  // 편집 모드일 때 초기값 설정
  useEffect(() => {
    if (editingTask) {
      setName(editingTask.name);
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setScheduledDate(editingTask.scheduledDate || '');
      setColor(editingTask.color);
      setParentId(editingTask.parentId || null);
      setMemo(editingTask.memo || '');
      setRecurrenceType(editingTask.recurrence.type);
      setWeeklyDays(editingTask.recurrence.weeklyDays || []);
      setIntervalDays(editingTask.recurrence.intervalDays || 1);
      setEndDate(editingTask.recurrence.endDate || '');
      setIsFavorite(editingTask.favorite ?? false);
    } else {
      // 새 작업: 기본값
      setName('');
      setStartTime('09:00');
      setEndTime('10:00');
      setScheduledDate(selectedDate);
      setColor(TEMP_SCHEDULE_DEFAULTS.defaultColor);
      setParentId(null);
      setMemo('');
      setRecurrenceType('none');
      setWeeklyDays([]);
      setIntervalDays(1);
      setEndDate('');
      setIsFavorite(false);
    }
  }, [editingTask, isTaskModalOpen, selectedDate]);

  // 요일 토글
  const toggleWeekDay = useCallback((day: number) => {
    setWeeklyDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  }, []);

  // 저장
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      alert('스케줄 이름을 입력해주세요.');
      return;
    }

    if (startTime >= endTime) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const recurrence: RecurrenceRule = {
      type: recurrenceType,
      weeklyDays: recurrenceType === 'weekly' ? weeklyDays : [],
      intervalDays: recurrenceType === 'custom' ? intervalDays : 1,
      endDate: endDate || null,
    };

    const taskData = {
      name: name.trim(),
      startTime,
      endTime,
      scheduledDate: recurrenceType === 'none' ? (scheduledDate || null) : null,
      color,
      parentId,
      recurrence,
      order: editingTask?.order ?? tasks.length,
      memo: memo.trim(),
      favorite: isFavorite,
    };

    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
      } else {
        await addTask(taskData);
      }
      closeTaskModal();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('저장에 실패했습니다.');
    }
  }, [name, startTime, endTime, scheduledDate, color, parentId, memo, recurrenceType, weeklyDays, intervalDays, endDate, editingTask, tasks.length, addTask, updateTask, closeTaskModal, isFavorite]);

  const handleDelete = useCallback(async () => {
    if (!editingTask) return;
    const confirmed = confirm('이 스케줄을 삭제하시겠습니까?');
    if (!confirmed) return;
    await deleteTask(editingTask.id);
    closeTaskModal();
  }, [deleteTask, editingTask, closeTaskModal]);

  if (!isTaskModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div 
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {editingTask ? '📝 스케줄 편집' : '➕ 새 스케줄'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFavorite(prev => !prev)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg transition ${
                isFavorite
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
              title="즐겨찾기 토글"
            >
              {isFavorite ? '★' : '☆'}
            </button>
            {editingTask && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-8 px-3 items-center justify-center rounded-full border border-red-500/60 bg-red-500/10 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition"
              >
                삭제
              </button>
            )}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              onClick={closeTaskModal}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              스케줄 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 회사 출근, 영어 수업"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              autoFocus
            />
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                시작 시간
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                종료 시간
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              색상
            </label>
            <div className="flex gap-2 flex-wrap">
              {TEMP_SCHEDULE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110 ring-2 ring-[var(--color-primary)]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* 반복 설정 */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              반복 설정
            </label>
            <select
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as TempScheduleRecurrenceType)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              {RECURRENCE_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* 반복 없음: 예정 날짜 */}
          {recurrenceType === 'none' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                예정 날짜
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          )}

          {/* 주간 반복: 요일 선택 */}
          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                반복 요일
              </label>
              <div className="flex gap-2">
                {WEEK_DAYS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${
                      weeklyDays.includes(value)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                    }`}
                    onClick={() => toggleWeekDay(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* N일 간격 */}
          {recurrenceType === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                반복 간격
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none text-center"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">일마다</span>
              </div>
            </div>
          )}

          {/* 반복 종료일 (반복 있을 때만) */}
          {recurrenceType !== 'none' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                반복 종료일 (선택)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                비워두면 무한 반복
              </p>
            </div>
          )}

          {/* 중첩 (부모 선택) */}
          {parentCandidates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                상위 스케줄 (중첩)
              </label>
              <select
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value || null)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              >
                <option value="">없음</option>
                {parentCandidates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                큰 블록 안에 작은 블록 배치 (예: "업무" 안에 "회의")
              </p>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모 (선택)"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4">
          <button
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            onClick={closeTaskModal}
          >
            취소
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white hover:bg-[var(--color-primary-dark)] transition-colors"
            onClick={handleSave}
          >
            {editingTask ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const AddTempScheduleTaskModal = memo(AddTempScheduleTaskModalComponent);
export default AddTempScheduleTaskModal;
