/**
 * procrastinationMonitor
 *
 * @role Detect repeated task deferrals (drag/drop shuffling, inbox churn) and trigger Hye-eun interventions.
 * @input Task move metadata (previous/next block, date)
 * @output Waifu companion interventions + persisted counters in systemState
 * @external_dependencies
 *   - systemRepository: persisted state (Dexie)
 *   - waifuCompanionStore: surface interventions + expression overrides
 */

import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { getLocalDate } from '@/shared/lib/utils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import type { TimeBlockId } from '@/shared/types/domain';

interface TaskProcrastinationStats {
  moveCount: number;
  moveNotified: boolean;
  enteredFromInbox: boolean;
  inboxNotified: boolean;
  lastBlockId: TimeBlockId | null;
}

interface ProcrastinationState {
  date: string;
  tasks: Record<string, TaskProcrastinationStats>;
}

type ProcrastinationReason = 'block_shuffling' | 'inbox_churn';

const DEFAULT_STATE: ProcrastinationState = {
  date: getLocalDate(),
  tasks: {},
};

const MESSAGE = '이 작업 벌써 3번째 옮기고 있네? 솔직히 말해봐, 하기 싫지?';
const EXPRESSION_DURATION = 8000;
const EXPRESSION_PATHS = [
  'assets/waifu/poses/hyeeun_worried.png',
  'assets/waifu/poses/hyeeun_suspicious.png',
] as const;

async function loadState(currentDate: string): Promise<ProcrastinationState> {
  const stored = await getSystemState<ProcrastinationState>(SYSTEM_KEYS.PROCRASTINATION_MONITOR);
  if (!stored || stored.date !== currentDate) {
    return {
      ...DEFAULT_STATE,
      date: currentDate,
      tasks: {},
    };
  }
  return stored;
}

async function saveState(state: ProcrastinationState): Promise<void> {
  await setSystemState(SYSTEM_KEYS.PROCRASTINATION_MONITOR, state);
}

function getTaskState(state: ProcrastinationState, taskId: string): TaskProcrastinationStats {
  if (!state.tasks[taskId]) {
    state.tasks[taskId] = {
      moveCount: 0,
      moveNotified: false,
      enteredFromInbox: false,
      inboxNotified: false,
      lastBlockId: null,
    };
  }
  return state.tasks[taskId];
}

function triggerIntervention(): void {
  const waifuStore = useWaifuCompanionStore.getState();
  const expressionPath =
    EXPRESSION_PATHS[Math.floor(Math.random() * EXPRESSION_PATHS.length)];

  waifuStore.show(MESSAGE, {
    expression: {
      imagePath: expressionPath,
      durationMs: EXPRESSION_DURATION,
    },
  });
}

/**
 * 작업의 타임블록 변경을 추적하여 미루기 패턴을 감지합니다.
 * 
 * 반복적인 블록 이동(3회 이상) 또는 inbox 왕복을 감지하면
 * Waifu 개입을 트리거합니다.
 *
 * @param {Object} params - 추적 파라미터
 * @param {string} params.taskId - 대상 작업 ID
 * @param {TimeBlockId | null | undefined} params.previousBlock - 이전 블록 (inbox에서 이동 시 null)
 * @param {TimeBlockId | null | undefined} params.nextBlock - 목적지 블록 (inbox로 이동 시 null)
 * @param {string} [params.currentDate] - 날짜 문자열 (YYYY-MM-DD), 기본값은 오늘
 * @returns {Promise<void>}
 */
export async function trackTaskTimeBlockChange(params: {
  taskId: string;
  previousBlock: TimeBlockId | null | undefined;
  nextBlock: TimeBlockId | null | undefined;
  currentDate?: string;
}): Promise<void> {
  const { taskId, currentDate = getLocalDate() } = params;
  const prevBlock = params.previousBlock ?? null;
  const nextBlock = params.nextBlock ?? null;

  if (prevBlock === nextBlock) {
    return;
  }

  try {
    const state = await loadState(currentDate);
    const taskState = getTaskState(state, taskId);
    let reason: ProcrastinationReason | null = null;
    let changed = false;

    // Dragging between two different time blocks counts towards shuffling tally.
    if (prevBlock && nextBlock && prevBlock !== nextBlock) {
      taskState.moveCount += 1;
      taskState.lastBlockId = nextBlock;
      changed = true;

      if (!taskState.moveNotified && taskState.moveCount >= 3) {
        taskState.moveNotified = true;
        reason = 'block_shuffling';
      }
    }

    // Track inbox -> block so we can detect returning back to inbox later.
    if (prevBlock === null && nextBlock) {
      taskState.enteredFromInbox = true;
      taskState.lastBlockId = nextBlock;
      changed = true;
    }

    if (prevBlock && nextBlock === null) {
      if (taskState.enteredFromInbox && !taskState.inboxNotified) {
        taskState.inboxNotified = true;
        taskState.enteredFromInbox = false;
        reason = reason ?? 'inbox_churn';
      } else {
        taskState.enteredFromInbox = false;
      }
      taskState.lastBlockId = null;
      changed = true;
    }

    if (!changed) {
      return;
    }

    await saveState(state);

    if (reason) {
      triggerIntervention();
    }
  } catch (error) {
    console.error('[procrastinationMonitor] Failed to track task move:', error);
  }
}
