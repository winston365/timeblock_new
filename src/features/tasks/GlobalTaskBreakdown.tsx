import { useEffect } from 'react';
import { useTaskBreakdownStore } from './stores/breakdownStore';
import TaskBreakdownModal from './TaskBreakdownModal';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { addInboxTask } from '@/data/repositories/inboxRepository';
import { useGameState } from '@/shared/hooks/useGameState';
import { generateId } from '@/shared/lib/utils';
import { Task } from '@/shared/types/domain';
import { useXPToastStore } from '@/shared/hooks/useXPToast';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

export default function GlobalTaskBreakdown() {
    const { isOpen, isLoading, breakdownText, close, source, taskData } = useTaskBreakdownStore();
    const { addTask } = useDailyData();
    const { updateQuestProgress } = useGameState();
    const { addToast } = useXPToastStore();
    const { show: showWaifu } = useWaifuCompanionStore();

    // Show toast when AI starts analyzing
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

            // 2. Add tasks based on source
            if (source === 'schedule') {
                // Add to schedule
                // We iterate and add each task. 
                // Note: addTask in useDailyData might trigger state updates.
                for (const task of newTasks) {
                    await addTask(task);
                }
            } else {
                // Add to inbox
                for (const task of newTasks) {
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
                    imagePath: '/waifu/expressions/happy.png',
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
