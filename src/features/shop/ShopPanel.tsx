/**
 * ShopPanel - 상점 아이템 목록 및 구매
 */

import { useState, useEffect } from 'react';
import type { ShopItem } from '@/shared/types/domain';
import { loadShopItems, deleteShopItem, purchaseShopItem } from '@/data/repositories';
import { useGameState } from '@/shared/hooks';
import { ShopModal } from './ShopModal';
import './shop.css';

interface ShopPanelProps {
  onPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
}

export default function ShopPanel({ onPurchaseSuccess }: ShopPanelProps) {
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { gameState } = useGameState();

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
      alert('상품 삭제에 실패했습니다.');
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
      alert(`XP가 부족합니다!\n필요: ${item.price} XP\n보유: ${gameState.availableXP} XP`);
      return;
    }

    if (!confirm(`${item.name}을(를) ${item.price} XP로 구매하시겠습니까?`)) {
      return;
    }

    setIsPurchasing(true);

    try {
      const result = await purchaseShopItem(item.id);

      if (result.success) {
        alert(result.message);

        // 부모 컴포넌트에 구매 성공 알림 (와이푸 메시지 표시)
        if (onPurchaseSuccess && result.waifuMessage) {
          onPurchaseSuccess(result.message, result.waifuMessage);
        }
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Failed to purchase item:', error);
      alert('구매 중 오류가 발생했습니다.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const canAfford = (price: number): boolean => {
    return gameState ? gameState.availableXP >= price : false;
  };

  return (
    <div className="shop-panel">
      <div className="shop-header">
        <h3>🛒 상점</h3>
        <button
          className="btn-add-shop-item"
          onClick={handleAddItem}
          title="상품 추가"
        >
          + 추가
        </button>
      </div>

      {gameState && (
        <div className="shop-xp-display">
          <span className="shop-xp-label">보유 XP:</span>
          <span className="shop-xp-value">{gameState.availableXP}</span>
        </div>
      )}

      {shopItems.length === 0 ? (
        <div className="shop-empty">
          <p>등록된 상품이 없습니다.</p>
          <p className="shop-hint">XP로 구매할 수 있는 보상을 추가하세요!</p>
        </div>
      ) : (
        <div className="shop-list">
          {shopItems.map(item => (
            <div
              key={item.id}
              className={`shop-item ${!canAfford(item.price) ? 'shop-item-disabled' : ''}`}
            >
              {item.image && (
                <div className="shop-item-image">
                  <img src={item.image} alt={item.name} />
                </div>
              )}

              <div className="shop-item-body">
                <strong className="shop-item-name">{item.name}</strong>
                <p className="shop-item-price">💰 {item.price} XP</p>
              </div>

              <div className="shop-item-actions">
                <button
                  className="btn-shop-purchase"
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford(item.price) || isPurchasing}
                  title={canAfford(item.price) ? '구매하기' : 'XP 부족'}
                >
                  {canAfford(item.price) ? '구매' : '💰 부족'}
                </button>
                <button
                  className="btn-shop-edit"
                  onClick={() => handleEditItem(item)}
                  title="상품 편집"
                >
                  ✏️
                </button>
                <button
                  className="btn-shop-delete"
                  onClick={() => handleDeleteItem(item.id)}
                  title="상품 삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
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
