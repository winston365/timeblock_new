/**
 * 임시 스케줄 작업 목록
 *
 * @role 우측 패널에 스케줄 작업 목록 표시
 * @responsibilities
 *   - 등록된 모든 스케줄 작업 목록 표시
 *   - 반복 규칙 표시
 *   - 작업 추가/편집/삭제 버튼
 *   - 오늘/내일/이후 기준 그룹화 및 정렬
 *   - D-Day 상대적 표시
 *   - 임박 일정 하이라이트
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask, RecurrenceRule } from '@/shared/types/tempSchedule';
import { getLocalDate, minutesToTimeStr } from '@/shared/lib/utils';
import { RecurringBadge, FavoriteBadge, ArchivedBadge, DurationBadge } from './StatusBadges';

// ============================================================================
// Constants
// ============================================================================

/** 임박 일정으로 간주하는 시간 (분) */
const IMMINENT_THRESHOLD_MINUTES = 60;

/** 진행 중 일정 갱신 간격 (ms) */
const REFRESH_INTERVAL_MS = 60_000; // 1분

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayStr(): string {
  return getLocalDate();
}

/**
 * YYYY-MM-DD 문자열을 로컬 Date로 파싱
 * @note new Date('YYYY-MM-DD')는 환경에 따라 UTC로 해석될 수 있어 사용하지 않는다.
 */
function parseYmdToLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const head = dateStr.slice(0, 10);
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(head);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;

  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year) return null;
  if (date.getMonth() !== monthIndex) return null;
  if (date.getDate() !== day) return null;
  return date;
}

function normalizeYmd(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const head = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDate(parsed);
}

/**
 * 두 날짜 사이의 일수 차이 계산
 */
function getDaysDiff(dateStr: string, baseDate: string = getTodayStr()): number {
  const normalizedDateStr = normalizeYmd(dateStr);
  const normalizedBaseDate = normalizeYmd(baseDate) ?? baseDate;

  if (!normalizedDateStr) return 0;

  const date = parseYmdToLocalDate(normalizedDateStr);
  const base = parseYmdToLocalDate(normalizedBaseDate);
  if (!date || !base) return 0;

  const diffTime = date.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * D-Day 라벨 생성 (상대적 날짜 표시)
 */
function getDDayLabel(dateStr: string): string {
  const diff = getDaysDiff(dateStr);
  if (diff < 0) return `D${diff}`; // D-1, D-2 (지난 날짜)
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff <= 7) return `D+${diff}`;
  return dateStr; // 일주일 이후는 날짜 그대로
}

/**
 * 일정이 임박했는지 확인 (오늘 + 1시간 이내 시작)
 */
function isImminent(task: TempScheduleTask): boolean {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  
  if (scheduledDate !== today) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesUntilStart = task.startTime - currentMinutes;
  
  return minutesUntilStart > 0 && minutesUntilStart <= IMMINENT_THRESHOLD_MINUTES;
}

/**
 * 일정이 지나갔는지 확인 (오늘 + 종료 시간 지남)
 */
function isPast(task: TempScheduleTask): boolean {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  
  // 과거 날짜
  if (scheduledDate < today) return true;
  
  // 오늘인데 종료 시간이 지남
  if (scheduledDate === today) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return task.endTime < currentMinutes;
  }
  
  return false;
}

/**
 * 현재 진행 중인 일정인지 확인
 */
function isInProgress(task: TempScheduleTask, currentMinutes: number): boolean {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  
  if (scheduledDate !== today) return false;
  
  return task.startTime <= currentMinutes && currentMinutes < task.endTime;
}

/**
 * 다음 예정 일정인지 확인 (오늘의 아직 시작 안 한 일정 중 가장 빠른 것)
 */
function getNextUpcomingTask(tasks: TempScheduleTask[], currentMinutes: number): TempScheduleTask | null {
  const today = getTodayStr();
  
  const upcoming = tasks
    .filter(t => {
      const date = normalizeYmd(t.scheduledDate) ?? today;
      return date === today && t.startTime > currentMinutes;
    })
    .sort((a, b) => a.startTime - b.startTime);
  
  return upcoming[0] ?? null;
}

/**
 * 임박 시간 라벨 (몇 분 후 시작)
 */
