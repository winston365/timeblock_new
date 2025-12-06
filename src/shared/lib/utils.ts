/**
 * 공통 유틸리티 함수
 *
 * @role 날짜/시간 처리, Task 생성/조작, XP/호감도 계산, 로컬스토리지 관리 등 앱 전반에서 사용되는 유틸리티 함수 제공
 * @input 다양한 입력 (날짜, Task, 설정값 등)
 * @output 포맷된 문자열, 계산된 값, 변환된 데이터 등
 * @dependencies domain 타입, constants
 */

import type { Resistance, Task, TimeBlockId } from '../types/domain';
import { RESISTANCE_MULTIPLIERS, TIME_BLOCKS } from '../types/domain';
import { XP_PER_MINUTE } from './constants';

// ============================================================================
// 날짜 & 시간 유틸
// ============================================================================

/**
 * 로컬 날짜를 YYYY-MM-DD 형식으로 반환
 *
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
export function getLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * "HH:MM" 문자열을 분(minutes from midnight)으로 변환
 * @param timeStr - "HH:MM" 형식의 시간 문자열
 * @returns 0시 0분부터의 경과 분 (0~1439)
 */
export function timeStrToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분(minutes from midnight)을 "HH:MM" 문자열로 변환
 * @param minutes - 0시 0분부터의 경과 분
 * @returns "HH:MM" 형식의 시간 문자열
 */
export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 시간을 HH:mm 형식으로 반환
 *
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @returns HH:mm 형식의 시간 문자열
 */
export function formatTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 분을 "Xh Ym" 또는 "Xm" 형식으로 변환
 *
 * @param minutes - 변환할 시간 (분 단위)
 * @returns 포맷된 시간 문자열 (예: '30분', '1시간 30분')
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
}

/**
 * 초를 "mm:ss" 형식으로 변환 (분도 2자리 패딩)
 *
 * @param seconds - 변환할 시간 (초 단위)
 * @returns mm:ss 형식의 타이머 문자열 (예: "05:03")
 */
