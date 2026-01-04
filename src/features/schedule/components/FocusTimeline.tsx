/**
 * @file FocusTimeline.tsx
 * @role 예정된 작업 목록을 타임라인 형태로 표시하는 컴포넌트
 * @responsibilities
 *   - 드래그 앤 드롭으로 작업 순서 재배치
 *   - 작업 항목 클릭 시 편집 모드 진입
 *   - 작업별 난이도 및 소요 시간 표시
 * @dependencies framer-motion (Reorder, useDragControls), Task 타입
 */

import { Reorder, useDragControls } from 'framer-motion';
import type { Task } from '@/shared/types/domain';

interface FocusTimelineProps {
    tasks: Task[];
    onReorder: (newOrder: Task[]) => void;
    onEdit: (task: Task) => void;
    /** 작업을 영웅 위치로 승격 */
    onPromote?: (task: Task) => void;
}

/**
 * 예정된 작업 목록을 드래그 가능한 타임라인으로 표시하는 컴포넌트
 * @param props - 타임라인 프로퍼티
 * @param props.tasks - 표시할 작업 목록
 * @param props.onReorder - 작업 순서 변경 시 호출되는 콜백 함수
 * @param props.onEdit - 작업 편집 시 호출되는 콜백 함수
 * @returns 드래그 가능한 작업 타임라인 UI
 */
export function FocusTimeline({ tasks, onReorder, onEdit, onPromote: _onPromote }: FocusTimelineProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <span>📋</span>
                <span>예정 작업</span>
                <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                    {tasks.length}
                </span>
            </h3>

            <Reorder.Group axis="y" values={tasks} onReorder={onReorder} className="space-y-3">
                {tasks.map((task) => (
                    <TimelineItem key={task.id} task={task} onEdit={onEdit} />
                ))}
            </Reorder.Group>
        </div>
    );
}

/**
 * 타임라인 개별 작업 항목 컴포넌트 (드래그 가능)
 * @param props - 항목 프로퍼티
 * @param props.task - 표시할 작업 객체
 * @param props.onEdit - 작업 편집 시 호출되는 콜백 함수
 * @returns 드래그 가능한 작업 항목 UI
 */
function TimelineItem({ task: scheduledTask, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={scheduledTask}
            dragListener={false}
            dragControls={dragControls}
            className="relative flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm transition-all hover:border-[var(--color-primary)] hover:shadow-md"
        >
            {/* Drag Handle */}
            <div
                className="cursor-grab touch-none p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
            >
                ⋮⋮
            </div>

            {/* Content */}
            <div className="flex-1 cursor-pointer" onClick={() => onEdit(scheduledTask)}>
                <div className="font-medium text-[var(--color-text-primary)]">{scheduledTask.text}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <span className="flex items-center gap-1">
                        ⏱ {scheduledTask.baseDuration}분
                    </span>
                    <span>·</span>
                    <span className={`${scheduledTask.resistance === 'low' ? 'text-emerald-500' :
                            scheduledTask.resistance === 'medium' ? 'text-amber-500' :
                                'text-rose-500'
                        }`}>
                        {scheduledTask.resistance === 'low' ? '쉬움' : scheduledTask.resistance === 'medium' ? '보통' : '어려움'}
                    </span>
                </div>
            </div>

            {/* Edit Button (Optional, since whole card is clickable) */}
            <button
                onClick={() => onEdit(scheduledTask)}
                className="rounded-full p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            >
                ✏️
            </button>
        </Reorder.Item>
    );
}
