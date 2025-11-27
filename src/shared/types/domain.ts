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

// ============================================================================
// Task 관련 타입
// ============================================================================

/**
 * 작업의 심리적 저항도 (난이도)
 */
export type Resistance = 'low' | 'medium' | 'high';

/**
 * 타임블록 ID (5시간 단위)
 */
export type TimeBlockId = '5-8' | '8-11' | '11-14' | '14-17' | '17-19' | '19-24' | null;

/**
 * 워밍업 프리셋 항목 (짧은 준비 작업)
 */
export interface WarmupPresetItem {
  text: string;
  baseDuration: number;
  resistance: Resistance;
}

/**
 * 시간대 속성 템플릿 (헤더 배지에 사용)
 */
export interface TimeSlotTagTemplate {
  id: string;
  label: string;
  color: string;
  icon?: string;
  note?: string;
}

/**
 * 하지않기 체크리스트 항목
 */
export interface DontDoChecklistItem {
  id: string;
  label: string;
  xpReward: number; // XP 보상 (항목별로 설정 가능)
  order: number;
}

/**
 * 작업 (Task) 타입
 * 사용자가 수행할 개별 작업을 나타냄
 */
export interface Task {
  id: string; // 고유 ID (타임스탬프 기반)
  text: string; // 작업 제목
  memo: string; // 메모
  baseDuration: number; // 예상 소요시간 (분)
  resistance: Resistance; // 심리적 거부감
  adjustedDuration: number; // 조정된 소요시간 (baseDuration * 배율)
  timeBlock: TimeBlockId; // 배치된 블록 ID 또는 null (인박스)
  hourSlot?: number; // 시간 슬롯 (시간 단위, 예: 5, 6, 7)
  order?: number; // 정렬 순서 (같은 시간대 내 사용자 지정 순서)
  emoji?: string; // 자동 추천 이모지 (접두 표시용)
  completed: boolean; // 완료 여부
  actualDuration: number; // 실제 소요시간 (분)
  createdAt: string; // 생성 시각 (ISO 8601)
  completedAt: string | null; // 완료 시각 (ISO 8601)
  fromAutoTemplate?: boolean; // 자동생성 템플릿 여부
  preparation1?: string; // 준비 사항 1 (예상 방해물 또는 대처 환경)
  preparation2?: string; // 준비 사항 2 (예상 방해물 또는 대처 환경)
  preparation3?: string; // 준비 사항 3 (예상 방해물 또는 대처 환경)
  timerUsed?: boolean; // 타이머 사용 여부 (몰입 작업)
  goalId?: string | null; // 연결된 목표 ID
}

/**
 * 타임블록 상태 (잠금, 완벽 완료, 실패, 타이머)
 */
export interface TimeBlockState {
  isLocked: boolean; // 블록 잠금 여부
  isPerfect: boolean; // 완벽 완료 여부
  isFailed: boolean; // 실패 여부
  lockTimerStartedAt?: number | null; // 잠금 타이머 시작 시각 (타임스탬프)
  lockTimerDuration?: number; // 타이머 지속 시간 (밀리초, 기본 180000 = 3분)
}

/**
 * 블록 ID별 상태 매핑
 */
export type TimeBlockStates = Record<string, TimeBlockState>;

// ============================================================================
// Daily Data 타입
// ============================================================================

/**
 * 일일 목표
 * @description 하루 단위 시간 기반 목표 (예: 영어 3시간, 운동 1시간)
 */
export interface DailyGoal {
  id: string; // 고유 ID
  title: string; // 목표명 (예: "영어", "운동", "독서")
  targetMinutes: number; // 목표 시간 (분)
  plannedMinutes: number; // 계획한 시간 (연결된 할일 예상시간 합계)
  completedMinutes: number; // 달성한 시간 (완료된 할일 실제시간 합계)

  // 커스터마이징
  color?: string; // 목표 색상 (프로그레스 바)
  icon?: string; // 목표 아이콘 (이모지)
  order: number; // 정렬 순서

  createdAt: string; // 생성 시각 (ISO 8601)
  updatedAt: string; // 수정 시각 (ISO 8601)
}

/**
 * 일일 데이터 (작업 목록, 블록 상태, 목표)
 */
export interface DailyData {
  tasks: Task[]; // 작업 목록
  goals: DailyGoal[]; // 목표 목록
  timeBlockStates: TimeBlockStates; // 블록 상태
  hourSlotTags?: Record<number, string | null>; // 시간대별 속성 태그 (템플릿 ID)
  timeBlockDontDoStatus?: Record<string, Record<string, boolean>>; // 블록별 하지않기 체크 상태 (blockId -> itemId -> checked)
  updatedAt: number; // 타임스탬프 (밀리초)
}

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
}

/**
 * 게임 상태 타입
 * XP, 레벨, 퀘스트, 점화 시스템 등 게임화 관련 모든 상태
 */
export interface GameState {
  // 레벨 및 XP
  level: number;
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

