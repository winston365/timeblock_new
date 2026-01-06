/**
 * @file task-parsing.test.ts
 * @description Task 입력 파싱 유틸 테스트
 */

import { describe, expect, it } from 'vitest';

import { parseTaskInputText } from '@/features/tasks/utils/taskParsing';

describe('parseTaskInputText', () => {
  it('빈 줄을 제거하고 기본값을 적용한다', () => {
    const result = parseTaskInputText('A\n\nB\n', {
      defaultResistance: 'low',
      defaultBaseDuration: 30,
      defaultTimeBlock: null,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ text: 'A', resistance: 'low', baseDuration: 30, timeBlock: null });
    expect(result[1]).toMatchObject({ text: 'B', resistance: 'low', baseDuration: 30, timeBlock: null });
  });

  it('메모(|), 저항도(🟢/🟡/🟠/🔴), 시간([30m]/[1h])을 파싱한다', () => {
    const result = parseTaskInputText('딥워크 [1h] 🟡 | React 리팩터\n청소 [30m] 🟢\n미루기 🔴', {
      defaultResistance: 'low',
      defaultBaseDuration: 15,
      defaultTimeBlock: null,
    });

    expect(result[0]).toMatchObject({
      text: '딥워크',
      memo: 'React 리팩터',
      resistance: 'medium',
      baseDuration: 60,
    });

    expect(result[1]).toMatchObject({
      text: '청소',
      resistance: 'low',
      baseDuration: 30,
    });

    expect(result[2]).toMatchObject({
      text: '미루기',
      resistance: 'high',
      baseDuration: 15,
    });
  });

  it('타임블록 태그를 파싱한다: @8-11 → morning, @morning → morning', () => {
    const result = parseTaskInputText('회의 @8-11\n루틴 @morning', {
      defaultResistance: 'low',
      defaultBaseDuration: 30,
      defaultTimeBlock: null,
    });

    expect(result[0]).toMatchObject({ text: '회의', timeBlock: 'morning' });
    expect(result[1]).toMatchObject({ text: '루틴', timeBlock: 'morning' });
  });

  it('옵션 stripMarkdownListPrefix=true이면 목록 prefix를 제거한다', () => {
    const result = parseTaskInputText('- 첫째\n1. 둘째', {
      defaultResistance: 'low',
      defaultBaseDuration: 30,
      defaultTimeBlock: null,
    }, {
      stripMarkdownListPrefix: true,
    });

    expect(result[0]?.text).toBe('첫째');
    expect(result[1]?.text).toBe('둘째');
  });

  it('stripMarkdownListPrefix=false이면 목록 prefix를 보존한다', () => {
    const result = parseTaskInputText('- 첫째', {
      defaultResistance: 'low',
      defaultBaseDuration: 30,
      defaultTimeBlock: null,
    }, {
      stripMarkdownListPrefix: false,
    });

    expect(result[0]?.text).toBe('- 첫째');
  });
});
