/**
 * Quest Operations
 *
 * @fileoverview 일일 퀘스트 관리 순수 함수 모음
 *
 * @role 일일 퀘스트 관리 (생성, 진행, 완료)
 * @responsibilities
 *   - 일일 퀘스트 동적 생성 (generateDailyQuests)
 *   - 퀘스트 유효성 검증 및 누락 퀘스트 보완 (validateAndCompleteQuests)
 *   - 퀘스트 진행도 업데이트 및 완료 판정 (incrementQuestProgress)
 *
 * @dependencies
 *   - @/shared/utils/gamification: generateQuestTarget, calculateQuestReward
 */

import type { Quest } from '@/shared/types/domain';
import { generateQuestTarget, calculateQuestReward } from '@/shared/utils/gamification';

/**
 * 일일 퀘스트 생성 (동적 난이도)
 *
 * @description 난이도에 따라 동적으로 목표값과 보상을 계산하여 일일 퀘스트 배열 생성
 * @returns {Quest[]} 생성된 일일 퀘스트 배열
 */
export function generateDailyQuests(): Quest[] {
  // 동적으로 목표값 생성
  const completeTasksTarget = generateQuestTarget('complete_tasks');
  const earnXPTarget = generateQuestTarget('earn_xp');
  const lockBlocksTarget = generateQuestTarget('lock_blocks');
  const perfectBlocksTarget = generateQuestTarget('perfect_blocks');
  const prepareTasksTarget = 3; // 준비된 할일 목표: 3개
  const useTimerTarget = 5; // 타이머 사용 목표: 5개

  // 각 퀘스트의 보상 계산
  const completeTasksReward = calculateQuestReward('complete_tasks');
  const earnXPReward = calculateQuestReward('earn_xp');
  const lockBlocksReward = calculateQuestReward('lock_blocks');
  const perfectBlocksReward = calculateQuestReward('perfect_blocks');
  const prepareTasksReward = 150; // 준비된 할일은 고정 보상
  const useTimerReward = 100; // 타이머 사용은 고정 보상

  return [
    {
      id: `quest-complete-${completeTasksTarget}`,
      type: 'complete_tasks',
      title: `작업 ${completeTasksTarget}개 완료하기`,
      description: `오늘 작업을 ${completeTasksTarget}개 완료하세요`,
      target: completeTasksTarget,
      progress: 0,
      completed: false,
      reward: completeTasksReward,
    },
    {
      id: `quest-earn-${earnXPTarget}xp`,
      type: 'earn_xp',
      title: `${earnXPTarget} XP 획득하기`,
      description: `오늘 ${earnXPTarget} XP를 획득하세요`,
      target: earnXPTarget,
      progress: 0,
      completed: false,
      reward: earnXPReward,
    },
    {
      id: `quest-lock-${lockBlocksTarget}-blocks`,
      type: 'lock_blocks',
      title: `블록 ${lockBlocksTarget}개 잠그기`,
      description: `타임블록을 ${lockBlocksTarget}개 잠그세요`,
      target: lockBlocksTarget,
      progress: 0,
      completed: false,
      reward: lockBlocksReward,
    },
    {
      id: `quest-perfect-${perfectBlocksTarget}-block`,
      type: 'perfect_blocks',
      title: `완벽한 블록 ${perfectBlocksTarget}개 달성`,
      description: `블록을 ${perfectBlocksTarget}개 완벽하게 완료하세요`,
      target: perfectBlocksTarget,
      progress: 0,
      completed: false,
      reward: perfectBlocksReward,
    },
    {
      id: `quest-prepare-${prepareTasksTarget}-tasks`,
      type: 'prepare_tasks',
      title: `⭐ 준비된 할일 ${prepareTasksTarget}개 만들기`,
      description: `방해물과 대처법을 모두 입력한 할일을 ${prepareTasksTarget}개 만드세요`,
      target: prepareTasksTarget,
      progress: 0,
      completed: false,
      reward: prepareTasksReward,
    },
    {
      id: `quest-timer-${useTimerTarget}-tasks`,
      type: 'use_timer',
      title: `⏱️ 타이머 ${useTimerTarget}회 사용하기`,
      description: `타이머를 사용하여 ${useTimerTarget}개의 작업을 완료하세요`,
      target: useTimerTarget,
      progress: 0,
      completed: false,
      reward: useTimerReward,
    },
  ];
}

/**
 * 퀘스트 목록 유효성 검증 및 보완
 *
 * @param {Quest[]} quests - 기존 퀘스트 배열
 * @returns {{ quests: Quest[], updated: boolean }} 보완된 퀘스트 배열 및 변경 여부
 */
export function validateAndCompleteQuests(quests: Quest[]): { quests: Quest[]; updated: boolean } {
  let updated = false;
  const result = [...quests];

  // 준비된 할일 퀘스트가 없으면 추가
  const hasPrepareTasksQuest = result.some(q => q.type === 'prepare_tasks');
  if (!hasPrepareTasksQuest) {
    const prepareTasksTarget = 10;
    const prepareTasksReward = 150;
    result.push({
      id: `quest-prepare-${prepareTasksTarget}-tasks`,
      type: 'prepare_tasks',
      title: `⭐ 준비된 할일 ${prepareTasksTarget}개 만들기`,
      description: `방해물과 대처법을 모두 입력한 할일을 ${prepareTasksTarget}개 만드세요`,
      target: prepareTasksTarget,
      progress: 0,
      completed: false,
      reward: prepareTasksReward,
    });
    updated = true;
  }

  // 타이머 퀘스트가 없으면 추가
  const hasUseTimerQuest = result.some(q => q.type === 'use_timer');
  if (!hasUseTimerQuest) {
    const useTimerTarget = 5;
    const useTimerReward = 100;
    result.push({
      id: `quest-timer-${useTimerTarget}-tasks`,
      type: 'use_timer',
      title: `⏱️ 타이머 ${useTimerTarget}회 사용하기`,
      description: `타이머를 사용하여 ${useTimerTarget}개의 작업을 완료하세요`,
      target: useTimerTarget,
      progress: 0,
      completed: false,
      reward: useTimerReward,
    });
    updated = true;
  }

  return { quests: result, updated };
}

/**
 * 퀘스트 진행도 증가
 *
 * @param {Quest[]} quests - 퀘스트 배열
 * @param {Quest['type']} questType - 퀘스트 타입
 * @param {number} amount - 증가량
 * @returns {{ quests: Quest[], completedQuests: Quest[] }} 업데이트된 퀘스트 배열 및 완료된 퀘스트 목록
 */
export function incrementQuestProgress(
  quests: Quest[],
  questType: Quest['type'],
  amount: number = 1
): { quests: Quest[]; completedQuests: Quest[] } {
  const completedQuests: Quest[] = [];

  const updatedQuests = quests.map(quest => {
    if (quest.type !== questType || quest.completed) {
      return quest;
    }

    const newProgress = Math.min(quest.progress + amount, quest.target);
    const nowCompleted = newProgress >= quest.target;

    if (nowCompleted && !quest.completed) {
      completedQuests.push({ ...quest, progress: newProgress, completed: true });
    }

    return {
      ...quest,
      progress: newProgress,
      completed: nowCompleted,
    };
  });

  return { quests: updatedQuests, completedQuests };
}
