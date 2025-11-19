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
  DailyTokenUsage,
  Task,
  DailyGoal
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
 * - globalInbox: 전역 인박스 작업 (날짜 독립적, id를 primary key로)
 * - globalGoals: 전역 목표 (날짜 독립적, id를 primary key로)
 * - systemState: 시스템 상태 (key를 primary key로)
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
  globalInbox!: Table<Task, string>;
  globalGoals!: Table<DailyGoal, string>;
  systemState!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('timeblock_db');

    // 스키마 버전 1
    this.version(1).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
    });

    // 스키마 버전 2
    this.version(2).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      chatHistory: 'date, updatedAt',
      dailyTokenUsage: 'date, updatedAt',
    });

    // 스키마 버전 3
    this.version(3).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      chatHistory: 'date, updatedAt',
      dailyTokenUsage: 'date, updatedAt',
      globalInbox: 'id, createdAt, completed',
    }).upgrade(async (tx) => {
      // ... (migration logic same as before)
    });

    // 스키마 버전 4
    this.version(4).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      chatHistory: 'date, updatedAt',
      dailyTokenUsage: 'date, updatedAt',
      globalInbox: 'id, createdAt, completed',
    }).upgrade(async (tx) => {
      // ... (migration logic same as before)
    });

    // 스키마 버전 5
    this.version(5).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      chatHistory: 'date, updatedAt',
      dailyTokenUsage: 'date, updatedAt',
      globalInbox: 'id, createdAt, completed',
      globalGoals: 'id, createdAt, order',
    }).upgrade(async (tx) => {
      // ... (migration logic same as before)
    });

    // 스키마 버전 6 - 시스템 상태 추가
    this.version(6).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: 'id, date, timestamp, hour',
      settings: 'key',
      chatHistory: 'date, updatedAt',
      dailyTokenUsage: 'date, updatedAt',
      globalInbox: 'id, createdAt, completed',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
    });
  }
}

// 싱글톤 인스턴스
export const db = new TimeBlockDB();

// ============================================================================
// Database Helpers
// ============================================================================

export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    await getDatabaseInfo();
    await migrateFromLocalStorage();
  } catch (error) {
    console.error('❌ Failed to initialize Dexie DB:', error);
    try {
      await db.delete();
      await db.open();
      await migrateFromLocalStorage();
    } catch (retryError) {
      console.error('❌ Failed to recreate database:', retryError);
      throw retryError;
    }
  }
}

async function migrateFromLocalStorage(): Promise<void> {
  // ... (migration logic same as before)
}

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
