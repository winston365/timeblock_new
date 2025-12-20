/**
 * @file HourBar.tsx
 * @role 1시간 단위 작업 구간 UI 컴포넌트
 * @input hour (시간), blockId, tasks, tagId, 콜백 핸들러들
 * @output 시간 범위 표시, 작업 카드 목록, 인라인 입력, 태그 선택 UI
 * @dependencies TaskCard, useDragDropManager, systemRepository
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TimeBlockId, TimeSlotTagTemplate } from '@/shared/types/domain';
import { useToastStore } from '@/shared/stores/toastStore';
import TaskCard from './TaskCard';
import { useDragDropManager } from './hooks/useDragDropManager';
import { MAX_TASKS_PER_BLOCK } from './utils/timeBlockBucket';

const MAX_TASKS_PER_HOUR = MAX_TASKS_PER_BLOCK;

interface HourBarProps {
  hour: number;
  blockId: TimeBlockId;
  tasks: Task[];
  isLocked: boolean;
  tagId?: string | null;
  tagTemplates: TimeSlotTagTemplate[];
  recentTagIds?: string[];
  onSelectTag: (tagId: string | null) => void;
  onCreateTask: (text: string, hour: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDropTask: (taskId: string, targetHour: number) => void;
}

/**
 * 1시간 단위 작업 구간 컴포넌트
 * 시간 범위 표시, 작업 카드 목록, 인라인 입력, 태그 선택 기능을 제공합니다.
 *
 * @param props.hour - 시간 (0-23)
 * @param props.blockId - 소속 타임블록 ID
 * @param props.tasks - 해당 시간대의 작업 목록
 * @param props.isLocked - 블록 잠금 상태
 * @param props.tagId - 현재 선택된 태그 ID
 * @param props.tagTemplates - 사용 가능한 태그 템플릿 목록
 * @param props.recentTagIds - 최근 사용한 태그 ID 목록
 * @param props.onSelectTag - 태그 선택 콜백
 * @param props.onCreateTask - 작업 생성 콜백
 * @param props.onEditTask - 작업 편집 콜백
 * @param props.onUpdateTask - 작업 업데이트 콜백
 * @param props.onDeleteTask - 작업 삭제 콜백
 * @param props.onToggleTask - 작업 완료 토글 콜백
 * @param props.onDropTask - 드롭 시 호출 콜백 (현재 내부 처리로 미사용)
 * @returns 시간 바 UI
 */
