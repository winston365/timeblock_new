import type { ReactElement } from 'react';

import type { UseInboxControllerReturn } from '@/features/tasks/hooks/useInboxController';
import type { UseInboxDragDropReturn } from '@/features/tasks/hooks/useInboxDragDrop';

import { InboxItem } from './InboxItem';

export interface InboxListProps {
  readonly controller: UseInboxControllerReturn;
  readonly dragDrop: UseInboxDragDropReturn;
}

export const InboxList = ({ controller, dragDrop }: InboxListProps): ReactElement => {
  const tabContentClass = [
    'flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 transition-all',
    dragDrop.isDragOver
      ? 'bg-[var(--color-primary)]/5 ring-2 ring-inset ring-[var(--color-primary)]/50'
      : '',
  ].join(' ');

  const tabs: Array<{ id: UseInboxControllerReturn['activeTab']; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'recent', label: '최근' },
    { id: 'pinned', label: '고정' },
    { id: 'deferred', label: '보류' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];

  return (
    <div
      className={tabContentClass}
      onDragOver={dragDrop.handleDragOver}
      onDragLeave={dragDrop.handleDragLeave}
      onDrop={(e) => {
        void dragDrop.handleDrop(e);
      }}
    >
      <div className="mx-3 mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => controller.setHudCollapsed(!controller.hudCollapsed)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <span className={`transition-transform ${controller.hudCollapsed ? '' : 'rotate-90'}`}>▶</span>
            <span>정리 진행도</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px]">
              {controller.stats.pinned > 0 && (
                <span className="text-amber-500" title="고정">
                  📌 {controller.stats.pinned}
                </span>
              )}
              {controller.stats.deferred > 0 && (
                <span className="text-[var(--color-text-quaternary)]" title="보류">
                  ⏸️ {controller.stats.deferred}
                </span>
              )}
              <span className="text-[var(--color-text-tertiary)]" title="처리 대기">
                📥 {controller.stats.actionable}
              </span>
            </div>
            {controller.isGoalAchieved && (
              <span className="text-[10px] text-emerald-500 font-medium">달성!</span>
            )}
          </div>
        </div>

        {!controller.hudCollapsed && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    controller.isGoalAchieved ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'
                  }`}
                  style={{ width: `${controller.progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)] min-w-[40px] text-right">
                {controller.todayProcessedCount}/{controller.dailyGoalCount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-tertiary)]">오늘 목표</span>
              <div className="flex items-center gap-1">
                {[3, 5, 10, 15].map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => controller.setDailyGoalCount(goal)}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                      controller.dailyGoalCount === goal
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                    }`}
                  >
                    {goal}개
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                Triage 모드 <span className="text-[var(--color-text-quaternary)]">(키보드 루프)</span>
              </span>
              <button
                type="button"
                onClick={controller.handleToggleTriage}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  controller.triageEnabled
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                }`}
              >
                {controller.triageEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 px-1 py-1 text-[11px] overflow-x-auto whitespace-nowrap scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => controller.setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition ${
              controller.activeTab === tab.id
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-1 py-0.5 text-[10px] font-bold text-[var(--color-text)]">
              {controller.counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={controller.inlineInputValue}
          onChange={(e) => controller.setInlineInputValue(e.target.value)}
          onKeyDown={(e) => {
            void controller.handleInlineInputKeyDown(e);
          }}
          onFocus={controller.handleInlineInputFocus}
          onBlur={controller.handleInlineInputBlur}
          placeholder="작업을 입력하고 Enter로 추가하세요 (기본 15분)"
          className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-elevated)] focus:shadow-sm"
        />
      </div>

      {controller.triageEnabled && controller.inboxTasks.length > 0 && (
        <div className="mx-0 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <span>⌨️</span>
            <span>
              <strong>Triage 모드</strong>: ↑↓ 이동 | T/O/N 배치 | P 고정 | H 보류 | d 삭제 | Enter 편집 | ESC 종료
            </span>
          </div>
        </div>
      )}

      {controller.inboxTasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-2xl">
            📭
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">인박스가 비어있습니다</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              할 일을 추가하거나<br />시간표에서 드래그하여 보관하세요
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          {controller.filteredTasks.map((task) => {
            const isFocused = controller.triageEnabled && controller.focusedTaskId === task.id;

            return (
              <InboxItem
                key={task.id}
                task={task}
                isFocused={isFocused}
                todayISO={controller.stats.todayISO}
                onEdit={() => controller.handleEditTask(task)}
                onDelete={() => {
                  void controller.handleDeleteTask(task.id);
                }}
                onToggle={() => {
                  void controller.handleToggleTask(task.id);
                }}
                onUpdateTask={(updates) => controller.updateTask(task.id, updates)}
                onDragEnd={controller.handleTaskDragEnd}
                onQuickPlace={(mode) => {
                  void controller.handleQuickPlace(task.id, mode);
                }}
                onTogglePin={() => {
                  void controller.handleTogglePin(task);
                }}
                onToggleDefer={() => {
                  void controller.handleToggleDefer(task);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
