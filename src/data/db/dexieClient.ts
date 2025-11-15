/**
 * Dexie (IndexedDB) 클라이언트 설정
 *
 * @role IndexedDB를 Dexie로 관리, 앱의 모든 로컬 데이터 저장/조회 담당 (dailyData, gameState, templates, shopItems, waifuState, energyLevels, settings, chatHistory, dailyTokenUsage)
 * @input 도메인 타입 (DailyData, GameState, Template 등)
 * @output Dexie DB 인스턴스 및 헬퍼 함수
 * @dependencies Dexie, domain 타입
 */

import Dexie, { type Table } from 'dexie';
import type {
  DailyData,
  GameState,
  Template,
  ShopItem,
  WaifuState,
  EnergyLevel,
  Settings,
  ChatHistory,
  DailyTokenUsage
} from '@/shared/types/domain';

// ============================================================================
// Database Schema
// ============================================================================

/**
 * 타임블록 앱의 IndexedDB 스키마
 * - dailyData: 일일 작업 및 블록 상태 (date를 primary key로)
 * - gameState: 게임 상태 (단일 레코드, 'current' 키 사용)
 * - templates: 작업 템플릿 (id를 primary key로)
 * - shopItems: 상점 아이템 (id를 primary key로)
 * - waifuState: 와이푸 상태 (단일 레코드, 'current' 키 사용)
 * - energyLevels: 에너지 레벨 기록 (복합 id: date + timestamp)
 * - settings: 앱 설정 (단일 레코드, 'current' 키 사용)
 * - chatHistory: Gemini 채팅 히스토리 (date를 primary key로)
 * - dailyTokenUsage: 일일 토큰 사용량 (date를 primary key로)
 */
export class TimeBlockDB extends Dexie {
  // 테이블 선언
  dailyData!: Table<DailyData & { date: string }, string>;
  gameState!: Table<GameState & { key: string }, string>;
  templates!: Table<Template, string>;
  shopItems!: Table<ShopItem, string>;
  waifuState!: Table<WaifuState & { key: string }, string>;
  energyLevels!: Table<EnergyLevel & { id: string; date: string }, string>;
  settings!: Table<Settings & { key: string }, string>;
  chatHistory!: Table<ChatHistory, string>;
  dailyTokenUsage!: Table<DailyTokenUsage, string>;

  constructor() {
    super('timeblock_db');

    // 스키마 버전 1
    this.version(1).stores({
      // dailyData: date를 primary key로
      dailyData: 'date, updatedAt',

      // gameState: 'current' 키 하나만 사용
      gameState: 'key',

      // templates: id를 primary key로
      templates: 'id, name, autoGenerate',

      // shopItems: id를 primary key로
      shopItems: 'id, name',

      // waifuState: 'current' 키 하나만 사용
      waifuState: 'key',

      // energyLevels: 복합 id (date + timestamp)
      energyLevels: 'id, date, timestamp, hour',

      // settings: 'current' 키 하나만 사용
      settings: 'key',
    });

    // 스키마 버전 2 - 채팅 히스토리 및 토큰 사용량 추가
    this.version(2).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      // chatHistory: date를 primary key로
      chatHistory: 'date, updatedAt',
      // dailyTokenUsage: date를 primary key로
      dailyTokenUsage: 'date, updatedAt',
    });
  }
}

// 싱글톤 인스턴스
export const db = new TimeBlockDB();

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * DB 초기화 및 마이그레이션
 * IndexedDB를 열고, localStorage에서 데이터 마이그레이션 수행
 * @returns Promise<void>
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // IndexedDB 열기 시도
    await db.open();

    // DB 상태 확인
    await getDatabaseInfo();

    // localStorage에서 IndexedDB로 데이터 마이그레이션
    await migrateFromLocalStorage();
  } catch (error) {
    console.error('❌ Failed to initialize Dexie DB:', error);

    // IndexedDB가 막혀있으면 재생성 시도
    try {
      await db.delete();
      await db.open();

      // 재생성 후 마이그레이션
      await migrateFromLocalStorage();
    } catch (retryError) {
      console.error('❌ Failed to recreate database:', retryError);
      throw retryError;
    }
  }
}

/**
 * localStorage에서 IndexedDB로 데이터 마이그레이션
 * @returns Promise<void>
 */
async function migrateFromLocalStorage(): Promise<void> {
  try {
    let migratedCount = 0;

    // 1. dailyPlans 마이그레이션
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('dailyPlans_')) continue;

      const date = key.replace('dailyPlans_', '');

      // IndexedDB에 이미 있는지 확인
      const existing = await db.dailyData.get(date);
      if (existing) continue; // 이미 있으면 스킵

      // localStorage에서 가져오기
      const dataStr = localStorage.getItem(key);
      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);

        // IndexedDB에 저장
        await db.dailyData.put({
          date,
          tasks: data.tasks || [],
          timeBlockStates: data.timeBlockStates || {},
          updatedAt: data.updatedAt || Date.now(),
        });

        migratedCount++;
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse ${key}:`, parseError);
      }
    }

    // 2. gameState 마이그레이션
    const gameStateStr = localStorage.getItem('gameState');
    if (gameStateStr) {
      const existingGameState = await db.gameState.get('current');
      if (!existingGameState) {
        try {
          const gameState = JSON.parse(gameStateStr);
          await db.gameState.put({
            key: 'current',
            ...gameState,
          });
          migratedCount++;
        } catch (parseError) {
          console.warn('⚠️ Failed to parse gameState:', parseError);
        }
      }
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // 마이그레이션 실패해도 앱은 계속 동작
  }
}

/**
 * DB 상태 확인 (각 테이블의 레코드 수 반환)
 * @returns DB 상태 정보
 */
export async function getDatabaseInfo(): Promise<{
  dailyDataCount: number;
  templatesCount: number;
  shopItemsCount: number;
  energyLevelsCount: number;
}> {
  try {
    const [dailyDataCount, templatesCount, shopItemsCount, energyLevelsCount] = await Promise.all([
      db.dailyData.count(),
      db.templates.count(),
      db.shopItems.count(),
      db.energyLevels.count(),
    ]);

    return {
      dailyDataCount,
      templatesCount,
      shopItemsCount,
      energyLevelsCount,
    };
  } catch (error) {
    console.error('❌ Failed to get database info:', error);
    throw error;
  }
}
