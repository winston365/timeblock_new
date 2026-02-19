import type { BattleTaskCompletionDamageRule } from '@/shared/types/domain';
import {
  TASK_COMPLETION_DAMAGE_MAX,
  TASK_COMPLETION_DAMAGE_MIN,
  TASK_COMPLETION_DURATION_MAX,
  TASK_COMPLETION_DURATION_MIN,
} from '@/features/battle/constants/battleConstants';

const toPositiveInt = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
};

const isValidRule = (rule: BattleTaskCompletionDamageRule): boolean => {
  return (
    rule.minimumDuration >= TASK_COMPLETION_DURATION_MIN &&
    rule.minimumDuration <= TASK_COMPLETION_DURATION_MAX &&
    rule.damage >= TASK_COMPLETION_DAMAGE_MIN &&
    rule.damage <= TASK_COMPLETION_DAMAGE_MAX
  );
};

/**
 * 사용자 입력/원격 데이터에서 들어온 룰을 정규화합니다.
 * - 양수 정수만 허용
 * - minimumDuration 오름차순 정렬
 * - 동일 threshold는 첫 번째 값만 유지
 */
export const sanitizeTaskCompletionDamageRules_core = (
  rules: BattleTaskCompletionDamageRule[],
): BattleTaskCompletionDamageRule[] => {
  const normalized = rules
    .map((rule) => ({
      minimumDuration: toPositiveInt(rule.minimumDuration),
      damage: toPositiveInt(rule.damage),
    }))
    .filter(isValidRule)
    .sort((a, b) => a.minimumDuration - b.minimumDuration);

  const seen = new Set<number>();
  const deduped: BattleTaskCompletionDamageRule[] = [];

  for (const rule of normalized) {
    if (seen.has(rule.minimumDuration)) {
      continue;
    }

    seen.add(rule.minimumDuration);
    deduped.push(rule);
  }

  return deduped;
};

/**
 * 임계값 정책 룰 유효성 검증
 * - 숫자/양수
 * - minimumDuration 엄격 오름차순(중복 금지)
 */
export const validateTaskCompletionDamageRules_core = (
  rules: BattleTaskCompletionDamageRule[],
): string | null => {
  for (const rule of rules) {
    if (!Number.isFinite(rule.minimumDuration) || !Number.isFinite(rule.damage)) {
      return 'Duration and damage must be valid numbers.';
    }

    if (rule.minimumDuration <= 0 || rule.damage <= 0) {
      return 'Duration and damage must be positive numbers.';
    }
  }

  for (let index = 1; index < rules.length; index += 1) {
    if (rules[index].minimumDuration <= rules[index - 1].minimumDuration) {
      return 'Threshold durations must be strictly increasing.';
    }
  }

  return null;
};

/**
 * 임계값 정책 데미지 계산.
 * 정책: minimumDuration <= adjustedDuration인 규칙 중 가장 큰 threshold의 damage를 적용.
 */
export const resolveTaskCompletionDamage_core = (
  adjustedDuration: number,
  rules: BattleTaskCompletionDamageRule[],
): number => {
  if (!Number.isFinite(adjustedDuration) || adjustedDuration <= 0) {
    return 0;
  }

  const sanitizedRules = sanitizeTaskCompletionDamageRules_core(rules);
  if (sanitizedRules.length === 0) {
    return 0;
  }

  let resolvedDamage = 0;
  for (const rule of sanitizedRules) {
    if (adjustedDuration >= rule.minimumDuration) {
      resolvedDamage = rule.damage;
      continue;
    }

    break;
  }

  return resolvedDamage;
};
