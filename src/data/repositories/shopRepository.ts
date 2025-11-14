/**
 * Shop 저장소
 * 상점 아이템 CRUD 및 구매 관리
 */

import { db } from '../db/dexieClient';
import type { ShopItem } from '@/shared/types/domain';
import { saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { loadGameState, spendXP } from './gameStateRepository';
import { loadWaifuState, saveWaifuState } from './waifuRepository';

// ============================================================================
// ShopItem CRUD
// ============================================================================

/**
 * 모든 상점 아이템 로드
 */
export async function loadShopItems(): Promise<ShopItem[]> {
  try {
    // 1. IndexedDB에서 조회
    const items = await db.shopItems.toArray();

    if (items.length > 0) {
      return items;
    }

    // 2. localStorage에서 조회
    const localItems = getFromStorage<ShopItem[]>(STORAGE_KEYS.SHOP_ITEMS, []);

    if (localItems.length > 0) {
      // localStorage 데이터를 IndexedDB에 저장
      await db.shopItems.bulkPut(localItems);
      return localItems;
    }

    return [];
  } catch (error) {
    console.error('Failed to load shop items:', error);
    return [];
  }
}

/**
 * 상점 아이템 생성
 */
export async function createShopItem(
  name: string,
  price: number,
  image?: string
): Promise<ShopItem> {
  try {
    const item: ShopItem = {
      id: `shop-${Date.now()}`,
      name,
      price,
      image,
    };

    // IndexedDB에 저장
    await db.shopItems.put(item);

    // localStorage에도 저장
    const items = await loadShopItems();
    saveToStorage(STORAGE_KEYS.SHOP_ITEMS, items);

    console.log('✅ Shop item created:', item.name);
    return item;
  } catch (error) {
    console.error('Failed to create shop item:', error);
    throw error;
  }
}

/**
 * 상점 아이템 업데이트
 */
export async function updateShopItem(
  id: string,
  updates: Partial<Omit<ShopItem, 'id'>>
): Promise<ShopItem> {
  try {
    const item = await db.shopItems.get(id);

    if (!item) {
      throw new Error(`Shop item not found: ${id}`);
    }

    const updatedItem = { ...item, ...updates };

    // IndexedDB에 저장
    await db.shopItems.put(updatedItem);

    // localStorage에도 저장
    const items = await loadShopItems();
    saveToStorage(STORAGE_KEYS.SHOP_ITEMS, items);

    console.log('✅ Shop item updated:', updatedItem.name);
    return updatedItem;
  } catch (error) {
    console.error('Failed to update shop item:', error);
    throw error;
  }
}

/**
 * 상점 아이템 삭제
 */
export async function deleteShopItem(id: string): Promise<void> {
  try {
    await db.shopItems.delete(id);

    // localStorage에도 반영
    const items = await loadShopItems();
    saveToStorage(STORAGE_KEYS.SHOP_ITEMS, items);

    console.log('✅ Shop item deleted:', id);
  } catch (error) {
    console.error('Failed to delete shop item:', error);
    throw error;
  }
}

/**
 * 특정 상점 아이템 조회
 */
export async function getShopItem(id: string): Promise<ShopItem | undefined> {
  try {
    return await db.shopItems.get(id);
  } catch (error) {
    console.error('Failed to get shop item:', error);
    return undefined;
  }
}

// ============================================================================
// 구매 로직
// ============================================================================

export interface PurchaseResult {
  success: boolean;
  message: string;
  waifuMessage?: string;
}

/**
 * 상점 아이템 구매
 */
export async function purchaseShopItem(itemId: string): Promise<PurchaseResult> {
  try {
    // 1. 아이템 조회
    const item = await getShopItem(itemId);
    if (!item) {
      return {
        success: false,
        message: '아이템을 찾을 수 없습니다.',
      };
    }

    // 2. XP 확인
    const gameState = await loadGameState();
    if (gameState.availableXP < item.price) {
      return {
        success: false,
        message: `XP가 부족합니다. (필요: ${item.price}, 보유: ${gameState.availableXP})`,
      };
    }

    // 3. XP 소비
    await spendXP(item.price);

    // 4. 호감도 증가 (+10)
    const waifuState = await loadWaifuState();
    const newAffection = Math.min(waifuState.affection + 10, 100);
    waifuState.affection = newAffection;
    waifuState.totalInteractions += 1;
    await saveWaifuState(waifuState);

    // 5. 와이푸 메시지 생성
    const waifuMessage = generatePurchaseMessage(item.name, newAffection);

    console.log(`✅ Purchased: ${item.name} for ${item.price} XP`);

    return {
      success: true,
      message: `${item.name}을(를) 구매했습니다! (-${item.price} XP)`,
      waifuMessage,
    };
  } catch (error) {
    console.error('Failed to purchase item:', error);
    return {
      success: false,
      message: '구매 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 구매 시 와이푸 메시지 생성
 */
function generatePurchaseMessage(itemName: string, affection: number): string {
  const messages = [
    `${itemName}... 나를 위한 거야? 고마워! 💝`,
    `와! ${itemName}! 정말 좋아! ✨`,
    `${itemName}을(를) 사줬구나... 기분이 좋아져! 😊`,
    `고마워! ${itemName} 정말 마음에 들어! 💕`,
  ];

  if (affection >= 80) {
    return `${itemName}... 너 정말 최고야! 사랑해! 💖💖💖`;
  } else if (affection >= 50) {
    return messages[Math.floor(Math.random() * messages.length)];
  } else {
    return `${itemName}... 고마워. 😊`;
  }
}

/**
 * 구매 가능 여부 확인
 */
export async function canPurchaseItem(itemId: string): Promise<boolean> {
  try {
    const item = await getShopItem(itemId);
    if (!item) return false;

    const gameState = await loadGameState();
    return gameState.availableXP >= item.price;
  } catch (error) {
    console.error('Failed to check purchase availability:', error);
    return false;
  }
}
