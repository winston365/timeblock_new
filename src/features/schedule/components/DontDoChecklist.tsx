import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';

interface DontDoChecklistProps {
    timeBlockId: string;
}

// systemRepository에서 접기 상태 로드
async function loadCollapsedState(): Promise<boolean> {
    try {
        const state = await getSystemState<boolean>(SYSTEM_KEYS.DONT_DO_COLLAPSED);
        return state ?? true; // 기본값: 접힘
    } catch {
        return true;
    }
}

// systemRepository에 접기 상태 저장
async function saveCollapsedState(collapsed: boolean): Promise<void> {
    try {
        await setSystemState(SYSTEM_KEYS.DONT_DO_COLLAPSED, collapsed);
    } catch (error) {
        console.error('Failed to save collapsed state:', error);
    }
}

export const DontDoChecklist: React.FC<DontDoChecklistProps> = ({ timeBlockId }) => {
    const { settings } = useSettingsStore();
    const { dailyData, toggleDontDoItem } = useDailyDataStore();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);

    const checklistItems = settings?.dontDoChecklist || [];

    // 초기 로드 시 Dexie에서 접기 상태 불러오기
    useEffect(() => {
        loadCollapsedState().then((collapsed) => {
            setIsCollapsed(collapsed);
            setIsLoaded(true);
        });
    }, []);

    const handleToggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        saveCollapsedState(newState);
    };

    if (checklistItems.length === 0) return null;

    const handleToggle = (itemId: string, xpReward: number) => {
        toggleDontDoItem(timeBlockId, itemId, xpReward);
    };

    // 체크된 항목 수 계산
    const checkedCount = checklistItems.filter(
        (item) => dailyData?.timeBlockDontDoStatus?.[timeBlockId]?.[item.id]
    ).length;

    return (
        <div className="flex flex-col border-b border-[var(--color-border)] px-3 py-2">
            <button
                type="button"
                onClick={handleToggleCollapse}
                className="flex items-center justify-between w-full text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        🚫 하지않기
                    </span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        {checkedCount}/{checklistItems.length}
                    </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    {isCollapsed ? '▼ 펼치기' : '▲ 접기'}
                </span>
            </button>

            {!isCollapsed && isLoaded && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
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
                                    +{item.xpReward}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
