/**
 * 도메인 타입 정의
 *
 * @role 타임블록 앱의 핵심 도메인 타입 정의 (Task, GameState, Template, Waifu 등)
 * @input 없음 (타입 정의 파일)
 * @output TypeScript 타입 및 인터페이스
 * @dependencies 없음
 */

// AI 서비스 타입 import
import type { TokenUsage } from '@/shared/services/ai/gemini/types';

import type { DontDoChecklistItem, Task, TimeSlotTagTemplate } from './domain/task.types';

export * from './domain/index';

// ============================================================================
// Game State 타입
// ============================================================================

/**
 * 일일 퀘스트 타입
 */
export interface Quest {
  id: string;
  type: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer';
  title: string;
  description: string;
  target: number; // 목표값
  progress: number; // 현재 진행도
  completed: boolean;
  /** 퀘스트 완료 시 보상 XP */
  reward?: number;
}

/**
 * 게임 상태 타입
 * XP, 퀘스트, 점화 시스템 등 게임화 관련 모든 상태
 */
export interface GameState {
  // XP
  totalXP: number;
  dailyXP: number;
  availableXP: number;

  // 연속 출석
  streak: number;
  lastLogin: string; // YYYY-MM-DD

  // 퀘스트 시스템
  dailyQuests: Quest[];
  questBonusClaimed: boolean;

  // XP 히스토리
  xpHistory: Array<{ date: string; xp: number }>;

  // 타임블록 XP
  timeBlockXP: Record<string, number>; // 블록별 XP
  timeBlockXPHistory: Array<{ date: string; blocks: Record<string, number> }>; // 블록별 XP 히스토리

  // 완료 작업 히스토리
  completedTasksHistory: Task[];

  // 타이머 사용 통계
  dailyTimerCount: number; // 오늘 타이머 사용 횟수 (몰입 작업 수)

  // 인벤토리
  inventory: Record<string, number>; // 아이템 인벤토리 (itemId -> quantity)
}

// ============================================================================
// Inventory & Roulette 타입
// ============================================================================

/**
 * 아이템 희귀도
 */
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * 인벤토리 아이템 타입
 */
export type InventoryItemType =
  | 'rest_ticket_30'
  | 'rest_ticket_60'
  | 'rest_ticket_120';

/**
 * 인벤토리 아이템 메타데이터
 */
export interface InventoryItemMeta {
  id: InventoryItemType;
  label: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  weight: number; // 룰렛 가중치 (1-100)
}

/**
 * 인벤토리 아이템 정의
 */
export const INVENTORY_ITEMS: Record<InventoryItemType, InventoryItemMeta> = {
  rest_ticket_30: {
    id: 'rest_ticket_30',
    label: '30분 휴식권',
    description: '30분간 휴식할 수 있는 권리',
    icon: '☕',
    rarity: 'common',
    weight: 20,
  },
  rest_ticket_60: {
    id: 'rest_ticket_60',
    label: '1시간 휴식권',
    description: '1시간 동안 자유롭게 휴식',
    icon: '🛌',
    rarity: 'rare',
    weight: 10,
  },
  rest_ticket_120: {
    id: 'rest_ticket_120',
    label: '2시간 휴식권',
    description: '2시간 동안 완전한 자유',
    icon: '🌴',
    rarity: 'epic',
    weight: 5,
  },
};

/**
 * 희귀도별 색상
 */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#10b981',    // emerald
  rare: '#3b82f6',      // blue
  epic: '#a855f7',      // purple
  legendary: '#f59e0b', // amber
};


// ============================================================================
// Template & Shop 타입
// ============================================================================

/**
 * 상점 아이템 (XP로 구매 가능한 아이템)
 */
export interface ShopItem {
  id: string;
  name: string;
  price: number; // XP 가격
  image?: string; // Base64 이미지
  quantity?: number; // 보유 갯수
}

// ============================================================================
// Waifu 타입
// ============================================================================

/**
 * 와이푸 상태 (호감도, 포즈, 상호작용 기록)
 */
export interface WaifuState {
  affection: number; // 호감도 (0-100)
  currentPose: string; // 현재 포즈
  lastInteraction: number; // 마지막 상호작용 시각 (타임스탬프)
  tasksCompletedToday: number; // 오늘 완료 작업 수
  totalInteractions: number; // 총 상호작용 횟수
  lastIdleWarning: number | null; // 마지막 유휴 경고 시각
  unlockedPoses: string[]; // 해금된 특수 포즈 목록
  lastAffectionTier: string; // 마지막 호감도 구간
  clickCount: number; // 클릭 카운터
  poseLockedUntil: number | null; // 포즈 잠금 해제 시각
}

