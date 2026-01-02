/**
 * weekUtils.ts
 *
 * @file 주간 계산 유틸리티
 * @description
 *   - T04: "이번 주" 계산 유틸
 *   - YYYY-WW 형식 주간 라벨 생성
 *   - 주 시작일(월요일) 계산
 *   - 주간 비교 유틸리티
 */

/**
 * 로컬 날짜를 YYYY-MM-DD 형식으로 포맷
 * @param date - Date 객체
 * @returns YYYY-MM-DD 형식 문자열
 */
export function formatLocalYyyyMmDd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 주어진 날짜가 속한 주의 월요일 날짜를 반환
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns YYYY-MM-DD 형식의 월요일 날짜
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일요일, 1=월요일, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return formatLocalYyyyMmDd(d);
}

/**
 * ISO 주 번호 계산 (ISO 8601 기준)
 * @param date - 기준 날짜
 * @returns 1~53 사이의 주 번호
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 일요일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * ISO 주 연도 계산 (ISO 8601 기준)
 * 1월 초에 주가 이전 연도에 속할 수 있음
 * @param date - 기준 날짜
 * @returns 연도
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * YYYY-WW 형식의 주간 라벨 생성
 * 예: "2026-W01"
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns YYYY-WW 형식 문자열
 */
export function getWeekLabel(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * 주간 라벨에서 Date 객체 생성 (해당 주의 월요일)
 * @param weekLabel - YYYY-WW 형식
 * @returns 해당 주의 월요일 Date 객체 또는 null
 */
export function parseWeekLabel(weekLabel: string): Date | null {
  const match = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO 8601: 1월 4일이 속한 주가 첫 번째 주
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 일요일=7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  // 주 번호에 해당하는 월요일
  const result = new Date(firstMonday);
  result.setDate(firstMonday.getDate() + (week - 1) * 7);
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * 두 날짜가 같은 주인지 확인
 * @param date1 - 첫 번째 날짜
 * @param date2 - 두 번째 날짜
 * @returns 같은 주이면 true
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  return getWeekLabel(date1) === getWeekLabel(date2);
}

/**
 * 이번 주인지 확인
 * @param date - 확인할 날짜
 * @returns 이번 주이면 true
 */
export function isThisWeek(date: Date): boolean {
  return isSameWeek(date, new Date());
}

/**
 * 오늘이 주의 몇 번째 날인지 (월요일=0, 일요일=6)
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns 0~6 (월요일=0)
 */
export function getDayOfWeekIndex(date: Date = new Date()): number {
  const day = date.getDay(); // 0=일요일, 1=월요일
  return day === 0 ? 6 : day - 1; // 월요일=0으로 변환
}

/**
 * 남은 일수 계산 (오늘 포함)
 * @param dayIndex - 오늘의 요일 인덱스 (월요일=0)
 * @returns 남은 일수
 */
export function getRemainingDays(dayIndex: number = getDayOfWeekIndex()): number {
  return 7 - Math.min(6, Math.max(0, dayIndex));
}

/**
 * 주간 진행률 계산
 * @param dayIndex - 오늘의 요일 인덱스 (월요일=0)
 * @returns 0~1 사이 비율 (예: 수요일=3/7)
 */
export function getWeekProgressRatio(dayIndex: number = getDayOfWeekIndex()): number {
  return (dayIndex + 1) / 7;
}

/**
 * 한국어 주간 라벨 생성
 * 예: "2026년 1주차"
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns 한국어 주간 라벨
 */
export function getWeekLabelKorean(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeekNumber(date);
  return `${year}년 ${week}주차`;
}

/**
 * 짧은 한국어 주간 라벨 생성
 * 예: "1주차" (같은 연도) 또는 "2026년 1주차" (다른 연도)
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns 짧은 한국어 주간 라벨
 */
export function getWeekLabelKoreanShort(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeekNumber(date);
  const currentYear = new Date().getFullYear();
  
  if (year === currentYear) {
    return `${week}주차`;
  }
  return `${year}년 ${week}주차`;
}

/**
 * 주간 날짜 범위 문자열 생성
 * 예: "1/1 ~ 1/7"
 * @param date - 기준 날짜 (기본: 오늘)
 * @returns 날짜 범위 문자열
 */
export function getWeekDateRange(date: Date = new Date()): string {
  const weekStart = parseWeekLabel(getWeekLabel(date));
  if (!weekStart) return '';
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const startStr = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
  const endStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  
  return `${startStr} ~ ${endStr}`;
}
