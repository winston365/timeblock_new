/**
 * GlobalModals - 전역 모달 컴포넌트
 *
 * @role 애플리케이션 전역에서 사용되는 모달 컴포넌트들을 관리
 * @input 없음 (uiStore에서 모달 상태 관리)
 * @output 모달 컴포넌트들 (Gemini채팅, 대량추가, 설정, 템플릿 등)
 * @dependencies uiStore, dailyDataStore, GeminiFullscreenChat, BulkAddModal, SettingsModal, TemplatesModal
 */

import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameState } from '@/shared/hooks';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import type { Template, Task } from '@/shared/types/domain';
import { toast } from 'react-hot-toast';

import GeminiFullscreenChat from '@/features/gemini/GeminiFullscreenChat';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import TemplatesModal from '@/features/template/TemplatesModal';
import { RealityCheckModal } from '@/features/feedback/RealityCheckModal';
import { MemoMissionModal } from '@/shared/components/MemoMissionModal';

/**
 * 전역 모달 컴포넌트
 * F1 단축키로 대량 할 일 추가 모달을 열 수 있음
 * @returns 애플리케이션 전역 모달 컴포넌트
 */
export default function GlobalModals() {
    const { modals, closeModal, openModal } = useUIStore();
    const { updateQuestProgress } = useGameState();

    // F1 단축키: 대량 할 일 추가 모달 열기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') {
                e.preventDefault();
                openModal('bulkAdd');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [openModal]);

    // 템플릿에서 작업 생성 핸들러
    const handleTaskCreateFromTemplate = async (template: Template) => {
        try {
            const task = createTaskFromTemplate(template);
            const dailyDataStore = useDailyDataStore.getState();
            await dailyDataStore.addTask(task);

            // 준비된 작업이면 퀘스트 진행
            const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
            if (isPrepared) {
                await updateQuestProgress('prepare_tasks', 1);
            }

            toast.success(`"${template.name}" 템플릿에서 작업이 추가되었습니다!`);
        } catch (error) {
            console.error('Failed to create task from template:', error);
            toast.error('작업 추가에 실패했습니다.');
        }
    };

    // 대량 작업 추가 핸들러
    const handleBulkAddTasks = async (tasks: Task[]) => {
        try {
            const dailyDataStore = useDailyDataStore.getState();
            for (const task of tasks) {
                await dailyDataStore.addTask(task);
            }
        } catch (error) {
            console.error('Failed to add tasks:', error);
            throw error;
        }
    };

    return (
        <>
            <GeminiFullscreenChat
                isOpen={modals.geminiChat}
                onClose={() => closeModal('geminiChat')}
            />
            <BulkAddModal
                isOpen={modals.bulkAdd}
                onClose={() => closeModal('bulkAdd')}
                onAddTasks={handleBulkAddTasks}
            />
            <SettingsModal
                isOpen={modals.settings}
                onClose={() => closeModal('settings')}
            />
            <TemplatesModal
                isOpen={modals.templates}
                onClose={() => closeModal('templates')}
                onTaskCreate={handleTaskCreateFromTemplate}
            />
            <RealityCheckModal />
            <MemoMissionModal />
        </>
    );
}
