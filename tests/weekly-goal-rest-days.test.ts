/**
 * Weekly Goal Rest Days Tests
 *
 * @file 주간 목표 "쉬는 날" 기능 테스트
 * @description TDD 방식으로 쉬는 날 계산 로직 검증
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRestDays,
  getActiveDays,
  isRestDay,
  getTodayTarget,
  getRemainingDays,
  getDailyTargetForToday,
} from '@/data/repositories/weeklyGoalRepository';

describe('normalizeRestDays', () => {
  it('undefined 입력 시 빈 배열 반환', () => {
    expect(normalizeRestDays(undefined)).toEqual([]);
  });

  it('빈 배열 입력 시 빈 배열 반환', () => {
    expect(normalizeRestDays([])).toEqual([]);
  });

  it('유효한 요일 인덱스만 필터링 (0-6 범위)', () => {
    expect(normalizeRestDays([0, 1, 7, -1, 2])).toEqual([0, 1, 2]);
  });

  it('중복 제거', () => {
    expect(normalizeRestDays([0, 1, 0, 1, 2])).toEqual([0, 1, 2]);
  });

  it('비숫자 값 필터링', () => {
    expect(normalizeRestDays([0, NaN, Infinity, 1])).toEqual([0, 1]);
  });

  it('배열이 아닌 입력 시 빈 배열 반환', () => {
    // @ts-expect-error 테스트를 위한 의도적 타입 오류
    expect(normalizeRestDays('not an array')).toEqual([]);
    // @ts-expect-error 테스트를 위한 의도적 타입 오류
    expect(normalizeRestDays(123)).toEqual([]);
  });
});

describe('getActiveDays', () => {
  it('쉬는 날이 없으면 7일 반환', () => {
    expect(getActiveDays([])).toBe(7);
  });

  it('쉬는 날이 있으면 7 - 쉬는 날 수 반환', () => {
    expect(getActiveDays([0])).toBe(6); // 월요일만 쉼
    expect(getActiveDays([0, 6])).toBe(5); // 월, 일 쉼
    expect(getActiveDays([0, 1, 2, 3, 4, 5, 6])).toBe(0); // 전부 쉼
  });

  it('undefined 입력 시 7일 반환', () => {
    expect(getActiveDays(undefined)).toBe(7);
  });
});

describe('isRestDay', () => {
  it('쉬는 날이면 true 반환', () => {
    expect(isRestDay(0, [0, 6])).toBe(true);
    expect(isRestDay(6, [0, 6])).toBe(true);
  });

  it('쉬는 날이 아니면 false 반환', () => {
    expect(isRestDay(1, [0, 6])).toBe(false);
    expect(isRestDay(5, [0, 6])).toBe(false);
  });

  it('쉬는 날 없으면 항상 false', () => {
    expect(isRestDay(0, [])).toBe(false);
    expect(isRestDay(3, undefined)).toBe(false);
  });

  it('유효하지 않은 dayIndex도 정규화 후 비교', () => {
    expect(isRestDay(7, [0])).toBe(false); // 7은 6으로 정규화됨
    expect(isRestDay(-1, [0])).toBe(true); // -1은 0으로 정규화됨
  });
});

describe('getTodayTarget with restDays', () => {
  // 기존 동작 (하위 호환성)
  it('restDays 없으면 기존 로직 유지', () => {
    // 월요일 (dayIndex=0): 1/7 * 100 = 15 (ceil)
    expect(getTodayTarget(100, 0)).toBe(15);
    // 일요일 (dayIndex=6): 7/7 * 100 = 100
    expect(getTodayTarget(100, 6)).toBe(100);
  });

  // 쉬는 날 적용
  it('쉬는 날이 있으면 활성 일수로 나눠서 계산', () => {
    // 주말(토,일)만 쉬면: 5일 활성
    // 월요일(0)이면: 1/5 * 100 = 20
    expect(getTodayTarget(100, 0, [5, 6])).toBe(20);
    // 금요일(4)이면: 5/5 * 100 = 100
    expect(getTodayTarget(100, 4, [5, 6])).toBe(100);
  });

  it('쉬는 날은 목표 계산에서 건너뜀', () => {
    // 월요일(0)만 쉬면: 6일 활성
    // 월요일(dayIndex=0): 활성 일수 0일 지남 → 0
    expect(getTodayTarget(100, 0, [0])).toBe(0);
    // 화요일(dayIndex=1): 활성 일수 1일 지남 → 1/6 * 100 = 17
    expect(getTodayTarget(100, 1, [0])).toBe(17);
  });

  it('모든 날이 쉬는 날이면 target 그대로 반환 (100% 달성)', () => {
    expect(getTodayTarget(100, 0, [0, 1, 2, 3, 4, 5, 6])).toBe(100);
  });

  it('target이 0 이하면 0 반환', () => {
    expect(getTodayTarget(0, 0, [0, 6])).toBe(0);
    expect(getTodayTarget(-10, 3, [0, 6])).toBe(0);
  });
});

describe('getRemainingDays with restDays', () => {
  it('restDays 없으면 기존 로직 유지', () => {
    // 월요일(0): 7일 남음
    expect(getRemainingDays(0)).toBe(7);
    // 일요일(6): 1일 남음
    expect(getRemainingDays(6)).toBe(1);
  });

  it('유효하지 않은 dayIndex도 정규화 후 계산', () => {
    // -1은 0(월)로 정규화
    expect(getRemainingDays(-1, [5, 6])).toBe(5);
    // 99는 6(일)로 정규화
    expect(getRemainingDays(99, [5, 6])).toBe(0);
    expect(getRemainingDays(99)).toBe(1);
  });

  it('쉬는 날은 남은 일수에서 제외', () => {
    // 월요일(0)에 토,일(5,6)이 쉬는 날이면: 남은 활성일 5일
    expect(getRemainingDays(0, [5, 6])).toBe(5);
    // 금요일(4)에 토,일(5,6)이 쉬는 날이면: 남은 활성일 1일 (금요일만)
    expect(getRemainingDays(4, [5, 6])).toBe(1);
    // 토요일(5)에 토,일(5,6)이 쉬는 날이면: 남은 활성일 0일
    expect(getRemainingDays(5, [5, 6])).toBe(0);
  });
});

describe('getDailyTargetForToday with restDays', () => {
  it('restDays 없으면 기존 로직 유지', () => {
    // 월요일(0), target=100, progress=0: 100/7 = 15 (ceil)
    expect(getDailyTargetForToday(100, 0, 0)).toBe(15);
    // 이미 진행한 경우
    expect(getDailyTargetForToday(100, 50, 0)).toBe(8); // ceil(50/7)
  });

  it('유효하지 않은 dayIndex도 정규화 후 계산', () => {
    // -1은 0(월)로 정규화 → 월요일이 쉬는 날이면 0
    expect(getDailyTargetForToday(100, 0, -1, [0])).toBe(0);
    // 7은 6(일)로 정규화 → 남은 활성일 1일이므로 remaining 전부
    expect(getDailyTargetForToday(100, 0, 7)).toBe(100);
  });

  it('쉬는 날 적용', () => {
    // 토,일 쉬면: 5일 활성
    // 월요일(0), target=100, progress=0: 100/5 = 20
    expect(getDailyTargetForToday(100, 0, 0, [5, 6])).toBe(20);
    // 금요일(4), target=100, progress=80: 남은 20 / 1일 = 20
    expect(getDailyTargetForToday(100, 80, 4, [5, 6])).toBe(20);
  });

  // ADHD 친화 핵심 기능: 오늘이 쉬는 날이면 압박 제거
  it('오늘이 쉬는 날이면 0 반환 (ADHD 친화: 압박 제거)', () => {
    // 토요일(5)에 토,일 쉬면: 오늘이 쉬는 날이므로 0
    expect(getDailyTargetForToday(100, 0, 5, [5, 6])).toBe(0);
    expect(getDailyTargetForToday(100, 50, 5, [5, 6])).toBe(0);
    // 일요일(6)에 토,일 쉬면: 오늘이 쉬는 날이므로 0
    expect(getDailyTargetForToday(100, 0, 6, [5, 6])).toBe(0);
    // 월요일(0)에 월,화 쉬면: 오늘이 쉬는 날이므로 0
    expect(getDailyTargetForToday(100, 0, 0, [0, 1])).toBe(0);
  });

  it('모든 날이 쉬는 날이면 0 반환 (이미 100% 달성)', () => {
    expect(getDailyTargetForToday(100, 0, 0, [0, 1, 2, 3, 4, 5, 6])).toBe(0);
    expect(getDailyTargetForToday(100, 50, 3, [0, 1, 2, 3, 4, 5, 6])).toBe(0);
  });

  it('남은 활성 일수가 0이고 오늘이 활성 일이면 remaining 전부 반환', () => {
    // 금요일(4)에 토,일 쉬면: 남은 활성일 1일 (금요일만)
    // → 오늘이 활성 일이므로 remaining / 1 = remaining
    expect(getDailyTargetForToday(100, 80, 4, [5, 6])).toBe(20);
  });

  it('target 0 이하면 0 반환', () => {
    expect(getDailyTargetForToday(0, 0, 0, [5, 6])).toBe(0);
  });

  it('이미 목표 달성하면 0 반환', () => {
    expect(getDailyTargetForToday(100, 100, 0, [5, 6])).toBe(0);
    expect(getDailyTargetForToday(100, 150, 0, [5, 6])).toBe(0);
  });
});
