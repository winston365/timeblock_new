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
    const totalCount = checklistItems.length;
    const checkedCount = checklistItems.filter(item =>
        dailyData?.timeBlockDontDoStatus?.[timeBlockId]?.[item.id]
    ).length;
    const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    if (checklistItems.length === 0) return null;

    const handleToggle = (itemId: string, xpReward: number) => {
        toggleDontDoItem(timeBlockId, itemId, xpReward);
    };

    return (
        <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        🛡️ 의지력 게이지
                    </h4>
                    {progress === 100 && (
                        <span className="animate-pulse rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                            👑 절제 마스터
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
                    {checkedCount}/{totalCount} ({Math.round(progress)}%)
                </span>
            </div>

            {/* Willpower Bar */}
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                    className={`h-full transition-all duration-500 ${progress === 100
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                        : 'bg-gradient-to-r from-blue-400 to-emerald-400'
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                {checklistItems.map((item) => {
                    const isChecked = dailyData?.timeBlockDontDoStatus?.[timeBlockId]?.[item.id] || false;

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleToggle(item.id, item.xpReward)}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${isChecked
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/40'
                                }`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div onClick={(e) => e.stopPropagation()}>
                                    <NeonCheckbox
                                        checked={isChecked}
                                        onChange={() => handleToggle(item.id, item.xpReward)}
                                        size={16}
                                    />
                                </div>
                                <span
                                    className={`truncate text-[11px] font-medium ${isChecked ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
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
