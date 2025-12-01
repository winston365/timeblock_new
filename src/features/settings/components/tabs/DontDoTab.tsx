/**
 * @fileoverview DontDoTab - "하지않기" 체크리스트 관리 탭 컴포넌트
 *
 * @description
 * Role: "하지않기" 체크리스트 항목 관리 탭 (습관 억제 보상 시스템)
 *
 * Responsibilities:
 * - 하지않기 체크리스트 항목 CRUD (생성, 수정, 삭제)
 * - 항목 순서 변경 (위/아래 이동)
 * - XP 보상 값 설정
 *
 * Key Dependencies:
 * - types: DontDoTabProps, Settings, DontDoChecklistItem 타입 정의
 * - styles: 공통 스타일 클래스
 */

import type { DontDoTabProps, Settings, DontDoChecklistItem } from './types';
import { sectionClass, infoBoxClass } from './styles';

/**
 * "하지않기" 체크리스트 항목을 관리하는 탭 컴포넌트
 *
 * 사용자가 피해야 할 행동을 정의하고, 해당 행동을 참았을 때
 * 획득할 수 있는 XP 보상을 설정할 수 있습니다.
 *
 * @param props - 탭 컴포넌트 props
 * @param props.localSettings - 현재 로컬 설정 상태
 * @param props.setLocalSettings - 설정 상태 업데이트 함수
 * @returns 체크리스트 CRUD UI
 */
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
