/**
 * 앱 전역 상수 정의
 *
 * @role 앱 전역에서 사용되는 상수값 관리 (XP, 레벨, 호감도, 에너지, UI, API 설정 등)
 * @input 없음 (상수 정의 파일)
 * @output 상수값
 * @dependencies 없음
 */

// ============================================================================
// XP 관련 상수
// ============================================================================
export const XP_PER_MINUTE = 1; // 1분당 1 XP
export const BLOCK_LOCK_COST = 15; // 블록 잠금 비용
export const PERFECT_BLOCK_REWARD = 40; // 완벽 블록 보상
export const BLOCK_UNLOCK_PENALTY = 40; // 블록 해제 페널티

// ============================================================================
// 레벨 시스템
// ============================================================================
export const XP_PER_LEVEL = 100; // 레벨당 필요 XP

// ============================================================================
// 와이푸 관련
// ============================================================================
export const AFFECTION_PER_TASK = 2; // 작업 완료 시 호감도 증가
export const AFFECTION_IDLE_DECAY_RATE = 0.5; // 시간당 호감도 감소
export const AFFECTION_MIN = 0;
export const AFFECTION_MAX = 100;

// 와이푸 호감도 구간
export const AFFECTION_TIERS = {
  VERY_LOW: { min: 0, max: 20, mood: '😡', moodText: '매우 불만' },
  LOW: { min: 20, max: 40, mood: '😠', moodText: '불만' },
  NEUTRAL: { min: 40, max: 55, mood: '😐', moodText: '보통' },
  GOOD: { min: 55, max: 70, mood: '🙂', moodText: '좋음' },
  VERY_GOOD: { min: 70, max: 85, mood: '😊', moodText: '매우 좋음' },
  EXCELLENT: { min: 85, max: 100, mood: '🥰', moodText: '최고' },
};

// 와이푸 포즈 (호감도별)
export const WAIFU_POSES = {
  VERY_LOW: ['annoyed', 'disgusted', 'angry', 'disappointed', 'depressed'],
  LOW: ['suspicious', 'thinking', 'serious', 'bored'],
  NEUTRAL: ['neutral', 'nervous'],
  GOOD: ['giggling', 'smiling'],
  VERY_GOOD: ['giggling', 'laughing', 'blushing shyly', 'happy', 'excited'],
  EXCELLENT: ['admiring', 'joyful', 'winking'],
};

// ============================================================================
// 에너지 관련
// ============================================================================
export const ENERGY_MIN = 0;
export const ENERGY_MAX = 100;

// ============================================================================
// 자동 메시지 기본 설정
// ============================================================================
export const DEFAULT_AUTO_MESSAGE_INTERVAL = 3; // 3분
export const AUTO_MESSAGE_MIN_INTERVAL = 1; // 최소 1분
export const AUTO_MESSAGE_MAX_INTERVAL = 60; // 최대 60분

// ============================================================================
// 타이머 간격
// ============================================================================
export const TIMER_UPDATE_INTERVAL = 1000; // 1초 (현재 시간 업데이트)
export const TIMER_COLLAPSE_INTERVAL = 600000; // 10분 (비현재 블록 접기)
export const TIMER_AUTOFOCUS_INTERVAL = 900000; // 15분 (현재 블록 자동 포커스)

// ============================================================================
// 저장소 키 접두사
// ============================================================================
export const STORAGE_KEYS = {
  DAILY_PLANS: 'dailyPlans_', // + YYYY-MM-DD
  GAME_STATE: 'gameState',
  TEMPLATES: 'templates',
  SHOP_ITEMS: 'shopItems',
  WAIFU_STATE: 'waifuState',
  ENERGY_LEVELS: 'energyLevels_', // + YYYY-MM-DD
  GEMINI_CHAT_HISTORY: 'geminiChatHistory_', // + YYYY-MM-DD
  SETTINGS: 'settings',
};

// ============================================================================
// Gemini API
// ============================================================================
export const GEMINI_MODEL = 'gemini-2.0-flash-exp';
export const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============================================================================
// Firebase
// ============================================================================
export const FIREBASE_PATHS = {
  DAILY_PLANS: 'dailyPlans',
  GAME_STATE: 'gameState',
};

// ============================================================================
// UI 관련
// ============================================================================
export const SIDEBAR_WIDTH = 240;
export const RIGHT_PANEL_WIDTH = 320;

// ============================================================================
// 디바운스 시간
// ============================================================================
export const DEBOUNCE_SAVE = 500; // 500ms
export const DEBOUNCE_RENDER = 100; // 100ms

// ============================================================================
// 날짜 포맷
// ============================================================================
export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
