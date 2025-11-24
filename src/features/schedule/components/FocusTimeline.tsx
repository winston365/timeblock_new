import { Reorder, useDragControls } from 'framer-motion';
import type { Task } from '@/shared/types/domain';

interface FocusTimelineProps {
    tasks: Task[];
    onReorder: (newOrder: Task[]) => void;
    onEdit: (task: Task) => void;
}

export function FocusTimeline({ tasks, onReorder, onEdit }: FocusTimelineProps) {
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

function TimelineItem({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={task}
            dragListener={false}
            dragControls={controls}
            className="relative flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm transition-all hover:border-[var(--color-primary)] hover:shadow-md"
        >
            {/* Drag Handle */}
            <div
                className="cursor-grab touch-none p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
                onPointerDown={(e) => controls.start(e)}
            >
                ⋮⋮
            </div>

            {/* Content */}
            <div className="flex-1 cursor-pointer" onClick={() => onEdit(task)}>
                <div className="font-medium text-[var(--color-text-primary)]">{task.text}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <span className="flex items-center gap-1">
                        ⏱ {task.baseDuration}분
                    </span>
                    <span>·</span>
                    <span className={`${task.resistance === 'low' ? 'text-emerald-500' :
                            task.resistance === 'medium' ? 'text-amber-500' :
                                'text-rose-500'
                        }`}>
                        {task.resistance === 'low' ? '쉬움' : task.resistance === 'medium' ? '보통' : '어려움'}
                    </span>
                </div>
            </div>

            {/* Edit Button (Optional, since whole card is clickable) */}
            <button
                onClick={() => onEdit(task)}
                className="rounded-full p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            >
                ✏️
            </button>
        </Reorder.Item>
    );
}