// ============================================================================
// Gemini Chat 타입
// ============================================================================

/**
 * 채팅 메시지 역할 (사용자 또는 AI 모델)
 */
export type ChatRole = 'user' | 'model';

/**
 * 채팅 카테고리 (작업 조언, 동기부여, 질답, 분석)
 */
export type ChatCategory = 'task-advice' | 'motivation' | 'qa' | 'analysis';
export interface GeminiChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  category: ChatCategory;
  tokenUsage?: TokenUsage;
}

/**
 * 일일 채팅 히스토리
 */
export interface ChatHistory {
  date: string; // YYYY-MM-DD
  messages: GeminiChatMessage[];
  updatedAt: number; // 타임스탬프 (밀리초)
}

// ============================================================================
// Token Usage
// ============================================================================

export interface DailyTokenUsage {
  date: string; // YYYY-MM-DD
  promptTokens: number;
  candidatesTokens: number;
  embeddingTokens: number;
  totalTokens: number;
  messageCount: number;
  updatedAt: number;
}

/**
 * 와이푸 모드 타입
 */
export type WaifuMode = 'normal' | 'characteristic'; // 일반 모드 | 특성 모드

/**
 * AI 작업 세분화 트리거 조건
 */
export type AIBreakdownTrigger = 'always' | 'high_difficulty' | 'manual';

/**
 * 앱 설정 (API 키, Firebase 설정, 자동 메시지 등)
 */
export interface Settings {
  geminiApiKey: string;
  geminiModel?: string; // Gemini 모델명 (기본: gemini-3-pro-preview)
  githubToken?: string; // GitHub API 호출용 토큰 (로컬 저장)
  weatherApiKey?: string; // WeatherAPI.com API 키 (날씨 조회용)
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  autoMessageInterval: number; // 자동 메시지 간격 (분)
  autoMessageEnabled: boolean; // 자동 메시지 활성화 여부
  waifuMode: WaifuMode; // 와이푸 모드 (일반/특성)
  waifuImageChangeInterval?: number; // 와이푸 이미지 자동 변경 간격 (밀리초, 0=비활성화)
  templateCategories?: string[]; // 템플릿 카테고리 목록
  aiBreakdownTrigger: AIBreakdownTrigger; // AI 작업 세분화 트리거 조건
  autoEmojiEnabled?: boolean; // 작업 제목 기반 이모지 자동 추천 사용 여부
  timeSlotTags?: TimeSlotTagTemplate[]; // 시간대 속성 템플릿
  dontDoChecklist?: DontDoChecklistItem[]; // 하지않기 체크리스트 항목
  barkApiKey?: string; // Bark 알림 API 키

  // 단축키 설정
  leftPanelToggleKey?: string; // 좌측 패널 토글 단축키 (기본: 'Ctrl+B')
  rightPanelToggleKey?: string; // 우측 패널 토글 단축키 (기본: 'Ctrl+Shift+B')
  bulkAddModalKey?: string; // 대량 추가 모달 단축키 (기본: 'F1')
  alwaysOnTopToggleKey?: string; // 창 최상위 토글 단축키 (기본: 'Ctrl+Shift+T')
  isAlwaysOnTopEnabled?: boolean; // 창 최상위 상태

  // 통계 목표 설정
  weeklyXPGoal?: number; // 주간 XP 목표 (기본값 없음)
  monthlyXPGoal?: number; // 월간 XP 목표 (기본값 없음)

  // 타임블록별 XP 목표 설정
  timeBlockXPGoal?: number; // 타임블록당 XP 목표 (기본값 200)

  // 비활동 시 집중 모드 자동 전환 설정
  idleFocusModeEnabled?: boolean; // 비활동 시 집중 모드 전환 활성화 (기본: false)
  idleFocusModeMinutes?: number; // 비활동 감지 시간 (분, 기본: 3)

  // 임시 스케줄 설정
  tempScheduleGridSnapInterval?: number;

  // 메타데이터 (동기화 충돌 해결용)
  updatedAt?: number;
  updatedByDevice?: string;
}

/**
 * AI 인사이트 데이터
 */
export interface AIInsight {
  date: string; // YYYY-MM-DD (Primary Key)
  content: string; // 인사이트 내용
  createdAt: string; // 생성 시각 (ISO)
  /** 생성 시각 (타임스탬프) - 레거시 호환 */
  generatedAt?: number;
}


