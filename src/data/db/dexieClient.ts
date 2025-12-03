/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dexie (IndexedDB) 클라이언트 설정
 *
 * @role IndexedDB를 Dexie로 관리, 앱의 모든 로컬 데이터 저장/조회 담당
 * @responsibilities
 *   - 스키마 버전 관리 및 마이그레이션
 *   - 테이블 정의 (dailyData, gameState, templates 등)
 *   - 데이터베이스 초기화 및 상태 조회
 * @key_dependencies
 *   - Dexie: IndexedDB ORM 라이브러리
 *   - @/shared/types/domain: 도메인 타입 정의
 */

import Dexie, { type Table } from 'dexie';
import type {
  DailyData,
  GameState,
  Template,
  ShopItem,
  WaifuState,
  Settings,
  ChatHistory,
  DailyTokenUsage,
  Task,
  DailyGoal,
  AIInsight,
  WeeklyGoal
} from '@/shared/types/domain';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import type { TaskCalendarMapping } from '@/shared/services/calendar/googleCalendarTypes';

/**
 * RAG 벡터 문서 레코드 타입
 * @description AI 컨텍스트 검색을 위한 벡터 임베딩 문서 저장 구조
 */
export interface RAGDocumentRecord {
  /** 문서 고유 ID */
  id: string;
  /** 문서 유형 (task, journal, goal, insight) */
  type: 'task' | 'journal' | 'goal' | 'insight';
  /** 문서 내용 */
  content: string;
  /** 문서 날짜 */
  date: string;
  /** 완료 여부 */
  completed: boolean;
  /** JSON 문자열화된 메타데이터 */
  metadata: string;
  /** 벡터 임베딩 배열 */
  embedding: number[];
  /** 변경 감지용 콘텐츠 해시 */
  contentHash: string;
  /** 인덱싱 타임스탬프 */
  indexedAt: number;
}

/**
 * TimeBlock 애플리케이션 Dexie 데이터베이스 클래스
 * @extends Dexie
 * @description 모든 로컬 데이터 저장소 테이블을 관리하는 메인 DB 클래스
 */
export class TimeBlockDB extends Dexie {
  // 테이블 선언
  dailyData!: Table<DailyData & { date: string }, string>;
  gameState!: Table<GameState & { key: string }, string>;
  templates!: Table<Template, string>;
  shopItems!: Table<ShopItem, string>;
  waifuState!: Table<WaifuState & { key: string }, string>;
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
  weeklyGoals!: Table<WeeklyGoal, string>; // ✅ 장기목표 (주간 목표)
  tempScheduleTasks!: Table<TempScheduleTask, string>; // ✅ 임시 스케줄 작업
  taskCalendarMappings!: Table<TaskCalendarMapping, string>; // ✅ Task-Calendar 매핑

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

    // 스키마 버전 13 - energyLevels 테이블 제거
    this.version(13).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
      energyLevels: null, // ✅ 테이블 삭제
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
      ragDocuments: 'id, type, date, completed, contentHash, indexedAt',
    });

    // 스키마 버전 14 - weeklyGoals 테이블 추가 (장기목표)
    this.version(14).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
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
      ragDocuments: 'id, type, date, completed, contentHash, indexedAt',
      weeklyGoals: 'id, weekStartDate, order', // ✅ 장기목표 테이블 추가
    });

    // 스키마 버전 15 - tempScheduleTasks 테이블 추가 (임시 스케줄 작업)
    this.version(15).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
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
      ragDocuments: 'id, type, date, completed, contentHash, indexedAt',
      weeklyGoals: 'id, weekStartDate, order',
      tempScheduleTasks: 'id, scheduledDate, parentId, order, createdAt', // ✅ 임시 스케줄 작업
    });

    // 스키마 버전 16 - taskCalendarMappings 테이블 추가 (Google Calendar 연동)
    this.version(16).stores({
      dailyData: 'date, updatedAt',
      gameState: 'key',
      templates: 'id, name, autoGenerate',
      shopItems: 'id, name',
      waifuState: 'key',
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
      ragDocuments: 'id, type, date, completed, contentHash, indexedAt',
      weeklyGoals: 'id, weekStartDate, order',
      tempScheduleTasks: 'id, scheduledDate, parentId, order, createdAt',
      taskCalendarMappings: 'taskId, calendarEventId, date, syncStatus', // ✅ Task-Calendar 매핑
    });
  }
}

export const db = new TimeBlockDB();

/**
 * 데이터베이스 초기화
 * @description Dexie 데이터베이스를 열고 초기 상태를 확인
 * @returns {Promise<void>}
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    await getDatabaseInfo();
  } catch (error) {
    console.error('❌ Failed to initialize Dexie DB:', error);
  }
}

/**
 * 데이터베이스 통계 정보 조회
 * @description 주요 테이블들의 레코드 수를 조회하여 반환
 * @returns {Promise<Object>} 각 테이블별 레코드 수
 * @throws {Error} 데이터베이스 조회 실패 시
 */
export async function getDatabaseInfo(): Promise<{
  dailyDataCount: number;
  templatesCount: number;
  shopItemsCount: number;
}> {
  try {
    const [dailyDataCount, templatesCount, shopItemsCount] = await Promise.all([
      db.dailyData.count(),
      db.templates.count(),
      db.shopItems.count(),
    ]);

    return {
      dailyDataCount,
      templatesCount,
      shopItemsCount,
    };
  } catch (error) {
    console.error('❌ Failed to get database info:', error);
    throw error;
  }
}