function getImminentLabel(task: TempScheduleTask): string | null {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  
  if (scheduledDate !== today) return null;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesUntilStart = task.startTime - currentMinutes;
  
  if (minutesUntilStart <= 0) return null;
  if (minutesUntilStart <= IMMINENT_THRESHOLD_MINUTES) {
    return `${minutesUntilStart}분 후 시작`;
  }
  return null;
}

/**
 * 반복 규칙을 읽기 쉬운 문자열로 변환
 */
function getRecurrenceLabel(recurrence: RecurrenceRule): string {
  switch (recurrence.type) {
    case 'daily':
      return '매일';
    case 'weekly': {
      if (!recurrence.weeklyDays || recurrence.weeklyDays.length === 0) return '매주';
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayNames = recurrence.weeklyDays.sort((a, b) => a - b).map(d => days[d]);
      return `매주 ${dayNames.join(', ')}`;
    }
    case 'monthly':
      return '매월';
    case 'custom':
      return `${recurrence.intervalDays}일마다`;
    case 'none':
    default:
      return '1회';
  }
}

/**
 * 시간 범위 포맷
 */
function formatTimeRange(startTime: number, endTime: number): string {
  return `${minutesToTimeStr(startTime)} - ${minutesToTimeStr(endTime)}`;
}

/**
 * 일회성 일정을 날짜 그룹으로 분류
 */
interface DateGroup {
  label: string;
  emoji: string;
  tasks: TempScheduleTask[];
  sortOrder: number;
}

