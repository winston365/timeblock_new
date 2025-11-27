/**
 * Gemini API - Types & Interfaces
 * 
 * @role Gemini API 관련 타입 정의
 */

// ============================================================================
// API Types
// ============================================================================

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

// ============================================================================
// Persona Context Types
// ============================================================================

/**
 * 상세 작업 정보 (AI 컨텍스트용)
 */
export interface DetailedTask {
  text: string;
  memo: string;
  resistance: string;
  baseDuration: number;
  adjustedDuration: number;
  hourSlot?: number;
  completed: boolean;
  actualDuration: number;
  preparation1?: string;
  preparation2?: string;
  preparation3?: string;
  timerUsed?: boolean;
  completedAt: string | null;
}

/**
 * 와이푸 페르소나 생성 옵션
 */
export interface PersonaContext {
  // 기본 정보
  affection: number;
  totalXP: number;
  dailyXP: number;
  availableXP: number;

  // 작업 정보
  tasksCompleted: number;
  totalTasks: number;
  inboxTasks: Array<{ text: string; resistance: string; baseDuration: number; memo: string }>;
  recentTasks: Array<{ text: string; completed: boolean; resistance: string }>;

  // 시간 정보
  currentHour: number;
  currentMinute: number;
  hoursLeftToday: number;
  minutesLeftToday: number;

  // 타임블록 정보
  currentBlockId: string | null;
  currentBlockLabel: string;
  currentBlockTasks: Array<{ text: string; completed: boolean }>;
  lockedBlocksCount: number;
  totalBlocksCount: number;

  // ✅ 오늘의 모든 블록별 상세 할일 정보 (시간대바별 구분)
  allBlockTasks: Record<string, DetailedTask[]>;

  // ✅ 시간대별 속성 태그 (예: 딥워크, 아침 루틴 등)
  hourSlotTags?: Record<number, string | null>;

  // ✅ 블록별 "하지않기" 체크리스트 상태
  timeBlockDontDoStatus?: Record<string, Record<string, boolean>>;

  // 에너지 정보
  currentEnergy: number;
  energyRecordedAt: number | null;

  // XP 히스토리 (최근 7일)
  xpHistory: Array<{ date: string; xp: number }>;

  // 타임블록 XP 히스토리 (최근 7일)
  timeBlockXPHistory: Array<{ date: string; blocks: Record<string, number> }>;

  // 최근 5일 시간대별 완료 작업 패턴
  recentBlockPatterns: Record<string, Array<{ date: string; completedCount: number; tasks: string[] }>>;

  // ✅ 최근 10일 작업 상세 로그 (날짜별 작업 기록)
  recentTaskLog: Array<{
    date: string;
    tasks: Array<{
      text: string;
      completed: boolean;
      timeBlock: string | null;
      memo: string;
    }>;
  }>;

  // 기분 (호감도 기반 계산)
  mood: string;
}

// ============================================================================
// Task AI Feature Types
// ============================================================================

/**
 * 작업 세분화 파라미터
 */
export interface TaskBreakdownParams {
  taskText: string;
  memo: string;
  baseDuration: number;
  resistance: 'low' | 'medium' | 'high';
  preparation1: string;
  preparation2: string;
  preparation3: string;
  affection: number;
  refinement?: 'more_detailed' | 'simpler' | null;
}
