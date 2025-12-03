/**
 * @file GlobalTaskBreakdown.tsx
 * 
 * Role: 전역 AI 작업 세분화 컴포넌트 (TaskBreakdownModal 래퍼)
 * 
 * Responsibilities:
 * - TaskBreakdownModal을 앱 전역에서 렌더링
 * - AI 분석 시작 시 토스트 알림 표시
 * - 확인 시 작업을 timeBlock 유무에 따라 Schedule 또는 Inbox에 추가
 * - 준비된 작업에 대한 퀘스트 진행 업데이트
 * - 와이푸 격려 메시지 표시
 * 
 * Key Dependencies:
 * - useTaskBreakdownStore: 세분화 모달 상태
 * - useDailyData: 스케줄 작업 추가
 * - useInboxStore: 인박스 작업 추가
 * - useWaifuCompanionStore: 와이푸 메시지 표시
 */

import { useEffect } from 'react';
import { useTaskBreakdownStore } from './stores/breakdownStore';
import TaskBreakdownModal from './TaskBreakdownModal';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { useInboxStore } from '@/shared/stores/inboxStore';
import { useGameState } from '@/shared/hooks/useGameState';
import { generateId } from '@/shared/lib/utils';
import { Task } from '@/shared/types/domain';
import { useXPToastStore } from '@/shared/hooks/useXPToast';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

/**
 * 전역 AI 작업 세분화 컴포넌트
 * TaskBreakdownModal을 앱 전역에서 관리하며, 확인 시 작업을 적절한 위치에 추가합니다.
 * 
 * @returns {JSX.Element} TaskBreakdownModal 래퍼
 */
export default function GlobalTaskBreakdown() {
    const { isOpen, isLoading, breakdownText, close, source, taskData } = useTaskBreakdownStore();
    const { addTask } = useDailyData();
    const { addTask: addInboxTask } = useInboxStore(); // Use store action
    const { updateQuestProgress } = useGameState();
    const { addToast } = useXPToastStore();
    const { show: showWaifu } = useWaifuCompanionStore();

    /**
     * AI 분석 시작 시 토스트 표시
     */
    useEffect(() => {
        if (isLoading) {
            addToast(0, '🧠 AI가 작업을 분석 중입니다...');
        }
    }, [isLoading, addToast]);

    const handleConfirm = async (tasks: Task[]) => {
        if (!source || !taskData) return;

        try {
            // 1. Assign IDs and properties to new tasks
            const newTasks = tasks.map(t => ({
                ...t,
                id: generateId('task'),
                createdAt: new Date().toISOString(),
                // timeBlock은 TaskBreakdownModal에서 이미 사용자가 설정했으므로 그대로 유지
                // t.timeBlock을 덮어쓰지 않음
            }));

            // 2. Add tasks based on EACH task's timeBlock value
            // ✅ 각 작업의 timeBlock 값을 확인하여 올바른 위치에 추가
            for (const task of newTasks) {
                if (task.timeBlock) {
                    // timeBlock이 있으면 → Schedule에 추가
                    await addTask(task);
                } else {
                    // timeBlock이 null이면 → Inbox에 추가
                    await addInboxTask(task);
                }
            }

            // 3. Update Quest Progress (Prepare Tasks)
            // Check if any of the new tasks have preparations
            let preparedCount = 0;
            for (const task of newTasks) {
                if (task.preparation1 && task.preparation2 && task.preparation3) {
                    preparedCount++;
                }
            }
            if (preparedCount > 0) {
                await updateQuestProgress('prepare_tasks', preparedCount);
            }

            // 4. Show waifu encouragement message
            showWaifu('큰 작업도 작게 나누면 할 수 있어요! 화이팅! 💪', {
                expression: {
                    imagePath: '/assets/waifu/poses/loving/hyeeun_happy.webp',
                    durationMs: 3000
                }
            });

            // 5. Close modal
            close();
        } catch (error) {
            console.error('Failed to apply breakdown tasks:', error);
            // Optionally show error toast
        }
    };

    return (
        <TaskBreakdownModal
            isOpen={isOpen}
            onClose={close}
            onConfirm={handleConfirm}
            initialText={breakdownText}
        />
    );
}