function groupTasksByDate(tasks: TempScheduleTask[]): DateGroup[] {
  const today = getTodayStr();
  
  const groups: Record<string, DateGroup> = {};
  
  for (const task of tasks) {
    const date = normalizeYmd(task.scheduledDate) ?? today;
    const diff = getDaysDiff(date);
    
    let groupKey: string;
    let label: string;
    let emoji: string;
    let sortOrder: number;
    
    if (diff < 0) {
      // 지난 일정 (맨 아래로)
      groupKey = 'past';
      label = '지난 일정';
      emoji = '⏰';
      sortOrder = 99;
    } else if (diff === 0) {
      groupKey = 'today';
      label = '오늘';
      emoji = '📌';
      sortOrder = 0;
    } else if (diff === 1) {
      groupKey = 'tomorrow';
      label = '내일';
      emoji = '📅';
      sortOrder = 1;
    } else if (diff <= 7) {
      groupKey = 'thisWeek';
      label = '이번 주';
      emoji = '🗓️';
      sortOrder = 2;
    } else {
      groupKey = 'later';
      label = '다가오는 일정';
      emoji = '📆';
      sortOrder = 3;
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = { label, emoji, tasks: [], sortOrder };
    }
    groups[groupKey].tasks.push(task);
  }
  
  // 각 그룹 내 시간순 정렬 + 그룹 정렬
  return Object.values(groups)
    .map(group => ({
      ...group,
      tasks: group.tasks.sort((a, b) => {
        // 먼저 날짜순, 같은 날이면 시간순
        const dateA = normalizeYmd(a.scheduledDate) ?? today;
        const dateB = normalizeYmd(b.scheduledDate) ?? today;
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.startTime - b.startTime;
      }),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ============================================================================
// Sub Components
// ============================================================================

interface TaskItemProps {
  task: TempScheduleTask;
  onEdit: (task: TempScheduleTask) => void;
  onDelete: (id: string) => void;
  showDDay?: boolean; // 일회성 일정에서 D-Day 표시 여부
}

interface TaskItemProps {
  task: TempScheduleTask;
  onEdit: (task: TempScheduleTask) => void;
  onDelete: (id: string) => void;
  showDDay?: boolean;
  isNextUp?: boolean; // 다음 예정 일정 표시
  currentTime: number; // 현재 시간 (분) - 갱신용
}

const TaskItem = memo(function TaskItem({ 
  task, 
  onEdit, 
  onDelete, 
  showDDay = false,
  isNextUp = false,
  currentTime,
}: TaskItemProps) {
  const imminent = isImminent(task);
  const past = isPast(task);
  const inProgress = isInProgress(task, currentTime);
  const imminentLabel = getImminentLabel(task);
  const durationMinutes = task.endTime - task.startTime;
  const isRecurring = task.recurrence.type !== 'none';
  const isArchived = task.isArchived;
  
  // 진행률 계산 (진행 중일 때)
  const progressPercent = useMemo(() => {
    if (!inProgress) return 0;
    const totalDuration = task.endTime - task.startTime;
    const elapsed = currentTime - task.startTime;
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }, [inProgress, task.startTime, task.endTime, currentTime]);
  
  return (
    <div
      className={`
        group flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer relative overflow-hidden
        ${isArchived
          ? 'border-[var(--color-border)]/30 bg-[var(--color-bg-surface)]/30 opacity-50'
          : inProgress
            ? 'border-green-500/50 bg-green-500/10 shadow-md shadow-green-500/20 ring-2 ring-green-500/30'
            : imminent 
              ? 'border-orange-500/50 bg-orange-500/10 shadow-md shadow-orange-500/20' 
              : past
                ? 'border-[var(--color-border)]/50 bg-[var(--color-bg-surface)]/50 opacity-60'
                : isNextUp
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-md'
        }
      `}
      onClick={() => onEdit(task)}
    >
      {/* 진행률 배경 바 (진행 중일 때) */}
      {inProgress && (
        <div 
          className="absolute inset-0 bg-green-500/10 transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />
      )}
      
      {/* 색상 표시 */}
      <div
        className={`w-1.5 self-stretch rounded-full flex-shrink-0 z-10 ${past ? 'opacity-50' : ''}`}
        style={{ backgroundColor: task.color }}
      />

      {/* 내용 */}
      <div className="flex-1 min-w-0 z-10">
        {/* 제목 행 */}
        <div className="flex items-center gap-2">
          {/* 상태 뱃지 */}
          {inProgress && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-bold animate-pulse">
              진행 중
            </span>
          )}
          {isNextUp && !inProgress && !imminent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
              다음
            </span>
          )}
          {task.favorite && <FavoriteBadge />}
          {isRecurring && <RecurringBadge />}
          {isArchived && <ArchivedBadge />}
          <span className={`font-semibold text-sm truncate ${past ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'}`}>
            {task.name}
          </span>
        </div>

        {/* 시간 행 - 강조 표시 */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`font-mono font-bold text-base ${inProgress ? 'text-green-400' : imminent ? 'text-orange-400' : past ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text)]'}`}>
            {formatTimeRange(task.startTime, task.endTime)}
          </span>
          <DurationBadge durationMinutes={durationMinutes} />
        </div>
        
        {/* 진행 중 - 남은 시간 */}
        {inProgress && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-400 font-medium">
            <span>⏳</span>
            <span>{task.endTime - currentTime}분 남음</span>
            <span className="text-[var(--color-text-tertiary)]">
              ({Math.round(progressPercent)}% 완료)
            </span>
          </div>
        )}

        {/* 임박 알림 */}
        {imminentLabel && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-orange-400 font-medium">
            <span className="animate-pulse">🔥</span>
            <span>{imminentLabel}</span>
          </div>
        )}

        {/* 지난 일정 표시 */}
        {past && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
            <span>✅</span>
            <span>완료됨</span>
          </div>
        )}

        {/* 메타 정보 행 */}
        <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{getRecurrenceLabel(task.recurrence)}</span>
          
          {/* D-Day 표시 (일회성 일정) */}
          {showDDay && task.scheduledDate && task.recurrence.type === 'none' && (
            <>
              <span className="text-[var(--color-border)]">•</span>
              <span className={getDaysDiff(task.scheduledDate) <= 1 ? 'text-[var(--color-primary)] font-medium' : ''}>
                {getDDayLabel(task.scheduledDate)}
              </span>
            </>
          )}
        </div>

        {task.memo && (
          <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)] truncate">
            💬 {task.memo}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          title="편집"
        >
          ✏️
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-tertiary)] hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('이 스케줄을 삭제하시겠습니까?')) {
              onDelete(task.id);
            }
          }}
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleTaskListProps {
  tasks: TempScheduleTask[];
}

