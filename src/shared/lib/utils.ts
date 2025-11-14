/**
 * 공통 유틸리티 함수
 */

import type { Resistance, Task, TimeBlockId } from '../types/domain';
import { RESISTANCE_MULTIPLIERS, TIME_BLOCKS } from '../types/domain';
import { XP_PER_MINUTE } from './constants';

// ============================================================================
// 날짜 & 시간 유틸
// ============================================================================

/**
 * 로컬 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 시간을 HH:mm 형식으로 반환
 */
export function formatTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 분을 "Xh Ym" 또는 "Xm" 형식으로 변환
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/**
 * 초를 "mm:ss" 형식으로 변환
 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * ISO 날짜 문자열을 상대 시간으로 변환
 */
export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  return formatTime(date);
}

/**
 * 현재 시간이 속한 타임블록 ID 반환
 */
export function getCurrentTimeBlock(): TimeBlockId {
  const now = new Date();
  const hour = now.getHours();

  for (const block of TIME_BLOCKS) {
    if (hour >= block.start && hour < block.end) {
      return block.id as TimeBlockId;
    }
  }

  return null;
}

/**
 * 타임블록의 진행률 계산 (0-100)
 */
export function getBlockProgress(blockId: string): number {
  const block = TIME_BLOCKS.find(b => b.id === blockId);
  if (!block) return 0;

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour < block.start) return 0;
  if (hour >= block.end) return 100;

  const totalMinutes = (block.end - block.start) * 60;
  const elapsedMinutes = (hour - block.start) * 60 + minute;

  return Math.min(100, Math.round((elapsedMinutes / totalMinutes) * 100));
}

// ============================================================================
// Task 유틸
// ============================================================================

/**
 * 저항도에 따라 조정된 시간 계산
 */
export function calculateAdjustedDuration(baseDuration: number, resistance: Resistance): number {
  return Math.round(baseDuration * RESISTANCE_MULTIPLIERS[resistance]);
}

/**
 * 고유 ID 생성 (타임스탬프 + 랜덤)
 */
export function generateId(prefix: string = 'task'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Task 객체 생성 헬퍼
 */
export function createTask(
  text: string,
  options: {
    memo?: string;
    baseDuration?: number;
    resistance?: Resistance;
    timeBlock?: TimeBlockId;
  } = {}
): Task {
  const baseDuration = options.baseDuration ?? 30;
  const resistance = options.resistance ?? 'low';

  return {
    id: generateId('task'),
    text,
    memo: options.memo ?? '',
    baseDuration,
    resistance,
    adjustedDuration: calculateAdjustedDuration(baseDuration, resistance),
    timeBlock: options.timeBlock ?? null,
    completed: false,
    actualDuration: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Task가 인박스에 있는지 확인
 */
export function isInInbox(task: Task): boolean {
  return task.timeBlock === null;
}

/**
 * Task가 오늘 것인지 확인 (createdAt 기준)
 */
export function isToday(task: Task): boolean {
  const taskDate = getLocalDate(new Date(task.createdAt));
  const today = getLocalDate();
  return taskDate === today;
}

// ============================================================================
// XP 계산
// ============================================================================

/**
 * 작업 완료 시 획득 XP 계산
 */
export function calculateTaskXP(task: Task): number {
  // 실제 소요 시간이 있으면 그걸 사용, 없으면 조정된 시간 사용
  const duration = task.actualDuration > 0 ? task.actualDuration : task.adjustedDuration;
  return Math.round(duration * XP_PER_MINUTE);
}

/**
 * 레벨에서 총 XP 계산
 */
export function getLevelFromXP(totalXP: number): number {
  return Math.floor(totalXP / 100) + 1;
}

/**
 * 다음 레벨까지 필요한 XP 계산
 */
export function getXPToNextLevel(totalXP: number): number {
  const currentLevel = getLevelFromXP(totalXP);
  const nextLevelXP = currentLevel * 100;
  return nextLevelXP - totalXP;
}

// ============================================================================
// 호감도 계산
// ============================================================================

/**
 * 호감도 범위 제한 (0-100)
 */
export function clampAffection(affection: number): number {
  return Math.max(0, Math.min(100, affection));
}

/**
 * 호감도로 티어 구간 찾기
 */
export function getAffectionTier(affection: number): string {
  if (affection >= 85) return 'EXCELLENT';
  if (affection >= 70) return 'VERY_GOOD';
  if (affection >= 55) return 'GOOD';
  if (affection >= 40) return 'NEUTRAL';
  if (affection >= 20) return 'LOW';
  return 'VERY_LOW';
}

// ============================================================================
// 배열 & 객체 유틸
// ============================================================================

/**
 * 배열을 객체로 변환 (Firebase 저장용)
 */
export function arrayToObject<T extends { id: string }>(arr: T[]): Record<string, T> {
  return arr.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, T>);
}

/**
 * 객체를 배열로 변환
 */
export function objectToArray<T>(obj: Record<string, T> | null | undefined): T[] {
  if (!obj) return [];
  return Object.values(obj);
}

// ============================================================================
// 로컬 스토리지 헬퍼
// ============================================================================

/**
 * localStorage에서 JSON 파싱하여 가져오기
 */
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * localStorage에 JSON 저장
 */
export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage key "${key}":`, error);
  }
}

/**
 * localStorage에서 삭제
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove localStorage key "${key}":`, error);
  }
}

// ============================================================================
// 디바운스 헬퍼
// ============================================================================

/**
 * 디바운스 함수
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