  // 점화 시스템
  dailyFreeIgnitions: number; // 일일 무료 횟수 (기본: 3)
  usedIgnitions: number; // 오늘 사용한 횟수
  lastIgnitionTime: number | null; // 마지막 일반 점화 시간 (타임스탬프)
  lastBonusIgnitionTime: number | null; // 마지막 보너스 점화 시간 (타임스탬프)
  lastIgnitionResetDate: string; // 마지막 리셋 날짜 (YYYY-MM-DD)
  ignitionHistory: Task[]; // 점화/JustDoIt 룰렛 히스토리 (최근 n개)
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
 * 템플릿 반복 주기 타입
 */
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'interval';

/**
 * 작업 템플릿 (반복 작업용)
 */
export interface Template {
  id: string;
  name: string;
  text: string;
  memo: string;
  baseDuration: number;
  resistance: Resistance;
  timeBlock: TimeBlockId;
  autoGenerate: boolean; // 자동 생성 여부 (recurrenceType이 'none'이 아닐 때)
  recurrenceType: RecurrenceType; // 반복 주기 타입
  weeklyDays?: number[]; // 매주 반복 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  intervalDays?: number; // N일 주기 (예: 3일마다)
  lastGeneratedDate?: string; // 마지막 생성 날짜 (YYYY-MM-DD)
  preparation1?: string; // 준비 사항 1 (예상 방해물 또는 대처 환경)
  preparation2?: string; // 준비 사항 2 (예상 방해물 또는 대처 환경)
  preparation3?: string; // 준비 사항 3 (예상 방해물 또는 대처 환경)
  category?: string; // 사용자 정의 카테고리
  isFavorite?: boolean; // 즐겨찾기 여부
  imageUrl?: string; // 템플릿 썸네일 이미지 URL
}

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
// Energy 타입
// ============================================================================

/**
 * 에너지 레벨 기록 (시간대별 에너지 수준)
 */
export interface EnergyLevel {
  timestamp: number; // 기록 시각 (밀리초)
  hour: number; // 시간 (0-23)
  energy: number; // 에너지 수준 (0-100)
  context?: string; // 상황/맥락
  activity?: string; // 활동 타입
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
  ignitionInactivityMinutes?: number; // 점화 버튼 비활동 시간 (분, 기본: 45)
  ignitionDurationMinutes?: number; // 점화 길이 (분, 기본 3)
  ignitionCooldownMinutes?: number; // 점화 쿨다운 (분, 기본 5)
  ignitionXPCost?: number; // 점화 XP 비용 (기본 50 XP)
  justDoItCooldownMinutes?: number; // '그냥해보자!' 쿨다운 (분, 기본 15)
  // 단축키 설정
  leftPanelToggleKey?: string; // 좌측 패널 토글 단축키 (기본: 'Ctrl+B')
  rightPanelToggleKey?: string; // 우측 패널 토글 단축키 (기본: 'Ctrl+Shift+B')
  bulkAddModalKey?: string; // 대량 추가 모달 단축키 (기본: 'F1')

  // 통계 목표 설정
  weeklyXPGoal?: number; // 주간 XP 목표 (기본값 없음)
  monthlyXPGoal?: number; // 월간 XP 목표 (기본값 없음)

  // 타임블록별 XP 목표 설정
  timeBlockXPGoal?: number; // 타임블록당 XP 목표 (기본값 200)

  // 비활동 시 집중 모드 자동 전환 설정
  idleFocusModeEnabled?: boolean; // 비활동 시 집중 모드 전환 활성화 (기본: false)
  idleFocusModeMinutes?: number; // 비활동 감지 시간 (분, 기본: 3)
}

// ============================================================================
// Constants
// ============================================================================

export const TIME_BLOCKS = [
  { id: '5-8', label: '05:00 - 08:00', start: 5, end: 8 },
  { id: '8-11', label: '08:00 - 11:00', start: 8, end: 11 },
  { id: '11-14', label: '11:00 - 14:00', start: 11, end: 14 },
  { id: '14-17', label: '14:00 - 17:00', start: 14, end: 17 },
  { id: '17-20', label: '17:00 - 20:00', start: 17, end: 20 },
  { id: '20-23', label: '20:00 - 23:00', start: 20, end: 23 },
] as const;

export const RESISTANCE_MULTIPLIERS: Record<Resistance, number> = {
  low: 1.0, // 🟢 쉬움
  medium: 1.3, // 🟡 보통
  high: 1.6, // 🔴 어려움
};

export const RESISTANCE_LABELS: Record<Resistance, string> = {
  low: '🟢 쉬움',
  medium: '🟡 보통',
  high: '🔴 어려움',
};

// ============================================================================
// Helper Types
// ============================================================================

/**
 * 타임블록 정보 (블록 + 작업 + 상태 통합)
 */
export interface TimeBlockInfo {
  id: string;
  label: string;
  start: number;
  end: number;
  tasks: Task[];
  state: TimeBlockState;
  totalDuration: number;
  completedDuration: number;
  xp: number;
}

/**
 * AI 인사이트 데이터
 */
export interface AIInsight {
  date: string; // YYYY-MM-DD (Primary Key)
  content: string; // 인사이트 내용
  createdAt: string; // 생성 시각 (ISO)
}