function TempScheduleTaskListComponent({ tasks }: TempScheduleTaskListProps) {
  const { openTaskModal, deleteTask } = useTempScheduleStore();
  
  // 현재 시간 상태 (분 단위, 자동 갱신)
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  
  // 1분마다 현재 시간 갱신 (진행 중 일정 & 임박 일정 자동 업데이트)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.getHours() * 60 + now.getMinutes());
    }, REFRESH_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, []);

  // 반복/일회성 분리 + 일회성은 날짜별 그룹화
  const { recurring, dateGroups, todayCount, inProgressCount, nextUpTask } = useMemo(() => {
    const recurringTasks: TempScheduleTask[] = [];
    const oneTimeTasks: TempScheduleTask[] = [];

    for (const task of tasks) {
      if (task.recurrence.type !== 'none') {
        recurringTasks.push(task);
      } else {
        oneTimeTasks.push(task);
      }
    }

    // 반복 일정은 시간순 정렬
    recurringTasks.sort((a, b) => a.startTime - b.startTime);

    // 일회성 일정은 날짜 그룹화
    const groups = groupTasksByDate(oneTimeTasks);
    
    // 오늘 일정 수 계산
    const todayGroup = groups.find(g => g.label === '오늘');
    const todayTaskCount = todayGroup?.tasks.length ?? 0;
    
    // 진행 중인 일정 수
    const progressCount = tasks.filter(task => isInProgress(task, currentTime)).length;
    
    // 다음 예정 일정
    const nextTask = getNextUpcomingTask(oneTimeTasks, currentTime);

    return { 
      recurring: recurringTasks, 
      dateGroups: groups,
      todayCount: todayTaskCount,
      inProgressCount: progressCount,
      nextUpTask: nextTask,
    };
  }, [tasks, currentTime]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">📋 스케줄 목록</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              총 {tasks.length}개
            </span>
            {todayCount > 0 && (
              <span className="text-[10px] text-[var(--color-primary)] font-medium">
                오늘 {todayCount}개
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium animate-pulse">
                ⏳ {inProgressCount}개 진행 중
              </span>
            )}
          </div>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-dark)] transition-colors"
          onClick={() => openTaskModal()}
        >
          + 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-sm">등록된 스케줄이 없습니다</p>
            <button
              className="mt-3 text-xs text-[var(--color-primary)] hover:underline"
              onClick={() => openTaskModal()}
            >
              첫 번째 스케줄을 추가해보세요!
            </button>
          </div>
        ) : (
          <>
            {/* 날짜별 일회성 일정 (오늘/내일/이번주/다가오는) */}
            {dateGroups.map(group => (
              <div key={group.label}>
                {/* 개선된 그룹 헤더 */}
                <div className={`
                  flex items-center gap-2 mb-2 pb-1 border-b
                  ${group.label === '오늘' 
                    ? 'border-[var(--color-primary)]/30' 
                    : group.label === '지난 일정'
                      ? 'border-[var(--color-border)]/30'
                      : 'border-[var(--color-border)]/50'
                  }
                `}>
                  <span className="text-sm">{group.emoji}</span>
                  <span className={`text-xs font-bold tracking-wide ${
                    group.label === '오늘' 
                      ? 'text-[var(--color-primary)]' 
                      : group.label === '지난 일정'
                        ? 'text-[var(--color-text-tertiary)]'
                        : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {group.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    group.label === '오늘'
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'
                  }`}>
                    {group.tasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.tasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onEdit={openTaskModal}
                      onDelete={deleteTask}
                      showDDay={group.label !== '오늘' && group.label !== '지난 일정'}
                      isNextUp={nextUpTask?.id === task.id}
                      currentTime={currentTime}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* 반복 일정 */}
            {recurring.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[var(--color-border)]/50">
                  <span className="text-sm">🔄</span>
                  <span className="text-xs font-bold tracking-wide text-[var(--color-text-secondary)]">
                    반복 일정
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                    {recurring.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {recurring.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onEdit={openTaskModal}
                      onDelete={deleteTask}
                      currentTime={currentTime}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 푸터 - 총 개수 + 현재 시간 */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 flex justify-between items-center">
        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
          {minutesToTimeStr(currentTime)} 기준
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          총 {tasks.length}개의 스케줄
        </span>
      </div>
    </div>
  );
}

export const TempScheduleTaskList = memo(TempScheduleTaskListComponent);
export default TempScheduleTaskList;
