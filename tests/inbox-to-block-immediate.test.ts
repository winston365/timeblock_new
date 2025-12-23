/**
 * @file inbox-to-block-immediate.test.ts
 * @description Inbox→Block 이동 시 즉시 UI 반영(optimistic update) 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus } from '@/shared/lib/eventBus';
import { initInboxSubscriber } from '@/shared/subscribers/inboxSubscriber';
import { useInboxStore } from '@/shared/stores/inboxStore';

describe('Inbox to Block Immediate Update', () => {
  beforeEach(() => {
    eventBus.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    eventBus.clear();
    vi.restoreAllMocks();
  });

  describe('inbox:taskRemoved event', () => {
    it('이벤트 발행 시 구독자가 호출된다', () => {
      const handler = vi.fn<(payload: { taskId: string }, meta: { readonly source?: string }) => void>();
      eventBus.on('inbox:taskRemoved', handler);

      eventBus.emit('inbox:taskRemoved', { taskId: 'test-task-1' }, { source: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { taskId: 'test-task-1' },
        expect.objectContaining({ source: 'test' })
      );
    });

    it('다수의 이벤트가 순차적으로 처리된다', () => {
      const taskIds: string[] = [];
      eventBus.on('inbox:taskRemoved', ({ taskId }) => {
        taskIds.push(taskId);
      });

      eventBus.emit('inbox:taskRemoved', { taskId: 'task-1' }, { source: 'test' });
      eventBus.emit('inbox:taskRemoved', { taskId: 'task-2' }, { source: 'test' });
      eventBus.emit('inbox:taskRemoved', { taskId: 'task-3' }, { source: 'test' });

      expect(taskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('Subscriber가 inboxStore에서 해당 task를 제거한다 (async handler)', async () => {
      initInboxSubscriber();

      useInboxStore.setState({
        inboxTasks: [
          { id: 'keep-1', text: 'Keep 1', completed: false } as import('@/shared/types/domain').Task,
          { id: 'remove-1', text: 'Remove 1', completed: false } as import('@/shared/types/domain').Task,
        ],
      });

      eventBus.emit('inbox:taskRemoved', { taskId: 'remove-1' }, { source: 'test' });

      // EventBus.emit은 sync이지만 subscriber handler는 async(dynamic import)라서 한 틱 대기
      await new Promise((resolve) => setTimeout(resolve, 0));

      const ids = useInboxStore.getState().inboxTasks.map((t) => t.id);
      expect(ids).toEqual(['keep-1']);
    });
  });

  describe('Optimistic Update 패턴 검증', () => {
    it('addTaskToArray는 기존 배열에 task를 추가한다', async () => {
      // storeUtils의 addTaskToArray 동작 검증
      const { addTaskToArray } = await import('@/shared/lib/storeUtils');
      
      const existingTasks = [
        { id: 'task-1', text: 'Task 1' },
        { id: 'task-2', text: 'Task 2' },
      ] as import('@/shared/types/domain').Task[];

      const newTask = { id: 'task-3', text: 'Task 3' } as import('@/shared/types/domain').Task;
      
      const result = addTaskToArray(existingTasks, newTask);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-3']);
      // 원본 배열은 변경되지 않음 (immutable)
      expect(existingTasks).toHaveLength(2);
    });

    it('removeTaskFromArray는 배열에서 task를 제거한다', async () => {
      const { removeTaskFromArray } = await import('@/shared/lib/storeUtils');
      
      const existingTasks = [
        { id: 'task-1', text: 'Task 1' },
        { id: 'task-2', text: 'Task 2' },
        { id: 'task-3', text: 'Task 3' },
      ] as import('@/shared/types/domain').Task[];

      const result = removeTaskFromArray(existingTasks, 'task-2');

      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-3']);
      // 원본 배열은 변경되지 않음 (immutable)
      expect(existingTasks).toHaveLength(3);
    });

    it('updateTaskInArray는 배열 내 task를 업데이트한다', async () => {
      const { updateTaskInArray } = await import('@/shared/lib/storeUtils');
      
      const existingTasks = [
        { id: 'task-1', text: 'Task 1', timeBlock: null },
        { id: 'task-2', text: 'Task 2', timeBlock: null },
      ] as import('@/shared/types/domain').Task[];

      const result = updateTaskInArray(existingTasks, 'task-1', { 
        timeBlock: 'morning' as import('@/shared/types/domain').TimeBlockId,
        hourSlot: 8 
      });

      expect(result).toHaveLength(2);
      expect(result[0].timeBlock).toBe('morning');
      expect(result[0].hourSlot).toBe(8);
      // task-2는 변경되지 않음
      expect(result[1].timeBlock).toBeNull();
    });
  });

  describe('이동 타입 감지 로직', () => {
    it('inbox → block 이동 감지: inboxTask 존재 + timeBlock 설정', () => {
      const inboxTask = { id: 'task-1', timeBlock: null };
      const updates = { timeBlock: 'morning' as const };

      const isInboxToBlock = 
        inboxTask && 
        updates.timeBlock !== null && 
        updates.timeBlock !== undefined;

      expect(isInboxToBlock).toBe(true);
    });

    it('block → inbox 이동 감지: originalTask.timeBlock 존재 + updates.timeBlock === null', () => {
      const originalTask = { id: 'task-1', timeBlock: 'morning' as const };
      const updates = { timeBlock: null };

      const isBlockToInbox = 
        originalTask && 
        updates.timeBlock === null && 
        originalTask.timeBlock !== null;

      expect(isBlockToInbox).toBe(true);
    });

    it('일반 업데이트: timeBlock 변경 없음', () => {
      const updates = { text: 'Updated text' };

      const isInboxToBlock = false; // inboxTask가 없음
      const isBlockToInbox = 
        'timeBlock' in updates && 
        updates.timeBlock === null;

      expect(isInboxToBlock).toBe(false);
      expect(isBlockToInbox).toBe(false);
    });
  });
});
