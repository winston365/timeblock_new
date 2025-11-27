/**
 * InventoryPanel
 *
 * @role 룰렛 등에서 획득한 아이템(휴식권 등)을 표시하고 사용할 수 있는 인벤토리 패널
 * @input none
 * @output 인벤토리 아이템 목록, 사용 버튼을 포함한 UI
 * @external_dependencies
 *   - useGameStateStore: 게임 상태 스토어 (인벤토리 데이터)
 *   - INVENTORY_ITEMS: 아이템 메타데이터
 */

import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { INVENTORY_ITEMS, type InventoryItemType } from '@/shared/types/domain';
import { toast } from 'react-hot-toast';

export default function InventoryPanel() {
    const { gameState, useItem } = useGameStateStore();

    const inventory = gameState?.inventory || {};
    const inventoryEntries = Object.entries(inventory).filter(([_, quantity]) => quantity > 0);

    const handleUseItem = async (itemId: string) => {
        const itemMeta = INVENTORY_ITEMS[itemId as InventoryItemType];
        if (!itemMeta) {
            toast.error('알 수 없는 아이템입니다.');
            return;
        }

        try {
            await useItem(itemId);
            toast.success(`${itemMeta.label}을(를) 사용했습니다! ${itemMeta.description}`);
        } catch (error) {
            console.error('Failed to use item:', error);
            toast.error('아이템 사용 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
                <h3 className="text-sm font-bold text-[var(--color-text)]">🎒 인벤토리</h3>
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {inventoryEntries.length}개 아이템
                </span>
            </div>

            {inventoryEntries.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-12 text-center text-xs text-[var(--color-text-secondary)]">
                    <p className="text-sm font-medium text-[var(--color-text)]">보유한 아이템이 없습니다</p>
                    <p className="mt-1">룰렛에서 휴식권을 획득해보세요!</p>
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {inventoryEntries.map(([itemId, quantity]) => {
                        const itemMeta = INVENTORY_ITEMS[itemId as InventoryItemType];
                        if (!itemMeta) return null;

                        return (
                            <div
                                key={itemId}
                                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-all hover:border-[var(--color-primary)]/30"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{itemMeta.icon}</span>
                                        <div className="flex flex-col">
                                            <strong className="text-sm text-[var(--color-text)]">{itemMeta.label}</strong>
                                            <span className="text-xs text-[var(--color-text-secondary)]">
                                                {itemMeta.description}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-[var(--color-primary)]">
                                        x{quantity}
                                    </span>
                                </div>

                                <button
                                    className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] active:scale-95"
                                    onClick={() => handleUseItem(itemId)}
                                >
                                    사용하기
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