export function formatTimer(seconds: number): string {
  const displayMinutes = Math.floor(seconds / 60);
  const displaySeconds = Math.max(0, seconds % 60);
  return `${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;
}

/**
 * 초를 "m:ss" 형식으로 변환 (분은 패딩 없음)
 *
 * @param seconds - 변환할 시간 (초 단위)
 * @returns m:ss 형식의 타이머 문자열 (예: "5:03")
 */
export function formatTimerCompact(seconds: number): string {
  const displayMinutes = Math.floor(seconds / 60);
  const displaySeconds = Math.max(0, seconds % 60);
  return `${displayMinutes}:${String(displaySeconds).padStart(2, '0')}`;
}

/**
 * ISO 날짜 문자열을 상대 시간으로 변환
 *
 * @param isoString - ISO 8601 형식의 날짜 문자열
 * @returns 상대 시간 문자열 (예: '방금 전', '5분 전', '2시간 전')
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
 *
 * @returns 타임블록 ID (예: '5-8', '8-11' 등) 또는 null
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
 * 시간(hour)에 해당하는 타임블록 ID 반환
 * 
 * @param hour - 시간 (0-23)
 * @returns 타임블록 ID (예: '5-8', '8-11', ... 또는 'other')
 * 
 * @note 23~04시는 'other'로 분류
 */
export function getBlockIdFromHour(hour: number): string {
  if (hour >= 5 && hour < 8) return '5-8';
  if (hour >= 8 && hour < 11) return '8-11';
  if (hour >= 11 && hour < 14) return '11-14';
  if (hour >= 14 && hour < 17) return '14-17';
  if (hour >= 17 && hour < 20) return '17-20';
  if (hour >= 20 && hour < 23) return '20-23';
  return 'other';
}

/**
 * 타임블록의 진행률 계산 (0-100)
 *
 * @param blockId - 타임블록 ID (예: '5-8', '8-11')
 * @returns 진행률 (0-100 사이의 정수)
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
 *
 * @param baseDuration - 기본 소요 시간 (분)
 * @param resistance - 작업 저항도 ('low' | 'medium' | 'high')
 * @returns 저항도 배율이 적용된 조정 시간 (분)
 */
export function calculateAdjustedDuration(baseDuration: number, resistance: Resistance): number {
  return Math.round(baseDuration * RESISTANCE_MULTIPLIERS[resistance]);
}

/**
 * 고유 ID 생성 (UUID v4 기반)
 *
 * @param {string} prefix - ID 접두사 (기본값: 'task')
 * @returns {string} 고유한 ID (예: 'task-550e8400-e29b-41d4-a716-446655440000')
 * @sideEffects 없음 (순수 함수)
 *
 * @note crypto.randomUUID()를 사용하여 RFC 4122 표준을 따르는 UUID v4 생성
 *       충돌 확률은 사실상 0에 가까움 (2^122)
 */
export function generateId(prefix: string = 'task'): string {
  // 브라우저 환경에서 crypto.randomUUID() 지원 확인
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  // 폴백: Date.now() + random (레거시 환경용)
  console.warn('crypto.randomUUID() not available, using fallback ID generation');
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Task가 인박스에 있는지 확인
 *
 * @param task - 확인할 Task 객체
 * @returns 인박스에 있으면 true (timeBlock === null)
 */
export function isInInbox(task: Task): boolean {
  return task.timeBlock === null;
}

/**
 * Task가 오늘 것인지 확인 (createdAt 기준)
 *
 * @param task - 확인할 Task 객체
 * @returns 오늘 생성된 Task면 true
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
 * XP 계산에 필요한 최소 Task 필드
 */
export type TaskXPFields = Pick<Task, 'actualDuration' | 'adjustedDuration' | 'resistance'>;

/**
 * 작업 완료 시 획득 XP 계산
 * 난이도에 따라 XP 배율 적용 (쉬움 1.0배, 보통 1.3배, 어려움 1.6배)
 *
 * @param task - XP를 계산할 Task 객체 (필요한 필드만 포함해도 됨)
 * @returns 획득할 XP 양
 */
export function calculateTaskXP(task: TaskXPFields): number {
  // 실제 소요 시간이 있으면 그걸 사용, 없으면 조정된 시간 사용
  const duration = task.actualDuration > 0 ? task.actualDuration : task.adjustedDuration;
  const baseXP = duration * XP_PER_MINUTE;

  // 난이도에 따른 XP 배율 적용
  const resistanceMultiplier = RESISTANCE_MULTIPLIERS[task.resistance];
  const finalXP = Math.round(baseXP * resistanceMultiplier);



  return finalXP;
}

// ============================================================================
// 호감도 계산
// ============================================================================

/**
 * 호감도 범위 제한 (0-100)
 *
 * @param affection - 제한할 호감도 값
 * @returns 0-100 범위로 제한된 호감도
 */
export function clampAffection(affection: number): number {
  return Math.max(0, Math.min(100, affection));
}

/**
 * 호감도로 티어 구간 찾기
 *
 * @param affection - 호감도 값 (0-100)
 * @returns 티어 문자열 ('EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'NEUTRAL' | 'LOW' | 'VERY_LOW')
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
 *
 * @param arr - id 속성을 가진 객체 배열
 * @returns id를 키로 하는 Record 객체
 */
export function arrayToObject<T extends { id: string }>(arr: T[]): Record<string, T> {
  return arr.reduce((accumulator, entity) => {
    accumulator[entity.id] = entity;
    return accumulator;
  }, {} as Record<string, T>);
}

/**
 * 객체를 배열로 변환
 *
 * @param obj - 변환할 Record 객체 (null/undefined 허용)
 * @returns 객체의 값들로 이루어진 배열
 */
export function objectToArray<T>(obj: Record<string, T> | null | undefined): T[] {
  if (!obj) return [];
  return Object.values(obj);
}



// ============================================================================
// 디바운스 헬퍼
// ============================================================================

/**
 * 디바운스 함수
 *
 * @param func - 디바운스를 적용할 함수
 * @param wait - 대기 시간 (ms)
 * @returns 디바운스가 적용된 함수
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

// ============================================================================
// URL 링크화
// ============================================================================

/**
 * 텍스트 내의 URL을 클릭 가능한 링크로 변환
 *
 * @param text 변환할 텍스트
 * @returns HTML 문자열 (URL이 <a> 태그로 변환됨)
 */
export function linkifyText(text: string): string {
  if (!text) return '';

  // URL 정규식 (http, https, www 지원)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

  return text.replace(urlRegex, (url) => {
    // www로 시작하는 경우 http:// 추가
    const href = url.startsWith('www.') ? `http://${url}` : url;

    // 새 탭에서 열리고, 보안을 위해 noopener noreferrer 추가
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="memo-link">${url}</a>`;
  });
}
