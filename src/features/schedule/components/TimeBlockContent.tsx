/**
 * @file TimeBlockContent.tsx
 * @role 타임 블록 확장 콘텐츠 컴포넌트
 * @responsibilities
 *   - 시간대별 HourBar 렌더링
 *   - 작업 CRUD 이벤트 위임
 *   - DontDoChecklist 통합
 * @dependencies
 *   - HourBar: 시간 슬롯 컴포넌트
 *   - DontDoChecklist: 금지 항목 체크리스트
 */
import React from 'react';
import type { Task, TimeBlockState, TimeBlockId, TimeSlotTagTemplate } from '@/shared/types/domain';
import HourBar from '../HourBar';
import { DontDoChecklist } from './DontDoChecklist';

/**
 * TimeBlockContent 컴포넌트 Props
 * @param isExpanded - 확장 상태 여부
 * @param block - 블록 정보 (id, start, end)
 * @param tasks - 블록 내 작업 목록
 * @param isPastBlock - 지난 블록 여부
 * @param state - 블록 상태
 * @param onToggleExpand - 확장 토글 핸들러
 * @param onCreateTask - 작업 생성 핸들러
 * @param onEditTask - 작업 수정 핸들러
 * @param onUpdateTask - 작업 업데이트 핸들러
 * @param onDeleteTask - 작업 삭제 핸들러
 * @param onToggleTask - 작업 완료 토글 핸들러
 * @param hourSlotTags - 시간대별 태그 매핑
 * @param tagTemplates - 태그 템플릿 목록
 * @param recentTagIds - 최근 사용 태그 ID 목록
 * @param onSelectHourTag - 시간대 태그 선택 핸들러
 */
interface TimeBlockContentProps {
    isExpanded: boolean;
    block: {
        id: string;
        start: number;
        end: number;
    };
    tasks: Task[];
    isPastBlock: boolean;
    state: TimeBlockState;
    onToggleExpand: () => void;
    onCreateTask?: (text: string, blockId: TimeBlockId, hourSlot?: number) => Promise<void>;
    onEditTask: (task: Task) => void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
    onDeleteTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    hourSlotTags?: Record<number, string | null>;
    tagTemplates?: TimeSlotTagTemplate[];
    recentTagIds?: string[];
    onSelectHourTag?: (hour: number, tagId: string | null) => void;
}

/**
 * 타임 블록 확장 콘텐츠 컴포넌트
 * @param props - TimeBlockContentProps
 * @returns 확장된 블록 콘텐츠 UI 또는 null
 */
export const TimeBlockContent: React.FC<TimeBlockContentProps> = ({
    isExpanded,
    block,
    tasks,
    state,
    onToggleExpand,
    onCreateTask,
    onEditTask,
    onUpdateTask,
    onDeleteTask,
    onToggleTask,
    hourSlotTags = {},
    tagTemplates = [],
    recentTagIds = [],
    onSelectHourTag,
}) => {

    if (!isExpanded) return null;

    const handleBlockContentClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onToggleExpand();
        }
    };

    return (
        <div className="flex flex-col gap-0 bg-[var(--color-bg-base)]/50 rounded-b-2xl" onClick={handleBlockContentClick}>
            <DontDoChecklist timeBlockId={block.id} />

            {Array.from({ length: block.end - block.start }, (_, hourOffset) => block.start + hourOffset).map(hour => {
                const hourTasks = tasks.filter(task => task.hourSlot === hour);

                return (
                    <HourBar
                        key={hour}
                        hour={hour}
                        blockId={block.id as TimeBlockId}
                        tasks={hourTasks}
                        isLocked={state?.isLocked || false}
                        tagId={hourSlotTags?.[hour] || null}
                        tagTemplates={tagTemplates}
                        recentTagIds={recentTagIds}
                        onSelectTag={(tagId) => onSelectHourTag?.(hour, tagId)}
                        onCreateTask={async (text, targetHour) => {
                            if (onCreateTask) {
                                await onCreateTask(text, block.id as TimeBlockId, targetHour);
                            }
                        }}
                        onEditTask={onEditTask}
                        onUpdateTask={onUpdateTask || (() => { })}
                        onDeleteTask={onDeleteTask}
                        onToggleTask={onToggleTask}
                        onDropTask={(taskId, targetHour) => {
                            if (onUpdateTask) {
                                onUpdateTask(taskId, { hourSlot: targetHour, timeBlock: block.id as TimeBlockId });
                            }
                        }}
                    />
                );
            })}
        </div>
    );
};
