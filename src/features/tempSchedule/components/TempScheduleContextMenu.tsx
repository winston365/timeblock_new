import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import { TEMP_SCHEDULE_COLORS, type TempScheduleTask } from '@/shared/types/tempSchedule';

interface TempScheduleContextMenuProps {
    task: TempScheduleTask;
    x: number;
    y: number;
    onClose: () => void;
}

export function TempScheduleContextMenu({ task, x, y, onClose }: TempScheduleContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { duplicateTask, promoteToRealTask, deleteTask, updateTask } = useTempScheduleStore();

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // 화면 밖으로 나가는 것 방지
    const style = {
        top: y,
        left: x,
    };

    // 간단한 위치 조정 (화면 하단/우측 넘침 방지)
    if (typeof window !== 'undefined') {
        if (y + 200 > window.innerHeight) style.top = y - 200;
        if (x + 200 > window.innerWidth) style.left = x - 200;
    }

    const handleDuplicate = async () => {
        await duplicateTask(task);
        onClose();
    };

    const handlePromote = async () => {
        if (confirm(`'${task.name}' 스케줄을 실제 작업(Inbox)으로 변환하시겠습니까?`)) {
            await promoteToRealTask(task);
            onClose();
        }
    };

    const handleDelete = async () => {
        if (confirm(`'${task.name}' 스케줄을 삭제하시겠습니까?`)) {
            await deleteTask(task.id);
            onClose();
        }
    };

    const handleColorChange = async (color: string) => {
        await updateTask(task.id, { color });
        // 색상 변경 후 메뉴 닫지 않음 (연속 변경 가능)
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
            style={style}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] mb-1">
                    {task.name}
                </div>

                <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
                    onClick={handlePromote}
                >
                    <span>✨</span> 실제 작업으로 변환
                </button>

                <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
                    onClick={handleDuplicate}
                >
                    <span>📋</span> 복제하기
                </button>

                <div className="my-1 border-t border-[var(--color-border)]" />

                <div className="px-2 py-1">
                    <div className="mb-1 text-[10px] text-[var(--color-text-tertiary)]">색상 변경</div>
                    <div className="grid grid-cols-5 gap-1">
                        {TEMP_SCHEDULE_COLORS.map((color) => (
                            <button
                                key={color}
                                className={`h-4 w-4 rounded-full border border-white/10 transition-transform hover:scale-110 ${task.color === color ? 'ring-1 ring-[var(--color-text)] ring-offset-1' : ''
                                    }`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleColorChange(color)}
                            />
                        ))}
                    </div>
                </div>

                <div className="my-1 border-t border-[var(--color-border)]" />

                <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                    onClick={handleDelete}
                >
                    <span>🗑️</span> 삭제하기
                </button>
            </div>
        </div>,
        document.body
    );
}
