/**
 * Dexie (IndexedDB) 클라이언트 설정
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
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('✅ Dexie DB initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Dexie DB:', error);
    throw error;
  }
}

/**
 * 오래된 데이터 정리 (선택적)
 * @param daysToKeep 보관할 일 수 (기본: 365일)
 */
export async function cleanupOldData(daysToKeep: number = 365): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // dailyData 정리
    const deletedDailyData = await db.dailyData
      .where('date')
      .below(cutoffDateStr)
      .delete();

    // energyLevels 정리
    const deletedEnergyLevels = await db.energyLevels
      .where('date')
      .below(cutoffDateStr)
      .delete();

    console.log(`🗑️ Cleaned up old data: ${deletedDailyData} daily records, ${deletedEnergyLevels} energy records`);
  } catch (error) {
    console.error('❌ Failed to cleanup old data:', error);
  }
}

/**
 * DB 전체 초기화 (개발용)
 */
export async function resetDatabase(): Promise<void> {
  try {
    await db.delete();
    console.log('🗑️ Database reset successfully');
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    throw error;
  }
}

/**
 * DB 상태 확인
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
