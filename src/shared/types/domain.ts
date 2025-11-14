/**
 * 도메인 타입 정의
 * 기존 앱의 데이터 구조를 TypeScript로 재정의
 */

// ============================================================================
// Task 관련 타입
// ============================================================================

export type Resistance = 'low' | 'medium' | 'high';

export type TimeBlockId = '5-8' | '8-11' | '11-14' | '14-17' | '17-19' | '19-24' | null;

export interface Task {
  id: string; // 고유 ID (타임스탬프 기반)
  text: string; // 작업 제목
  memo: string; // 메모
  baseDuration: number; // 예상 소요시간 (분)
  resistance: Resistance; // 심리적 거부감
  adjustedDuration: number; // 조정된 소요시간 (baseDuration * 배율)
  timeBlock: TimeBlockId; // 배치된 블록 ID 또는 null (인박스)
  completed: boolean; // 완료 여부
  actualDuration: number; // 실제 소요시간 (분)
  createdAt: string; // 생성 시각 (ISO 8601)
  completedAt: string | null; // 완료 시각 (ISO 8601)
  fromAutoTemplate?: boolean; // 자동생성 템플릿 여부
}

export interface TimeBlockState {
  isLocked: boolean; // 블록 잠금 여부
  isPerfect: boolean; // 완벽 완료 여부
  isFailed: boolean; // 실패 여부
}

export type TimeBlockStates = Record<string, TimeBlockState>;

// ============================================================================
// Daily Data 타입
// ============================================================================

export interface DailyData {
  tasks: Task[]; // 작업 목록
  timeBlockStates: TimeBlockStates; // 블록 상태
  updatedAt: number; // 타임스탬프 (밀리초)
}

// ============================================================================
// Game State 타입
// ============================================================================

export interface Quest {
  id: string;
  type: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks';
  title: string;
  description: string;
  target: number; // 목표값
  progress: number; // 현재 진행도
  completed: boolean;
  reward: number; // 보상 XP
}

export interface GameState {
  level: number; // 플레이어 레벨
  totalXP: number; // 총 누적 XP
  dailyXP: number; // 오늘 획득 XP
  availableXP: number; // 사용 가능 XP
  streak: number; // 연속 출석일
  lastLogin: string; // 마지막 로그인 날짜 (YYYY-MM-DD)
  questBonusClaimed: boolean; // 일일 퀘스트 보너스 수령 여부
  xpHistory: Array<{ date: string; xp: number }>; // XP 히스토리 (최근 7일)
  dailyQuests: Quest[]; // 일일 퀘스트 목록
  timeBlockXP: Record<string, number>; // 블록별 XP
  timeBlockXPHistory: Array<{ date: string; blocks: Record<string, number> }>; // 블록별 XP 히스토리
  completedTasksHistory: Task[]; // 완료 작업 히스토리
}

// ============================================================================
// Template & Shop 타입
// ============================================================================

export interface Template {
  id: string;
  name: string;
  text: string;
  memo: string;
  baseDuration: number;
  resistance: Resistance;
  timeBlock: TimeBlockId;
  autoGenerate: boolean; // 매일 자동 생성 여부
}

export interface ShopItem {
  id: string;
  name: string;
  price: number; // XP 가격
  image?: string; // Base64 이미지
}

// ============================================================================
// Waifu 타입
// ============================================================================

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

export type ChatRole = 'user' | 'model';

export type ChatCategory = 'task-advice' | 'motivation' | 'qa' | 'analysis';

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface GeminiChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  category: ChatCategory;
  tokenUsage?: TokenUsage;
}

export interface ChatHistory {
  date: string; // YYYY-MM-DD
  messages: GeminiChatMessage[];
  updatedAt: number; // 타임스탬프 (밀리초)
}

export interface DailyTokenUsage {
  date: string; // YYYY-MM-DD
  promptTokens: number; // 입력 토큰 합계
  candidatesTokens: number; // 출력 토큰 합계
  totalTokens: number; // 전체 토큰 합계
  messageCount: number; // 메시지 수
  updatedAt: number; // 타임스탬프 (밀리초)
}

// ============================================================================
// Settings 타입
// ============================================================================

export interface Settings {
  geminiApiKey: string;
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
