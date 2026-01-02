/**
 * 임시 스케줄 커맨드 팔레트
 *
 * @role TempScheduleModal 내부에서 Ctrl/Cmd+K로 열리는 명령 팔레트
 * @responsibilities
 *   - 뷰 전환 (Day/Week/Month)
 *   - 날짜 이동 (오늘/이전/다음)
 *   - 작업 추가/템플릿 열기
 *   - 작업 검색 및 액션 실행
 * @dependencies useTempScheduleStore, useModalEscapeClose
 */

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Sparkles,
  Trash2,
  Edit,
  X,
} from 'lucide-react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';

// ============================================================================
// Types
// ============================================================================

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'view' | 'navigation' | 'action' | 'task';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<Command['category'], string> = {
  view: '뷰 전환',
  navigation: '날짜 이동',
  action: '액션',
  task: '작업',
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * 커맨드 팔레트 컴포넌트
 * @description TempScheduleModal 내부에서만 동작하는 로컬 커맨드 팔레트
 */
function CommandPaletteComponent({ isOpen, onClose }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [taskMode, setTaskMode] = useState(false);

  const {
    tasks,
    selectedDate,
    setViewMode,
    goToToday,
    goToPrevious,
    goToNext,
    openTaskModal,
    openTemplateModal,
    deleteTask,
    promoteWithPostAction,
  } = useTempScheduleStore();

  // 기본 명령 목록
  const baseCommands: Command[] = useMemo(() => [
    // 뷰 전환
    {
      id: 'view-day',
      label: '일간 뷰',
      description: '하루 타임라인으로 전환',
      icon: <Calendar size={16} />,
      shortcut: 'D',
      action: () => { setViewMode('day'); onClose(); },
      category: 'view',
    },
    {
      id: 'view-week',
      label: '주간 뷰',
      description: '7일 캘린더로 전환',
      icon: <CalendarDays size={16} />,
      shortcut: 'W',
      action: () => { setViewMode('week'); onClose(); },
      category: 'view',
    },
    {
      id: 'view-month',
      label: '월간 뷰',
      description: '월 단위 개요로 전환',
      icon: <CalendarRange size={16} />,
      shortcut: 'M',
      action: () => { setViewMode('month'); onClose(); },
      category: 'view',
    },
    // 날짜 이동
    {
      id: 'nav-today',
      label: '오늘로 이동',
      description: '오늘 날짜로 즉시 이동',
      icon: <Clock size={16} />,
      shortcut: 'T',
      action: () => { goToToday(); onClose(); },
      category: 'navigation',
    },
    {
      id: 'nav-prev',
      label: '이전으로',
      description: '이전 날짜/주/월로 이동',
      icon: <ChevronLeft size={16} />,
      shortcut: '←',
      action: () => { goToPrevious(); onClose(); },
      category: 'navigation',
    },
    {
      id: 'nav-next',
      label: '다음으로',
      description: '다음 날짜/주/월로 이동',
      icon: <ChevronRight size={16} />,
      shortcut: '→',
      action: () => { goToNext(); onClose(); },
      category: 'navigation',
    },
    // 액션
    {
      id: 'action-add',
      label: '새 스케줄 추가',
      description: '새 임시 스케줄 생성',
      icon: <Plus size={16} />,
      shortcut: 'N',
      action: () => { openTaskModal(); onClose(); },
      category: 'action',
    },
    {
      id: 'action-template',
      label: '템플릿 열기',
      description: '템플릿 관리 모달 열기',
      icon: <FileText size={16} />,
      action: () => { openTemplateModal(); onClose(); },
      category: 'action',
    },
    {
      id: 'action-search-task',
      label: '작업 검색...',
      description: '이름으로 작업 찾기',
      icon: <Search size={16} />,
      action: () => { setTaskMode(true); setQuery(''); },
      category: 'action',
    },
  ], [setViewMode, goToToday, goToPrevious, goToNext, openTaskModal, openTemplateModal, onClose]);

  // 작업 검색 결과를 명령으로 변환
  const taskCommands: Command[] = useMemo(() => {
    if (!taskMode) return [];

    const filteredTasks = tasks
      .filter(t => !t.isArchived)
      .filter(t => 
        query === '' || 
        t.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10);

    return filteredTasks.flatMap((task): Command[] => [
      {
        id: `task-edit-${task.id}`,
        label: task.name,
        description: `편집 · ${task.startTime}분 ~ ${task.endTime}분`,
        icon: <Edit size={16} />,
        action: () => { openTaskModal(task); onClose(); },
        category: 'task',
      },
      {
        id: `task-promote-${task.id}`,
        label: `'${task.name}' 승격`,
        description: '실제 작업으로 변환',
        icon: <Sparkles size={16} />,
        action: async () => { 
          await promoteWithPostAction(task, 'keep');
          onClose();
        },
        category: 'task',
      },
      {
        id: `task-delete-${task.id}`,
        label: `'${task.name}' 삭제`,
        description: '스케줄 삭제',
        icon: <Trash2 size={16} />,
        action: async () => {
          if (confirm(`'${task.name}' 스케줄을 삭제하시겠습니까?`)) {
            await deleteTask(task.id);
          }
          onClose();
        },
        category: 'task',
      },
    ]);
  }, [taskMode, tasks, query, openTaskModal, promoteWithPostAction, deleteTask, onClose]);

  // 필터링된 명령 목록
  const filteredCommands = useMemo(() => {
    if (taskMode) return taskCommands;

    if (!query) return baseCommands;

    return baseCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase())
    );
  }, [baseCommands, taskCommands, taskMode, query]);

  // 카테고리별 그룹화
  const groupedCommands = useMemo(() => {
    const groups: { category: Command['category']; commands: Command[] }[] = [];
    const categories = ['view', 'navigation', 'action', 'task'] as const;

    for (const category of categories) {
      const commands = filteredCommands.filter(cmd => cmd.category === category);
      if (commands.length > 0) {
        groups.push({ category, commands });
      }
    }

    return groups;
  }, [filteredCommands]);

  // 선택 인덱스 리셋
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, taskMode]);

  // 포커스 관리
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
      setTaskMode(false);
    }
  }, [isOpen]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (taskMode) {
          setTaskMode(false);
          setQuery('');
        } else {
          onClose();
        }
        break;
      case 'Backspace':
        if (query === '' && taskMode) {
          setTaskMode(false);
        }
        break;
    }
  }, [filteredCommands, selectedIndex, taskMode, query, onClose]);

  // 선택된 항목 스크롤
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      // Modal UX 정책: backdrop click 닫기 금지 - ESC만 허용
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 검색 입력 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
          <Search size={18} className="text-[var(--color-text-tertiary)]" />
          {taskMode && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-medium">
              작업 검색
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={taskMode ? '작업 이름 검색...' : '명령 검색...'}
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
            autoComplete="off"
          />
          <button
            type="button"
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* 명령 목록 */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {groupedCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              {taskMode ? '일치하는 작업이 없습니다' : '일치하는 명령이 없습니다'}
            </div>
          ) : (
            groupedCommands.map(({ category, commands }) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </div>
                {commands.map((cmd) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-index={globalIndex}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                          : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text)]'
                      }`}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className={isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}>
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-tertiary)]">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[10px] text-[var(--color-text-tertiary)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-mono">↑↓</kbd>
              {' '}이동
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-mono">Enter</kbd>
              {' '}실행
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-mono">Esc</kbd>
              {' '}닫기
            </span>
          </div>
          <span>임시 스케줄 · {selectedDate}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const CommandPalette = memo(CommandPaletteComponent);
export default CommandPalette;
