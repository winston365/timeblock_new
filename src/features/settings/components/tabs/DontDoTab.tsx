/**
 * DontDoTab
 *
 * @role "하지않기" 체크리스트 항목 관리 탭 (습관 억제 보상 시스템)
 * @input DontDoTabProps (localSettings, setLocalSettings)
 * @output 체크리스트 CRUD UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import type { DontDoTabProps, Settings, DontDoChecklistItem } from './types';
import { sectionClass, infoBoxClass } from './styles';

export function DontDoTab({ localSettings, setLocalSettings }: DontDoTabProps) {
    const handleDontDoItemChange = (id: string, updates: Partial<DontDoChecklistItem>) => {
        setLocalSettings((prev: Settings | null) => {
            if (!prev) return prev;
            const currentList = prev.dontDoChecklist || [];
            return {
                ...prev,
                dontDoChecklist: currentList.map((item: DontDoChecklistItem) =>
                    item.id === id ? { ...item, ...updates } : item
                )
            };
        });
    };

    const handleAddItem = () => {
        const newItem: DontDoChecklistItem = {
            id: `dontdo-${Date.now()}`,
            label: '',
            xpReward: 15,
            order: (localSettings?.dontDoChecklist || []).length
        };
        setLocalSettings((prev: Settings | null) => prev ? ({
            ...prev,
            dontDoChecklist: [...(prev.dontDoChecklist || []), newItem]
        }) : prev);
    };

    const handleDeleteItem = (id: string) => {
        setLocalSettings((prev: Settings | null) => prev ? ({
            ...prev,
            dontDoChecklist: (prev.dontDoChecklist || []).filter((i: DontDoChecklistItem) => i.id !== id)
        }) : prev);
    };

    const handleMoveUp = (index: number) => {
        if (index > 0) {
            setLocalSettings((prev: Settings | null) => {
                if (!prev) return prev;
                const newItems = [...(prev.dontDoChecklist || [])];
                [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                return { ...prev, dontDoChecklist: newItems };
            });
        }
    };

    const handleMoveDown = (index: number) => {
        if (index < (localSettings?.dontDoChecklist || []).length - 1) {
            setLocalSettings((prev: Settings | null) => {
                if (!prev) return prev;
                const newItems = [...(prev.dontDoChecklist || [])];
                [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
                return { ...prev, dontDoChecklist: newItems };
            });
        }
    };

    return (
        <div className={sectionClass}>
            <div className={infoBoxClass}>
                <strong>🚫 하지않기 체크리스트:</strong> 하지 말아야 할 행동들을 정의하고, 이를 참았을 때 얻을 수 있는 XP 보상을 설정하세요.
                타임블록에서 해당 항목을 체크하면 XP를 획득합니다.
            </div>

            <div className="flex flex-col gap-3">
                {(localSettings?.dontDoChecklist || []).map((item: DontDoChecklistItem, index: number) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] disabled:opacity-30"
                            >
                                ▲
                            </button>
                            <button
                                onClick={() => handleMoveDown(index)}
                                disabled={index === (localSettings?.dontDoChecklist || []).length - 1}
                                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] disabled:opacity-30"
                            >
                                ▼
                            </button>
                        </div>

                        <div className="flex-1">
                            <input
                                type="text"
                                value={item.label}
                                onChange={(e) => handleDontDoItemChange(item.id, { label: e.target.value })}
                                className="w-full bg-transparent text-sm font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                                placeholder="항목 이름 (예: 유튜브 보지 않기)"
                            />
                        </div>

                        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-tertiary)] px-3 py-1.5">
                            <span className="text-xs text-[var(--color-text-secondary)]">XP</span>
                            <input
                                type="number"
                                value={item.xpReward}
                                onChange={(e) => handleDontDoItemChange(item.id, { xpReward: Number(e.target.value) })}
                                className="w-16 bg-transparent text-right text-sm font-bold text-[var(--color-primary)] outline-none"
                            />
                        </div>

                        <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="ml-2 rounded-xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-red-500"
                            title="삭제"
                        >
                            🗑️
                        </button>
                    </div>
                ))}

                <button
                    onClick={handleAddItem}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                    <span>➕ 새 항목 추가</span>
                </button>
            </div>
        </div>
    );
}
