/**
 * @file useIgnitionPool.ts
 * @role 점화 스피너용 작업 풀 생성 및 가중치 계산 훅
 * @input dailyData, inboxTasks
 * @output weightedPool(가중치 적용된 작업 풀), totalWeight, sortedTasks
 * @dependencies useDailyData, inboxRepository
 */

import { useMemo, useEffect, useState } from 'react';
import { useDailyData } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { Task } from '@/shared/types/domain';

// ============================================================================
// Types
// ============================================================================

export interface WeightedTask extends Task {
  weight: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  isTicket?: boolean;
  ticketType?: string;
  color?: string;
}

export interface IgnitionPoolResult {
  weightedPool: WeightedTask[];
  totalWeight: number;
  sortedTasks: WeightedTask[];
  poolComputedAt: Date | null;
  refreshPool: () => void;
}

// ============================================================================
// Constants
// ============================================================================

// 휴식권/꽝/더미는 실제 Task가 아니므로 Partial<Task>와 확장 속성으로 정의
const REST_TICKETS: WeightedTask[] = [
  {
    id: 'ticket_30',
    text: '☕ 30분 휴식권',
    resistance: 'low',
    isTicket: true,
    ticketType: 'rest_ticket_30',
    weight: 20,
    rarity: 'common',
    completed: false,
    baseDuration: 0,
    adjustedDuration: 0,
    actualDuration: 0,
    memo: '',
    timeBlock: null,
    createdAt: '',
    completedAt: null,
  },
  {
    id: 'ticket_60',
    text: '🛌 1시간 휴식권',
    resistance: 'low',
    isTicket: true,
    ticketType: 'rest_ticket_60',
    weight: 10,
    rarity: 'rare',
    completed: false,
    baseDuration: 0,
    adjustedDuration: 0,
    actualDuration: 0,
    memo: '',
    timeBlock: null,
    createdAt: '',
    completedAt: null,
  },
  {
    id: 'ticket_120',
    text: '🌴 2시간 휴식권',
    resistance: 'low',
    isTicket: true,
    ticketType: 'rest_ticket_120',
    weight: 5,
    rarity: 'epic',
    completed: false,
    baseDuration: 0,
    adjustedDuration: 0,
    actualDuration: 0,
    memo: '',
    timeBlock: null,
    createdAt: '',
    completedAt: null,
  },
];

const BOOM_ITEM: Omit<WeightedTask, 'weight'> = {
  id: 'boom',
  text: '💣 꽝',
  resistance: 'high',
  rarity: 'common',
  color: '#ef4444',
  completed: false,
  baseDuration: 0,
  adjustedDuration: 0,
  actualDuration: 0,
  memo: '',
  timeBlock: null,
  createdAt: '',
  completedAt: null,
};

const DUMMY_TASK: WeightedTask = {
  id: 'dummy',
  text: '인박스 정리하기',
  resistance: 'low',
  weight: 1,
  completed: false,
  baseDuration: 15,
  adjustedDuration: 15,
  actualDuration: 0,
  memo: '',
  timeBlock: null,
  createdAt: '',
  completedAt: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 현재 시간 기준 타임블록 ID 반환
 */
function getCurrentBlockId(): string | undefined {
  const currentHour = new Date().getHours();
  const currentBlock = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);
  return currentBlock?.id;
}

/**
 * 작업에 가중치 부여
 * - 현재 블록: 1.5배
 * - 미래 블록: 1.3배
 * - 기본: 1.0배
 */
function calculateTaskWeight(task: Task, currentBlockId: string | undefined): number {
  let weight = 1.0;

  if (task.timeBlock) {
    if (task.timeBlock === currentBlockId) {
      weight = 1.5; // 현재 블록
    } else {
      const currentHour = new Date().getHours();
      const taskBlock = TIME_BLOCKS.find(b => b.id === task.timeBlock);
      if (taskBlock && taskBlock.start > currentHour) {
        weight = 1.3; // 미래 블록
      }
    }
  }

  // 기본 가중치 10배 (숫자 정리용)
  return weight * 10;
}

/**
 * 작업 목록에서 가중치 풀 생성
 */
export function buildWeightedPool(
  dailyTasks: Task[],
  inboxTasks: Task[]
): WeightedTask[] {
  const currentBlockId = getCurrentBlockId();
  
  // 1. 모든 미완료 작업 필터링
  const allTasks = [...dailyTasks, ...inboxTasks];
  const incompleteTasks = allTasks.filter(t => !t.completed);

  // 2. 가중치 계산
  const tasksWithWeights: WeightedTask[] = incompleteTasks.map(task => ({
    ...task,
    weight: calculateTaskWeight(task, currentBlockId),
    rarity: undefined,
  }));

  // 3. 휴식권 추가
  const restTotalWeight = REST_TICKETS.reduce((sum, t) => sum + t.weight, 0);
  let pool: WeightedTask[] = [...tasksWithWeights, ...REST_TICKETS];

  // 4. 보상 확률 30% 상한 조정 (꽝 추가)
  const taskTotalWeight = tasksWithWeights.reduce((sum, t) => sum + t.weight, 0);
  const currentTotal = taskTotalWeight + restTotalWeight;
  const maxRewardProb = 0.3;

  if (currentTotal > 0 && (restTotalWeight / currentTotal) >= maxRewardProb) {
    const requiredTotal = restTotalWeight / 0.25;
    const boomWeight = Math.max(0, requiredTotal - currentTotal);

    if (boomWeight > 0) {
      pool.push({
        ...BOOM_ITEM,
        weight: boomWeight,
      } as WeightedTask);
    }
  }

  // 5. 작업이 없으면 더미 작업 반환
  if (pool.length === 0) {
    return [DUMMY_TASK];
  }

  return pool;
}

// ============================================================================
// Hook
// ============================================================================

export function useIgnitionPool(isOpen: boolean): IgnitionPoolResult {
  const { dailyData } = useDailyData();
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [poolComputedAt, setPoolComputedAt] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 인박스 로드
  useEffect(() => {
    if (isOpen) {
      import('@/data/repositories/inboxRepository').then(({ loadInboxTasks }) => {
        loadInboxTasks().then(setInboxTasks);
      });
    }
  }, [isOpen, refreshTrigger]);

  // 풀 계산
  const weightedPool = useMemo(() => {
    if (!isOpen) return [];
    
    const pool = buildWeightedPool(dailyData?.tasks || [], inboxTasks);
    setPoolComputedAt(new Date());
    return pool;
  }, [isOpen, dailyData, inboxTasks, refreshTrigger]);

  // 총 가중치
  const totalWeight = useMemo(() => 
    weightedPool.reduce((sum, t) => sum + (t.weight || 0), 0),
    [weightedPool]
  );

  // 정렬된 작업 목록 (확률 높은 순)
  const sortedTasks = useMemo(() => 
    [...weightedPool].sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    [weightedPool]
  );

  // 풀 새로고침
  const refreshPool = () => setRefreshTrigger(prev => prev + 1);

  return {
    weightedPool,
    totalWeight,
    sortedTasks,
    poolComputedAt,
    refreshPool,
  };
}
