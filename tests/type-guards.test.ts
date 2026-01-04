/**
 * @fileoverview Type Guard 유틸리티 함수 테스트
 */
import { describe, expect, it } from 'vitest';

import {
  assertArray,
  isNonEmptyArray,
  isNonNullish,
  isRecord,
} from '../src/shared/lib/typeGuards';

describe('typeGuards', () => {
  describe('isNonNullish', () => {
    it('null에 대해 false를 반환한다', () => {
      expect(isNonNullish(null)).toBe(false);
    });

    it('undefined에 대해 false를 반환한다', () => {
      expect(isNonNullish(undefined)).toBe(false);
    });

    it('0에 대해 true를 반환한다 (falsy이지만 nullish가 아님)', () => {
      expect(isNonNullish(0)).toBe(true);
    });

    it('빈 문자열에 대해 true를 반환한다 (falsy이지만 nullish가 아님)', () => {
      expect(isNonNullish('')).toBe(true);
    });

    it('false에 대해 true를 반환한다 (falsy이지만 nullish가 아님)', () => {
      expect(isNonNullish(false)).toBe(true);
    });

    it('NaN에 대해 true를 반환한다 (falsy이지만 nullish가 아님)', () => {
      expect(isNonNullish(NaN)).toBe(true);
    });

    it('일반 값에 대해 true를 반환한다', () => {
      expect(isNonNullish('hello')).toBe(true);
      expect(isNonNullish(42)).toBe(true);
      expect(isNonNullish({})).toBe(true);
      expect(isNonNullish([])).toBe(true);
    });

    it('배열 filter에서 타입 narrowing을 지원한다', () => {
      const items: (string | null | undefined)[] = ['a', null, 'b', undefined];
      const filtered = items.filter(isNonNullish);

      expect(filtered).toEqual(['a', 'b']);
      // 타입 체크: filtered는 string[] 타입
      expect(filtered[0].toUpperCase()).toBe('A');
    });
  });

  describe('isNonEmptyArray', () => {
    it('null에 대해 false를 반환한다', () => {
      expect(isNonEmptyArray(null)).toBe(false);
    });

    it('undefined에 대해 false를 반환한다', () => {
      expect(isNonEmptyArray(undefined)).toBe(false);
    });

    it('빈 배열에 대해 false를 반환한다', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('하나의 요소가 있는 배열에 대해 true를 반환한다', () => {
      expect(isNonEmptyArray([1])).toBe(true);
    });

    it('여러 요소가 있는 배열에 대해 true를 반환한다', () => {
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
    });

    it('객체 배열에서도 동작한다', () => {
      expect(isNonEmptyArray([{ id: 1 }])).toBe(true);
    });

    it('falsy 요소를 포함한 배열도 non-empty로 판단한다', () => {
      expect(isNonEmptyArray([null])).toBe(true);
      expect(isNonEmptyArray([undefined])).toBe(true);
      expect(isNonEmptyArray([0])).toBe(true);
      expect(isNonEmptyArray([''])).toBe(true);
    });
  });

  describe('assertArray', () => {
    it('배열인 경우 에러 없이 통과한다', () => {
      expect(() => assertArray([])).not.toThrow();
      expect(() => assertArray([1, 2, 3])).not.toThrow();
    });

    it('null인 경우 에러를 throw한다', () => {
      expect(() => assertArray(null)).toThrow('[TypeGuard] value must be an array');
    });

    it('undefined인 경우 에러를 throw한다', () => {
      expect(() => assertArray(undefined)).toThrow('[TypeGuard] value must be an array');
    });

    it('객체인 경우 에러를 throw한다', () => {
      expect(() => assertArray({})).toThrow('[TypeGuard] value must be an array');
    });

    it('문자열인 경우 에러를 throw한다', () => {
      expect(() => assertArray('string')).toThrow('[TypeGuard] value must be an array');
    });

    it('숫자인 경우 에러를 throw한다', () => {
      expect(() => assertArray(123)).toThrow('[TypeGuard] value must be an array');
    });

    it('커스텀 필드명이 에러 메시지에 포함된다', () => {
      expect(() => assertArray(null, 'myField')).toThrow('[TypeGuard] myField must be an array');
    });

    it('assertion 후 배열로 타입이 narrowing된다', () => {
      const value: unknown = [1, 2, 3];
      assertArray(value);
      // 타입 체크: value는 unknown[] 타입
      expect(value.length).toBe(3);
    });
  });

  describe('isRecord', () => {
    it('일반 객체에 대해 true를 반환한다', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it('null에 대해 false를 반환한다', () => {
      expect(isRecord(null)).toBe(false);
    });

    it('undefined에 대해 false를 반환한다', () => {
      expect(isRecord(undefined)).toBe(false);
    });

    it('배열에 대해 false를 반환한다 (배열도 객체이지만 Record가 아님)', () => {
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2, 3])).toBe(false);
    });

    it('문자열에 대해 false를 반환한다', () => {
      expect(isRecord('string')).toBe(false);
    });

    it('숫자에 대해 false를 반환한다', () => {
      expect(isRecord(123)).toBe(false);
    });

    it('boolean에 대해 false를 반환한다', () => {
      expect(isRecord(true)).toBe(false);
      expect(isRecord(false)).toBe(false);
    });

    it('함수에 대해 false를 반환한다', () => {
      expect(isRecord(() => {})).toBe(false);
    });

    it('중첩 객체에 대해 true를 반환한다', () => {
      expect(isRecord({ nested: { deep: true } })).toBe(true);
    });

    it('Date 객체에 대해 true를 반환한다 (객체이므로)', () => {
      expect(isRecord(new Date())).toBe(true);
    });

    it('class 인스턴스에 대해 true를 반환한다 (객체이므로)', () => {
      class MyClass {}
      expect(isRecord(new MyClass())).toBe(true);
    });
  });
});
