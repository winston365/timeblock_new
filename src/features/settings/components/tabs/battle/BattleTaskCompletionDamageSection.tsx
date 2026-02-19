import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import type { BattleTaskCompletionDamageRule } from '@/shared/types/domain';
import {
  sectionClass,
  sectionDescriptionClass,
  inputClass,
  primaryButtonClass,
} from '../styles';
import {
  TASK_COMPLETION_DAMAGE_MAX,
  TASK_COMPLETION_DAMAGE_MIN,
  TASK_COMPLETION_DAMAGE_RULES_DEFAULT,
  TASK_COMPLETION_DURATION_MAX,
  TASK_COMPLETION_DURATION_MIN,
} from '@/features/battle/constants/battleConstants';
import {
  sanitizeTaskCompletionDamageRules_core,
  validateTaskCompletionDamageRules_core,
} from '@/features/battle/utils/taskCompletionDamage';

const cloneRules = (rules: BattleTaskCompletionDamageRule[]): BattleTaskCompletionDamageRule[] => {
  return rules.map((rule) => ({ ...rule }));
};

const toSafeInputNumber = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
};

export function BattleTaskCompletionDamageSection() {
  const settings = useBattleStore((state) => state.settings);
  const updateSettings = useBattleStore((state) => state.updateSettings);

  const [draftRules, setDraftRules] = useState<BattleTaskCompletionDamageRule[]>(
    cloneRules(settings.taskCompletionDamageRules),
  );

  useEffect(() => {
    setDraftRules(cloneRules(settings.taskCompletionDamageRules));
  }, [settings.taskCompletionDamageRules]);

  const validationError = useMemo(() => {
    return validateTaskCompletionDamageRules_core(draftRules);
  }, [draftRules]);

  const normalizedDraftRules = useMemo(() => {
    return sanitizeTaskCompletionDamageRules_core(draftRules);
  }, [draftRules]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(normalizedDraftRules) !== JSON.stringify(settings.taskCompletionDamageRules);
  }, [normalizedDraftRules, settings.taskCompletionDamageRules]);

  const handleRuleFieldChange = (
    index: number,
    field: keyof BattleTaskCompletionDamageRule,
  ) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = toSafeInputNumber(event.target.value);
    setDraftRules((prev) => {
      const next = cloneRules(prev);
      if (!next[index]) {
        return prev;
      }

      next[index] = {
        ...next[index],
        [field]: nextValue,
      };
      return next;
    });
  };

  const handleAddRule = () => {
    setDraftRules((prev) => {
      const lastRule = prev[prev.length - 1];
      const nextDuration = lastRule ? Math.min(lastRule.minimumDuration + 15, TASK_COMPLETION_DURATION_MAX) : 15;
      const nextDamage = lastRule ? lastRule.damage : 5;

      return [...prev, { minimumDuration: nextDuration, damage: nextDamage }];
    });
  };

  const handleRemoveRule = (index: number) => {
    setDraftRules((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleResetDefaults = () => {
    setDraftRules(cloneRules(TASK_COMPLETION_DAMAGE_RULES_DEFAULT));
  };

  const handleSaveRules = async () => {
    if (validationError) {
      return;
    }

    await updateSettings({
      taskCompletionDamageRules: normalizedDraftRules,
    });
  };

  return (
    <section className={sectionClass}>
      <h3>⚡ 작업 완료 데미지 설정</h3>
      <p className={sectionDescriptionClass}>
        완료 시간(`adjustedDuration`)에 따라 보스 HP를 깎습니다. 규칙 정책은 임계값 방식이며,
        완료 시간 이하의 규칙 중 가장 큰 `minimumDuration`의 데미지가 적용됩니다.
      </p>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
        <div className="mb-3 text-xs text-[var(--color-text-tertiary)]">
          예시: 45분 완료 시 `45분 이상` 규칙이 있다면 해당 HP 데미지를 적용합니다.
        </div>

        <div className="flex flex-col gap-2">
          {draftRules.map((rule, index) => (
            <div key={`${index}-${rule.minimumDuration}-${rule.damage}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <label className="text-xs text-[var(--color-text-secondary)]">
                최소 완료 시간(분)
                <input
                  type="number"
                  min={TASK_COMPLETION_DURATION_MIN}
                  max={TASK_COMPLETION_DURATION_MAX}
                  value={rule.minimumDuration}
                  onChange={handleRuleFieldChange(index, 'minimumDuration')}
                  className={inputClass}
                />
              </label>

              <label className="text-xs text-[var(--color-text-secondary)]">
                데미지(HP)
                <input
                  type="number"
                  min={TASK_COMPLETION_DAMAGE_MIN}
                  max={TASK_COMPLETION_DAMAGE_MAX}
                  value={rule.damage}
                  onChange={handleRuleFieldChange(index, 'damage')}
                  className={inputClass}
                />
              </label>

              <button
                type="button"
                onClick={() => handleRemoveRule(index)}
                className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
              >
                삭제
              </button>
            </div>
          ))}

          {draftRules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-text-tertiary)]">
              등록된 룰이 없습니다. 이 경우 작업 완료로는 보스 데미지가 적용되지 않습니다.
            </p>
          ) : null}
        </div>

        {validationError ? (
          <p className="mt-3 text-xs font-medium text-red-300">{validationError}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddRule}
            className={primaryButtonClass}
          >
            룰 추가
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            기본값 복원
          </button>

          <button
            type="button"
            onClick={() => {
              void handleSaveRules();
            }}
            disabled={Boolean(validationError) || !hasChanges}
            className={primaryButtonClass}
          >
            저장
          </button>
        </div>
      </div>
    </section>
  );
}
