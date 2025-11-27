/**
 * TimeBlock XP 유틸리티
 *
 * @role 현재 타임블록 정보 및 XP 진행률 계산
 * @input 현재 시간, GameState의 timeBlockXP
 * @output 타임블록 정보, XP 진행률, 활성화 상태
 * @dependencies TIME_BLOCKS (domain.ts)
 */

import { TIME_BLOCKS } from '@/shared/types/domain';

/**
 * 타임블록 정보 인터페이스
 */
export interface TimeBlockInfo {
  id: string;
  label: string;
  start: number;
  end: number;
  isActive: boolean;      // 현재 활성화된 블록인지
  isNightTime: boolean;   // 비활성 시간대 (23~05시)
}

/**
 * 타임블록 XP 진행 정보
 */
export interface TimeBlockXPProgress {
  currentBlockId: string | null;
  currentBlockLabel: string;
  currentXP: number;
  goalXP: number;
  progressPercent: number;
  isNightTime: boolean;
  nextBlockStart: number | null;
  remainingMinutes: number;  // 현재 블록 남은 시간 (분)
}

/**
 * 현재 시간에 해당하는 타임블록 정보 반환
 * 
 * @param hour - 시간 (0-23), 기본값은 현재 시간
 * @returns 타임블록 정보 또는 비활성 시간대 정보
 */
export function getCurrentTimeBlockInfo(hour?: number): TimeBlockInfo {
  const currentHour = hour ?? new Date().getHours();
  
  // 23시~05시는 비활성 시간대
  if (currentHour >= 23 || currentHour < 5) {
    return {
      id: 'night',
      label: '휴식 시간',
      start: 23,
      end: 5,
      isActive: false,
      isNightTime: true,
    };
  }
  
  // 활성 타임블록 찾기
  for (const block of TIME_BLOCKS) {
    if (currentHour >= block.start && currentHour < block.end) {
      return {
        id: block.id,
        label: block.label,
        start: block.start,
        end: block.end,
        isActive: true,
        isNightTime: false,
      };
    }
  }
  
  // 기본값 (이론적으로 도달하지 않음)
  return {
    id: 'unknown',
    label: '알 수 없음',
    start: 0,
    end: 0,
    isActive: false,
    isNightTime: false,
  };
}

/**
 * 현재 타임블록의 남은 시간 계산 (분)
 */
export function getRemainingMinutesInBlock(): number {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  const blockInfo = getCurrentTimeBlockInfo(hour);
  
  if (blockInfo.isNightTime) {
    // 비활성 시간대: 05시까지 남은 시간
    if (hour >= 23) {
      return (24 - hour + 5) * 60 - minutes;
    }
    return (5 - hour) * 60 - minutes;
  }
  
  // 활성 시간대: 블록 종료까지 남은 시간
  return (blockInfo.end - hour - 1) * 60 + (60 - minutes);
}

/**
 * 타임블록 XP 진행률 계산
 * 
 * @param timeBlockXP - GameState의 timeBlockXP 객체
 * @param goalXP - 타임블록당 XP 목표 (기본 200)
 * @returns XP 진행 정보
 */
export function calculateTimeBlockXPProgress(
  timeBlockXP: Record<string, number> | undefined,
  goalXP: number = 200
): TimeBlockXPProgress {
  const now = new Date();
  const currentHour = now.getHours();
  const blockInfo = getCurrentTimeBlockInfo(currentHour);
  
  // 비활성 시간대
  if (blockInfo.isNightTime) {
    return {
      currentBlockId: null,
      currentBlockLabel: '휴식 시간 (23:00 ~ 05:00)',
      currentXP: 0,
      goalXP,
      progressPercent: 0,
      isNightTime: true,
      nextBlockStart: 5,
      remainingMinutes: getRemainingMinutesInBlock(),
    };
  }
  
  // 현재 블록의 XP 가져오기
  const currentXP = timeBlockXP?.[blockInfo.id] ?? 0;
  const progressPercent = Math.min(100, (currentXP / goalXP) * 100);
  
  // 다음 블록 시작 시간
  const nextBlockIdx = TIME_BLOCKS.findIndex(b => b.id === blockInfo.id) + 1;
  const nextBlockStart = nextBlockIdx < TIME_BLOCKS.length 
    ? TIME_BLOCKS[nextBlockIdx].start 
    : 23; // 마지막 블록 다음은 휴식 시간
  
  return {
    currentBlockId: blockInfo.id,
    currentBlockLabel: blockInfo.label,
    currentXP,
    goalXP,
    progressPercent,
    isNightTime: false,
    nextBlockStart,
    remainingMinutes: getRemainingMinutesInBlock(),
  };
}

/**
 * 타임블록 ID로 라벨 가져오기
 */
export function getBlockLabel(blockId: string): string {
  const block = TIME_BLOCKS.find(b => b.id === blockId);
  return block?.label ?? blockId;
}

/**
 * 모든 타임블록 목록과 현재 활성 여부 반환
 */
export function getAllTimeBlocksWithStatus(): Array<TimeBlockInfo> {
  const currentHour = new Date().getHours();
  
  return TIME_BLOCKS.map(block => ({
    id: block.id,
    label: block.label,
    start: block.start,
    end: block.end,
    isActive: currentHour >= block.start && currentHour < block.end,
    isNightTime: false,
  }));
}
