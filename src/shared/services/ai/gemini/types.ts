/**
 * types.ts
 *
 * @fileoverview Gemini API 관련 TypeScript 타입 정의
 *
 * @role Gemini 서비스 전반에서 사용되는 공통 타입 제공
 * @responsibilities
 *   - API 요청/응답 타입 정의 (GeminiMessage, GeminiResponse, TokenUsage)
 *   - 페르소나 컨텍스트 타입 정의 (PersonaContext, DetailedTask)
 *   - 작업 AI 기능 파라미터 타입 정의 (TaskBreakdownParams)
 * @dependencies
 *   - 없음 (순수 타입 정의 모듈)
 */

// ============================================================================
// API Types
// ============================================================================

/**
 * Gemini API 메시지 형식
 * @property {'user' | 'model'} role - 메시지 발신자 역할
 * @property {Array<{text: string}>} parts - 메시지 텍스트 파트 배열
 */
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Gemini API 응답 형식
 * @property {Array} candidates - 생성된 응답 후보 배열
 * @property {Object} [usageMetadata] - 토큰 사용량 메타데이터 (선택)
 */
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

/**
 * API 호출 토큰 사용량 정보
 * @property {number} promptTokens - 프롬프트에 사용된 토큰 수
 * @property {number} candidatesTokens - 응답 생성에 사용된 토큰 수
 * @property {number} totalTokens - 총 토큰 사용량
 */
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
