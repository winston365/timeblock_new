/**
 * Shop Repository
 *
 * @role 상점 아이템 데이터 관리 및 구매 트랜잭션 처리
 * @input ShopItem 객체, 아이템 ID, 구매 요청
 * @output ShopItem 배열, ShopItem 객체, PurchaseResult 객체
 * @external_dependencies
 *   - IndexedDB (db.shopItems): 메인 저장소
 *   - localStorage (STORAGE_KEYS.SHOP_ITEMS): 백업 저장소
 *   - gameStateRepository: XP 소비 로직
 *   - waifuRepository: 호감도 증가 로직
 *   - @/shared/types/domain: ShopItem 타입
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
 *
 * @returns {Promise<ShopItem[]>} 상점 아이템 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
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
 *
 * @param {string} name - 아이템 이름
 * @param {number} price - 아이템 가격 (XP)
 * @param {string} [image] - 아이템 이미지 URL (선택)
 * @returns {Promise<ShopItem>} 생성된 상점 아이템
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 아이템 저장
 *   - localStorage에 백업
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

    return item;
  } catch (error) {
    console.error('Failed to create shop item:', error);
    throw error;
  }
}

/**
 * 상점 아이템 업데이트
 *
 * @param {string} id - 아이템 ID
 * @param {Partial<Omit<ShopItem, 'id'>>} updates - 업데이트할 필드
 * @returns {Promise<ShopItem>} 업데이트된 상점 아이템
 * @throws {Error} 아이템이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 아이템 조회 및 업데이트
 *   - localStorage에 백업
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

    return updatedItem;
  } catch (error) {
    console.error('Failed to update shop item:', error);
    throw error;
  }
}

/**
 * 상점 아이템 삭제
 *
 * @param {string} id - 삭제할 아이템 ID
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 삭제 실패 시
 * @sideEffects
 *   - IndexedDB에서 아이템 삭제
 *   - localStorage에 변경사항 반영
 */
export async function deleteShopItem(id: string): Promise<void> {
  try {
    await db.shopItems.delete(id);

    // localStorage에도 반영
    const items = await loadShopItems();
    saveToStorage(STORAGE_KEYS.SHOP_ITEMS, items);

  } catch (error) {
    console.error('Failed to delete shop item:', error);
    throw error;
  }
}

/**
 * 특정 상점 아이템 조회
 *
 * @param {string} id - 아이템 ID
 * @returns {Promise<ShopItem | undefined>} 아이템 객체 또는 undefined
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
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
 *
 * @param {string} itemId - 구매할 아이템 ID
 * @returns {Promise<PurchaseResult>} 구매 결과 (성공 여부, 메시지, 와이푸 메시지)
 * @throws 없음
 * @sideEffects
 *   - gameStateRepository를 통해 XP 차감
 *   - waifuRepository를 통해 호감도 증가 (+10)
 *   - 와이푸 상호작용 횟수 증가
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
 *
 * @param {string} itemId - 확인할 아이템 ID
 * @returns {Promise<boolean>} 구매 가능 여부
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 아이템 및 게임 상태 조회
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
