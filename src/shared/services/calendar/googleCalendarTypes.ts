/**
 * Google Calendar Types
 *
 * @role Google Calendar API 연동에 사용되는 타입 정의
 * @input 없음 (타입 정의 파일)
 * @output TypeScript 타입 및 인터페이스
 * @dependencies 없음
 */

// ============================================================================
// Google Calendar API 관련 타입
// ============================================================================

/**
 * Google OAuth 토큰 정보
 */
export interface GoogleAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // 만료 시간 (Unix timestamp ms)
  scope: string;
}

/**
 * Google Calendar 이벤트 (간소화된 버전)
 */
export interface GoogleCalendarEvent {
  id?: string;
  summary: string; // 이벤트 제목
  description?: string; // 설명 (메모, 난이도 등)
  start: {
    dateTime: string; // ISO 8601 (예: 2025-12-04T09:00:00+09:00)
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  colorId?: string; // Google Calendar 색상 ID (1-11)
  status?: 'confirmed' | 'tentative' | 'cancelled';
  extendedProperties?: {
    private?: Record<string, string>; // 앱 전용 데이터 (taskId, resistance 등)
  };
}

/**
 * Google Calendar 연동 설정
 */
export interface GoogleCalendarSettings {
  enabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  calendarId?: string; // 동기화할 캘린더 ID (기본: 'primary')
  userEmail?: string; // 연동된 구글 계정 이메일
  clientId?: string; // OAuth Client ID (토큰 갱신에 필요)
  clientSecret?: string; // OAuth Client Secret (토큰 갱신에 필요)
  lastSyncAt?: number; // 마지막 동기화 시간
}

/**
 * Google Calendar 목록의 UI용 최소 필드
 */
export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
}

/**
 * Task-Calendar 매핑 정보 (Dexie에 저장)
 */
export interface TaskCalendarMapping {
  taskId: string;
  calendarEventId: string;
  date: string; // YYYY-MM-DD
  lastSyncedAt: number;
  syncStatus: 'synced' | 'pending' | 'failed';
}

/**
 * Google Calendar API 응답 (이벤트 목록)
 */
export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  summary: string;
  updated: string;
  timeZone: string;
  accessRole: string;
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

/**
 * Google Calendar API 에러 응답
 */
export interface GoogleCalendarError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

// ============================================================================
// Google Calendar 색상 매핑 (Resistance → ColorId)
// ============================================================================

/**
 * 난이도별 Google Calendar 색상 ID
 * @see https://developers.google.com/calendar/api/v3/reference/colors/get
 */
export const RESISTANCE_TO_CALENDAR_COLOR: Record<string, string> = {
  low: '2',      // 🟢 Sage (연한 녹색)
  medium: '5',   // 🟡 Banana (노란색)
  high: '11',    // 🔴 Tomato (빨간색)
};

/**
 * 완료된 작업의 색상 ID
 */
export const COMPLETED_TASK_COLOR = '8'; // Graphite (회색)

// ============================================================================
// Google OAuth 설정
// ============================================================================

/**
 * Google OAuth 클라이언트 설정
 * 사용자가 자신의 OAuth 클라이언트 ID를 설정해야 함
 */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Google Calendar API Base URL
 */
export const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
