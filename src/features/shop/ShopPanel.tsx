/**
 * ShopPanel
 *
 * @role XP로 구매할 수 있는 보상 아이템 목록을 표시하고 구매를 관리하는 상점 패널 컴포넌트
 * @input onPurchaseSuccess (function, optional) - 구매 성공 시 콜백
 * @output 상점 아이템 목록, 보유 XP 표시, 구매/편집/삭제 버튼을 포함한 UI
 * @external_dependencies
 *   - loadShopItems, deleteShopItem, purchaseShopItem: 상점 아이템 Repository
 *   - useGameState: 게임 상태 훅 (보유 XP 확인)
 *   - ShopModal: 아이템 추가/편집 모달 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { ShopItem } from '@/shared/types/domain';
import { loadShopItems, deleteShopItem, purchaseShopItem, useShopItem } from '@/data/repositories';
import { useGameState } from '@/shared/hooks';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { ShopModal } from './ShopModal';
import { toast } from 'react-hot-toast';

interface ShopPanelProps {
  onPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
}

/**
 * 상점 패널 컴포넌트
 */
export default function ShopPanel({ onPurchaseSuccess }: ShopPanelProps) {
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { gameState, refresh: refreshGameState } = useGameState();
  const { refresh: refreshWaifuState } = useWaifu();

  // 상점 아이템 로드
  useEffect(() => {
    loadShopItemsData();
  }, []);

  const loadShopItemsData = async () => {
    const data = await loadShopItems();
    setShopItems(data);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: ShopItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;

    try {
      await deleteShopItem(id);
      await loadShopItemsData();
    } catch (error) {
      console.error('Failed to delete shop item:', error);
      toast.error('상품 삭제에 실패했습니다.');
    }
  };

  const handleModalClose = async (saved: boolean) => {
    setIsModalOpen(false);
    setEditingItem(null);

    if (saved) {
      await loadShopItemsData();
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!gameState) return;

    if (gameState.availableXP < item.price) {
      toast.error(`XP가 부족합니다! 필요: ${item.price} XP · 보유: ${gameState.availableXP} XP`);
      return;
    }

    if (!confirm(`${item.name}을(를) ${item.price} XP로 구매하시겠습니까?`)) {
      return;
    }

    setIsPurchasing(true);

    try {
      const result = await purchaseShopItem(item.id);

      if (result.success) {
        toast.success(result.message);

        // Optimistic UI 업데이트
        setShopItems(prevItems =>
          prevItems.map(i =>
            i.id === item.id
              ? { ...i, quantity: (i.quantity || 0) + 1 }
              : i
          )
        );

        await refreshGameState();
        await refreshWaifuState();

        if (onPurchaseSuccess && result.waifuMessage) {
          onPurchaseSuccess(result.message, result.waifuMessage);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to purchase item:', error);
      toast.error('구매 중 오류가 발생했습니다.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const canAfford = (price: number): boolean => {
    return gameState ? gameState.availableXP >= price : false;
  };

  const handleUseItem = async (item: ShopItem) => {
    const quantity = item.quantity || 0;
    if (quantity <= 0) {
      toast.error('보유한 아이템이 없습니다.');
      return;
    }

    try {
      const result = await useShopItem(item.id);

      if (result.success) {
        toast.success(result.message);

        setShopItems(prevItems =>
          prevItems.map(i =>
            i.id === item.id
              ? { ...i, quantity: Math.max((i.quantity || 0) - 1, 0) }
              : i
          )
        );

        if (onPurchaseSuccess && result.waifuMessage) {
          onPurchaseSuccess(result.message, result.waifuMessage);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to use item:', error);
      toast.error('아이템 사용 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <h3 className="text-sm font-bold text-[var(--color-text)]">🛒 상점</h3>
        <button
          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
          onClick={handleAddItem}
          title="상품 추가"
        >
          + 추가
        </button>
      </div>

      {gameState && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)]">
          <span>보유 XP</span>
          <span className="text-sm font-bold text-[var(--color-reward)]">{gameState.availableXP.toLocaleString()} XP</span>
        </div>
      )}

      {shopItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-12 text-center text-xs text-[var(--color-text-secondary)]">
          <p className="text-sm font-medium text-[var(--color-text)]">등록된 상품이 없습니다</p>
          <p className="mt-1">XP로 구매할 수 있는 보상을 추가하세요!</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {shopItems.map(item => {
            const affordable = canAfford(item.price);
            return (
              <div
                key={item.id}
                className={`flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-all hover:border-[var(--color-primary)]/30 ${!affordable ? 'opacity-70' : ''
                  }`}
              >
                {item.image && (
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)]">
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[var(--color-text)]">{item.name}</strong>
                    <span className="text-xs font-bold text-[var(--color-reward)]">{item.price.toLocaleString()} XP</span>
                  </div>
                  {item.quantity !== undefined && item.quantity > 0 && (
                    <span className="text-[10px] font-medium text-[var(--color-primary)]">보유: {item.quantity}개</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white transition-all active:scale-95 ${affordable
                      ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] shadow-sm'
                      : 'bg-[var(--color-bg-interactive)] cursor-not-allowed text-[var(--color-text-tertiary)]'
                      }`}
                    onClick={() => handlePurchase(item)}
                    disabled={!affordable || isPurchasing}
                  >
                    {affordable ? '구매' : '부족'}
                  </button>

                  {item.quantity !== undefined && item.quantity > 0 && (
                    <button
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
                      onClick={() => handleUseItem(item)}
                    >
                      사용
                    </button>
                  )}

                  <button
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-xs text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
                    onClick={() => handleEditItem(item)}
                  >
                    ✏️
                  </button>

                  <button
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-xs text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <ShopModal
          item={editingItem}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