export default function HourBar({
  hour,
  blockId,
  tasks,
  isLocked,
  tagId,
  tagTemplates,
  recentTagIds = [],
  onSelectTag,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
}: HourBarProps) {
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef({ preEndShown: false, restShown: false });
  const addToast = useToastStore(state => state.addToast);
  const { getDragData, isSameLocation } = useDragDropManager();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // NOTE: This component is currently unused (Schedule uses 3h buckets).
  // Keep collapse state local-only to avoid coupling to removed system keys.
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed((prev) => !prev);
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const orderA = a.order ?? new Date(a.createdAt).getTime();
      const orderB = b.order ?? new Date(b.createdAt).getTime();
      return orderA - orderB;
    });
  }, [tasks]);

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour === hour) {
        // 5분 전 마무리 알림
        if (currentMinute >= 45 && currentMinute < 50 && !toastRef.current.preEndShown) {
          addToast('5분 후 마무리! 정리할 것들을 챙겨봐.', 'info', 5000);
          toastRef.current.preEndShown = true;
        }

        // 휴식 시작 알림
        if (currentMinute >= 50 && !toastRef.current.restShown) {
          addToast('휴식 10분 시작! 10분은 온전히 쉬기.', 'success', 5000);
          toastRef.current.restShown = true;
        }
      } else if (currentHour > hour) {
        toastRef.current = { preEndShown: false, restShown: false };
      } else {
        toastRef.current = { preEndShown: false, restShown: false };
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [hour, addToast]);

  // 태그 선택 영역 외부 클릭 시 닫기
  useEffect(() => {
    const handleWindowClick = () => setTagPickerOpen(false);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const formatHourRange = () => {
    const startHour = hour.toString().padStart(2, '0');
    const endHour = (hour + 1).toString().padStart(2, '0');
    return `${startHour}:00-${endHour}:00`;
  };

  type HourStatus =
    | { type: 'current'; label: string }
    | { type: 'past'; label: string }
    | { type: 'upcoming'; label: string; detail?: string };

  const hourStatus: HourStatus = (() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const hourStartMinutes = hour * 60;
    const workRemaining = Math.max(50 - currentMinute, 0);
    const restRemaining = Math.max(60 - Math.max(currentMinute, 50), 0);

    if (currentHour === hour) {
      return {
        type: 'current',
        label:
          workRemaining > 0
            ? `현재 시간: 작업 ${workRemaining}분 · 휴식 10분`
            : `현재 시간: 휴식 ${Math.min(restRemaining, 10)}분`,
      };
    }

    if (currentHour > hour) {
      return {
        type: 'past',
        label: '지난 시간',
      };
    }

    const minutesUntilStart = Math.max(hourStartMinutes - currentTotalMinutes, 0);
    return {
      type: 'upcoming',
      label: '앞선 시간',
      detail: minutesUntilStart > 0 ? `${minutesUntilStart}분 후 시작` : undefined,
    };
  })();

  const statusBadgeClasses: Record<'past' | 'upcoming', string> = {
    past: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
    upcoming: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/40',
  };

  const activeTag = tagTemplates.find(t => t.id === tagId);
  const recentTemplates = recentTagIds
    .map(id => tagTemplates.find(t => t.id === id))
    .filter((t): t is TimeSlotTagTemplate => Boolean(t));

  const pickTag = (id: string | null) => {
    onSelectTag(id);
    setTagPickerOpen(false);
  };

  const getBadgeTextColor = (bg: string) => {
    if (!bg || !bg.startsWith('#') || bg.length < 7) return '#0f172a';
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#0f172a' : '#f8fafc';
  };

  const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inlineInputValue.trim()) {
      e.preventDefault();
      const trimmedText = inlineInputValue.trim();

      // 최대 개수 제한 검증
      if (tasks.length >= MAX_TASKS_PER_HOUR) {
        addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_HOUR}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
        return;
      }

      try {
        await onCreateTask(trimmedText, hour);
        setInlineInputValue('');
        inlineInputRef.current?.focus();
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    } else if (e.key === 'Escape') {
      setInlineInputValue('');
    }
  };

  const computeOrderBetween = (prev?: number, next?: number) => {
    if (prev === undefined && next === undefined) return Date.now();
    if (prev === undefined) return (next ?? 0) - 1;
    if (next === undefined) return prev + 1;
    if (prev === next) return prev + 0.001;
    return prev + (next - prev) / 2;
  };

  const handleDropToEnd = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragData = getDragData(e);
    if (!dragData) return;

    // 같은 위치에서 드롭하는 경우는 허용 (재정렬)
    const isDifferentLocation = !isSameLocation(dragData, blockId, hour);

    // 다른 위치에서 옮겨오는 경우 제한 체크
    if (isDifferentLocation && tasks.length >= MAX_TASKS_PER_HOUR) {
      addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_HOUR}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
      return;
    }

    const last = sortedTasks[sortedTasks.length - 1];
    const lastOrder = last ? last.order ?? sortedTasks.length : undefined;
    await onUpdateTask(dragData.taskId, { timeBlock: blockId, hourSlot: hour, order: (lastOrder ?? 0) + 1 });
  };

  const handleDropBefore = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const dragData = getDragData(e);
    if (!dragData) return;
    const targetTask = sortedTasks[targetIndex];
    if (!targetTask) return;
    if (dragData.taskId === targetTask.id && isSameLocation(dragData, blockId, hour)) return;

    // 다른 위치에서 옮겨오는 경우 제한 체크
    const isDifferentLocation = !isSameLocation(dragData, blockId, hour);
    if (isDifferentLocation && tasks.length >= MAX_TASKS_PER_HOUR) {
      addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_HOUR}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
      return;
    }

    const prevTask = sortedTasks[targetIndex - 1];
    const prevOrder = prevTask?.order ?? (targetIndex - 1);
    const nextOrder = targetTask.order ?? targetIndex;
    const newOrder = computeOrderBetween(prevOrder, nextOrder);

    await onUpdateTask(dragData.taskId, { timeBlock: blockId, hourSlot: hour, order: newOrder });
  };

  const containerClasses = [
    'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition hover:border-[var(--color-primary)]',
    isCollapsed ? 'px-3 py-2' : 'px-4 py-3'
  ].join(' ');

  const plannedFill = useMemo(() => {
    const totalMinutes = tasks.reduce((acc, task) => acc + (task.adjustedDuration || task.baseDuration || 15), 0);
    return Math.min((totalMinutes / 50) * 100, 100);
  }, [tasks]);

  const now = new Date();
  const nowHour = now.getHours();
  const isCurrentHour = nowHour === hour;
  const isPastHour = nowHour > hour;
  const currentMinute = now.getMinutes();
  const workFill = isCurrentHour
    ? Math.min((currentMinute / 50) * 100, 100)
    : currentHourPastFuture(nowHour, hour, 0, 100);
  const restFill =
    isPastHour ? 100 : nowHour < hour ? 0 : currentMinute < 50 ? 0 : Math.min(((currentMinute - 50) / 10) * 100, 100);
  const currentMarker = isCurrentHour ? Math.min((currentMinute / 60) * 100, 100) : 0;

  function currentHourPastFuture(nowHour: number, targetHour: number, futureVal: number, pastVal: number) {
    if (nowHour === targetHour) return 0;
    return nowHour > targetHour ? pastVal : futureVal;
  }

  return (
    <div
      className={containerClasses}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDropToEnd}
      data-hour={hour}
    >
      <div
        className={`${isCollapsed ? 'mb-1' : 'mb-2'} flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md px-2 py-1 text-base font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]/40`}
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center justify-center rounded p-1 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
            aria-label={isCollapsed ? '펼치기' : '접기'}
          >
            <span className={`transform transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
              ▼
            </span>
          </button>
          <span className="text-base font-bold text-[var(--color-text)]">{formatHourRange()}</span>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTagPickerOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)]"
              style={
                activeTag
                  ? {
                    backgroundColor: activeTag.color,
                    color: getBadgeTextColor(activeTag.color),
                    borderColor: activeTag.color,
                  }
                  : undefined
              }
            >
              <span aria-hidden="true">{activeTag?.icon || '🏷️'}</span>
              {activeTag ? activeTag.label : '+ 속성'}
            </button>

            {tagPickerOpen && (
              <div
                className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 text-[10px] font-semibold text-[var(--color-text-tertiary)]">최근 사용</div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(recentTemplates.length ? recentTemplates : tagTemplates.slice(0, 3)).map(tag => (
                    <button
                      key={`recent-${tag.id}`}
                      type="button"
                      onClick={() => pickTag(tag.id)}
                      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm transition hover:opacity-90"
                      style={{
                        backgroundColor: tag.color,
                        color: getBadgeTextColor(tag.color),
                      }}
                    >
                      <span aria-hidden="true">{tag.icon || '🏷️'}</span>
                      {tag.label}
                    </button>
                  ))}
                  {!recentTemplates.length && tagTemplates.length === 0 && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">템플릿 없음 (설정에서 추가)</span>
                  )}
                </div>

                <div className="mb-1 text-[10px] font-semibold text-[var(--color-text-tertiary)]">전체 템플릿</div>
                <div className="max-h-40 space-y-0.5 overflow-auto pr-1">
                  {tagTemplates.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => pickTag(tag.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] transition hover:bg-[var(--color-bg-tertiary)]"
                    >
                      <span className="flex items-center gap-2">
                        <span>{tag.icon || '🏷️'}</span>
                        <span className="font-semibold text-[var(--color-text)]">{tag.label}</span>
                      </span>
                      <span
                        className="h-4 w-4 rounded-full border border-[var(--color-border)]"
                        style={{ backgroundColor: tag.color }}
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => pickTag(null)}
                    className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                  >
                    없음
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right text-sm font-medium sm:flex-row sm:items-center sm:gap-3">
          {hourStatus.type === 'current' ? (
            <span className="flex items-center gap-1.5 font-semibold text-[var(--color-primary)]">
              <span role="img" aria-label="clock">
                ⏱
              </span>
              {hourStatus.label}
            </span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses[hourStatus.type]}`}
            >
              {hourStatus.label}
            </span>
          )}
          {hourStatus.type === 'upcoming' && hourStatus.detail && (
            <span className="text-xs font-normal text-[var(--color-text-tertiary)]">{hourStatus.detail}</span>
          )}
          {!isLocked && (
            <span className="text-xs font-normal text-[var(--color-text-tertiary)]">
              Enter로 바로 작업을 추가할 수 있어요
            </span>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {!isPastHour && (
            <div
              className={`relative mb-1.5 flex h-[8px] overflow-hidden rounded-full bg-black/20 text-xs ${isCurrentHour ? 'ring-1 ring-[var(--color-primary)]/40' : 'opacity-80'
                }`}
            >
              <div className="relative h-full overflow-hidden rounded-full bg-white/10" style={{ width: '83.33%' }}>
                {/* Planned Time Overlay */}
                <div
                  className="absolute top-0 left-0 h-full bg-emerald-500/40 transition-all duration-300"
                  style={{ width: `${plannedFill}%` }}
                  title={`계획된 시간: ${Math.round((plannedFill / 100) * 50)}분`}
                />

                {isCurrentHour && (
                  <>
                    <div
                      className="pointer-events-none absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-white/70"
                      aria-label="목표선 50분"
                      title="목표선 50분"
                    >
                      <span className="absolute left-1/2 top-[-2px] h-[4px] w-[4px] -translate-x-1/2 rounded-full border border-white/80 bg-black/70 shadow" />
                    </div>
                    <div
                      className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/90 bg-[var(--color-primary)] shadow-[0_0_6px_rgba(0,0,0,0.5)] transition-all"
                      style={{ left: `${currentMarker}%` }}
                      aria-label="현재 분 진행 위치"
                      title="현재 분 진행 위치"
                    />
                  </>
                )}
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200 transition-all duration-300"
                  style={{ width: `${workFill}%` }}
                />
              </div>
              <div className="relative h-full overflow-hidden rounded-full bg-amber-500/20" style={{ width: '16.67%' }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-300"
                  style={{ width: `${restFill}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {sortedTasks.map((task, index) => (
              <div
                key={task.id}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDropBefore(e, index)}
              >
                <TaskCard
                  task={task}
                  onEdit={() => onEditTask(task)}
                  onUpdateTask={(updates: Partial<Task>) => onUpdateTask(task.id, updates)}
                  onDelete={() => onDeleteTask(task.id)}
                  onToggle={() => onToggleTask(task.id)}
                  blockIsLocked={isLocked}
                />
              </div>
            ))}

            {!isLocked && !isPastHour && (
              <div className="w-full">
                {tasks.length >= MAX_TASKS_PER_HOUR ? (
                  <div className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-tertiary)] text-center">
                    ⚠️ 이 시간대에는 최대 {MAX_TASKS_PER_HOUR}개까지만 추가할 수 있습니다
                  </div>
                ) : (
                  <input
                    ref={inlineInputRef}
                    type="text"
                    value={inlineInputValue}
                    onChange={e => setInlineInputValue(e.target.value)}
                    onKeyDown={handleInlineInputKeyDown}
                    placeholder={`작업을 입력하고 Enter로 추가하세요 (${tasks.length}/${MAX_TASKS_PER_HOUR})`}
                    className="w-full rounded-md border border-dashed border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
