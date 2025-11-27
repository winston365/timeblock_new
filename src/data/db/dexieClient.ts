/**
 * Dexie (IndexedDB) 클라이언트 설정
 *
 * @role IndexedDB를 Dexie로 관리, 앱의 모든 로컬 데이터 저장/조회 담당
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
  DailyGoal,
  AIInsight
} from '@/shared/types/domain';

// RAG 벡터 문서 타입
export interface RAGDocumentRecord {
  id: string;
  type: 'task' | 'journal' | 'goal' | 'insight';
  content: string;
  date: string;
  completed: boolean;
  metadata: string; // JSON stringified
  embedding: number[];
  contentHash: string; // 변경 감지용 해시
  indexedAt: number; // 인덱싱 시간
}

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
  completedInbox!: Table<Task, string>;
  globalGoals!: Table<DailyGoal, string>;
  systemState!: Table<{ key: string; value: any }, string>;
  images!: Table<{ id: string; data: Blob | string }, string>;
  weather!: Table<{ id: string; data: any; timestamp: number; lastUpdatedDate: string }, string>;
  aiInsights!: Table<AIInsight, string>;
  ragDocuments!: Table<RAGDocumentRecord, string>; // ✅ RAG 벡터 영구 저장

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
    });

    // 스키마 버전 6
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

    // 스키마 버전 7
    this.version(7).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
    }).upgrade(async (tx) => {
      const completedTasks = await tx.table('globalInbox').where('completed').equals(1).toArray(); // Dexie boolean index fix
      if (completedTasks.length > 0) {
        await tx.table('completedInbox').bulkAdd(completedTasks);
        const completedIds = completedTasks.map((t: Task) => t.id);
        await tx.table('globalInbox').bulkDelete(completedIds);
      }
    });

    // 스키마 버전 8
    this.version(8).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
    }).upgrade(async (tx) => {
      const settings = await tx.table('settings').get('current');
      if (settings && !settings.dontDoChecklist) {
        settings.dontDoChecklist = [
          { id: 'dnd-1', label: '메신저 쓰기', xpReward: 15, order: 0 },
          { id: 'dnd-2', label: '누워있기', xpReward: 15, order: 1 },
          { id: 'dnd-3', label: 'SNS 보기', xpReward: 15, order: 2 },
          { id: 'dnd-4', label: '무분별한 유튜브 시청', xpReward: 15, order: 3 },
          { id: 'dnd-5', label: '게임하기', xpReward: 15, order: 4 },
          { id: 'dnd-6', label: '음식 배달 주문', xpReward: 15, order: 5 },
        ];
        await tx.table('settings').put(settings);
      }
    });

    // 스키마 버전 9
    this.version(9).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
      images: 'id',
    });

    // 스키마 버전 10 - 날씨 캐시 추가
    this.version(10).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
      images: 'id',
      weather: 'id', // ✅ 날씨 캐시
    });

    // 스키마 버전 11 - AI 인사이트 추가
    this.version(11).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
      images: 'id',
      weather: 'id',
      aiInsights: 'date', // ✅ AI 인사이트
    });

    // 스키마 버전 12 - RAG 벡터 영구 저장소 추가
    this.version(12).stores({
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
      completedInbox: 'id, completedAt, createdAt',
      globalGoals: 'id, createdAt, order',
      systemState: 'key',
      images: 'id',
      weather: 'id',
      aiInsights: 'date',
      ragDocuments: 'id, type, date, completed, contentHash, indexedAt', // ✅ RAG 벡터 영구 저장
    });
  }
}

export const db = new TimeBlockDB();

export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    await getDatabaseInfo();
  } catch (error) {
    console.error('❌ Failed to initialize Dexie DB:', error);
  }
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
