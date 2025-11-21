import React from 'react';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';

interface DontDoChecklistProps {
    timeBlockId: string;
}

export const DontDoChecklist: React.FC<DontDoChecklistProps> = ({ timeBlockId }) => {
    const { settings } = useSettingsStore();
    const { dailyData, toggleDontDoItem } = useDailyDataStore();

    const checklistItems = settings?.dontDoChecklist || [];

    if (checklistItems.length === 0) return null;

    const handleToggle = (itemId: string, xpReward: number) => {
        toggleDontDoItem(timeBlockId, itemId, xpReward);
    };

    return (
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    🚫 하지않기 체크리스트
                </h4>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    참아내면 XP 획득!
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {checklistItems.map((item) => {
                    const isChecked = dailyData?.timeBlockDontDoStatus?.[timeBlockId]?.[item.id] || false;

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleToggle(item.id, item.xpReward)}
                            className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all ${isChecked
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/50'
                                }`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div onClick={(e) => e.stopPropagation()}>
                                    <NeonCheckbox
                                        checked={isChecked}
                                        onChange={() => handleToggle(item.id, item.xpReward)}
                                        size={20}
                                    />
                                </div>
                                <span
                                    className={`truncate text-xs font-medium ${isChecked ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    {item.label}
                                </span>
                            </div>

                            <span className={`text-[10px] font-bold ${isChecked ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'
                                }`}>
                                +{item.xpReward} XP
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
