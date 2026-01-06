/**
 * @file taskParsing.ts
 * @description 여러 줄 텍스트 입력을 Task-like 필드로 파싱하는 공용 유틸
 */

import { TIME_BLOCKS, type Resistance, type TimeBlockId } from '@/shared/types/domain';

export interface TaskParsingDefaults {
  /** 라인에 지정이 없을 때 적용할 저항도 */
  defaultResistance: Resistance;
  /** 라인에 지정이 없을 때 적용할 예상 시간(분) */
  defaultBaseDuration: number;
  /** 라인에 지정이 없을 때 적용할 타임블록 */
  defaultTimeBlock: TimeBlockId | null;
}

export interface TaskParsingOptions {
  /** - item, * item, 1. item 같은 prefix를 제거할지 여부 */
  stripMarkdownListPrefix?: boolean;
}

export interface ParsedTaskInput {
  text: string;
  memo?: string;
  baseDuration: number;
  resistance: Resistance;
  timeBlock: TimeBlockId | null;
}

/** 시간 선택 옵션 (분 단위) */
export const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120] as const;

const EMPTY_TITLE_FALLBACK = '(제목 없음)';

const toInt = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const stripListPrefix = (raw: string): string => {
  const withoutBullet = raw.replace(/^[-*]\s+/, '');
  return withoutBullet.replace(/^\d+\.\s+/, '');
};

const extractMemo = (raw: string): { memo?: string; text: string } => {
  const memoMatch = raw.match(/\|(.+)$/);
  if (!memoMatch) return { text: raw };
  const memo = memoMatch[1]?.trim();
  const text = raw.replace(/\|.+$/, '').trim();
  return memo ? { memo, text } : { text };
};

const findTimeBlockByRange = (startHour: number, endHour: number): TimeBlockId | null => {
  const found = TIME_BLOCKS.find((block) => block.start === startHour && block.end === endHour);
  return found?.id ?? null;
};

const isTimeBlockId = (value: string): value is Exclude<TimeBlockId, null> => {
  return TIME_BLOCKS.some((block) => block.id === value);
};

const extractTimeBlock = (
  raw: string,
  defaultTimeBlock: TimeBlockId | null,
): { timeBlock: TimeBlockId | null; text: string } => {
  // 1) @8-11 같은 범위 태그
  const rangeMatch = raw.match(/@(\d{1,2})-(\d{1,2})/);
  if (rangeMatch) {
    const start = toInt(rangeMatch[1] ?? '');
    const end = toInt(rangeMatch[2] ?? '');
    const mapped = start !== null && end !== null ? findTimeBlockByRange(start, end) : null;

    return {
      timeBlock: mapped ?? defaultTimeBlock,
      text: raw.replace(/@\d{1,2}-\d{1,2}/, '').trim(),
    };
  }

  // 2) @morning 같은 ID 태그
  const idMatch = raw.match(/@([a-z]+)/i);
  if (idMatch) {
    const id = (idMatch[1] ?? '').trim();
    if (id && isTimeBlockId(id)) {
      return {
        timeBlock: id,
        text: raw.replace(/@[a-z]+/i, '').trim(),
      };
    }
  }

  return { timeBlock: defaultTimeBlock, text: raw };
};

const extractResistance = (
  raw: string,
  defaultResistance: Resistance,
): { resistance: Resistance; text: string } => {
  if (raw.includes('🟢')) {
    return { resistance: 'low', text: raw.replace('🟢', '').trim() };
  }

  if (raw.includes('🟡')) {
    return { resistance: 'medium', text: raw.replace('🟡', '').trim() };
  }

  if (raw.includes('🟠')) {
    return { resistance: 'medium', text: raw.replace('🟠', '').trim() };
  }

  if (raw.includes('🔴')) {
    return { resistance: 'high', text: raw.replace('🔴', '').trim() };
  }

  return { resistance: defaultResistance, text: raw };
};

const extractDuration = (
  raw: string,
  defaultBaseDuration: number,
): { baseDuration: number; text: string } => {
  const timeMatch = raw.match(/\[(\d+(?:\.\d+)?)(h|m)\]/);
  if (!timeMatch) return { baseDuration: defaultBaseDuration, text: raw };

  const value = Number.parseFloat(timeMatch[1] ?? '');
  const unit = timeMatch[2] ?? 'm';

  if (!Number.isFinite(value) || value <= 0) {
    return { baseDuration: defaultBaseDuration, text: raw.replace(/\[\d+(?:\.\d+)?(h|m)\]/, '').trim() };
  }

  const minutes = unit === 'h' ? value * 60 : value;
  return {
    baseDuration: minutes,
    text: raw.replace(/\[\d+(?:\.\d+)?(h|m)\]/, '').trim(),
  };
};

/**
 * 여러 줄 텍스트를 작업 입력 필드로 파싱합니다.
 *
 * 포맷:
 * - 메모: `작업 | 메모`
 * - 시간: `작업 [30m]`, `작업 [1h]`
 * - 저항도: `🟢/🟡/🟠/🔴`
 * - 타임블록: `@8-11` 또는 `@morning`
 */
export const parseTaskInputText = (
  input: string,
  defaults: TaskParsingDefaults,
  options: TaskParsingOptions = {},
): ParsedTaskInput[] => {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedTaskInput[] = [];

  for (const line of lines) {
    let remaining = line;

    if (options.stripMarkdownListPrefix) {
      remaining = stripListPrefix(remaining).trim();
    }

    const memoResult = extractMemo(remaining);
    remaining = memoResult.text;

    const timeBlockResult = extractTimeBlock(remaining, defaults.defaultTimeBlock);
    remaining = timeBlockResult.text;

    const resistanceResult = extractResistance(remaining, defaults.defaultResistance);
    remaining = resistanceResult.text;

    const durationResult = extractDuration(remaining, defaults.defaultBaseDuration);
    remaining = durationResult.text;

    const text = remaining.trim() || EMPTY_TITLE_FALLBACK;

    parsed.push({
      text,
      memo: memoResult.memo,
      resistance: resistanceResult.resistance,
      baseDuration: durationResult.baseDuration,
      timeBlock: timeBlockResult.timeBlock,
    });
  }

  return parsed;
};
