/**
 * @file InboxTab.tsx
 * 
 * Role: 시간 블록에 배치되지 않은 작업들을 관리하는 인박스 탭 컴포넌트
 * 
 * Responsibilities:
 * - 인박스 작업 목록 표시 (전체/최근/난이도별 필터링)
 * - 인라인 빠른 추가 및 모달을 통한 작업 추가/편집/삭제
 * - 타임블록에서 드래그앤드롭으로 작업을 인박스로 이동
 * - 퀘스트 진행 (prepare_tasks) 업데이트
 * - Triage 모드 (키보드 중심 루프)
 * - 정리 진행도 미니 HUD
 * - Today/Tomorrow/NextSlot 원탭 배치
 * 
 * Key Dependencies:
 * - useInboxStore: 인박스 작업 CRUD 및 상태 관리
 * - useInboxHotkeys: 키보드 단축키 처리
 * - TaskCard: 개별 작업 카드 UI
 * - TaskModal: 작업 추가/편집 모달
 * - useDragDropManager: 드래그앤드롭 데이터 관리
 * - slotFinder: 빠른 배치 슬롯 계산
 * - notify: 토스트 알림
 */

import TaskModal from '@/features/schedule/TaskModal';
import { InboxHeader } from '@/features/tasks/components/inbox/InboxHeader';
import { InboxList } from '@/features/tasks/components/inbox/InboxList';
import { useInboxController } from '@/features/tasks/hooks/useInboxController';
import { useInboxDragDrop } from '@/features/tasks/hooks/useInboxDragDrop';

/**
 * 인박스 탭 컴포넌트
 *
 * @returns {JSX.Element} 인박스 탭 UI
 * @sideEffects
 *   - 작업 추가/수정/삭제 시 Firebase 동기화
 *   - 드래그앤드롭으로 작업을 인박스로 이동 가능
 */
export default function InboxTab() {
  const controller = useInboxController();
  const dragDrop = useInboxDragDrop({ onMoveTaskToInbox: controller.moveTaskToInbox });

  if (controller.loading && controller.inboxTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6 text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-base)]">
      <InboxHeader taskCount={controller.inboxTasks.length} onAddTask={controller.handleAddTask} />

      <InboxList controller={controller} dragDrop={dragDrop} />

      {controller.isModalOpen && (
        <TaskModal
          task={controller.editingTask}
          initialBlockId={null} // Inbox tasks don't have a specific block initially
          onSave={controller.handleSaveTask}
          onSaveMultiple={controller.handleSaveMultipleTasks}
          onClose={controller.handleCloseModal}
          source="inbox"
        />
      )}
    </div>
  );
}
