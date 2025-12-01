/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Structured Logging Utility
 *
 * @file logger.ts
 * @description 레벨별, 스타일이 적용된 콘솔 출력을 제공하는 구조화된 로깅 유틸리티
 *
 * @role Repository 및 Service 레이어에서 사용하는 로깅 시스템
 * @responsibilities
 *   - 컨텍스트 정보 자동 추가 (타임스탬프, 모듈명)
 *   - 환경별 로그 레벨 필터링 및 색상 코딩
 *   - 선택적 데이터 객체 출력 지원
 *   - 성능 측정을 위한 start/stop 패턴 제공
 * @dependencies import.meta.env, process.env (환경 플래그)
 */

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

interface LogContext {
  module?: string;
  action?: string;
  [key: string]: any;
}

// ============================================================================
// Configuration
// ============================================================================

const ENV = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
const IS_DEVELOPMENT = ENV.DEV ?? process.env.NODE_ENV !== 'production';
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel = IS_DEVELOPMENT ? 'debug' : 'warn';

// ============================================================================
// Color Codes (Console Styling)
// ============================================================================

const COLORS = {
  debug: '\x1b[90m',   // Gray
  info: '\x1b[36m',    // Cyan
  success: '\x1b[32m', // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',    // Reset
  bold: '\x1b[1m',     // Bold
  dim: '\x1b[2m',      // Dim
};

const EMOJI = {
  debug: '🔍',
  info: 'ℹ️',
  success: '✅',
  warn: '⚠️',
  error: '❌',
};

// ============================================================================
// Core Logger
// ============================================================================

/**
 * 모듈 컨텍스트와 타임스탬프를 포함한 구조화된 로거
 *
 * @example
 * ```typescript
 * const logger = createLogger('MyService');
 * logger.info('Processing started');
 * logger.error('Failed to save', error, { userId: '123' });
 * ```
 */
class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  /**
   * 로그 출력 여부 결정
   *
   * @param level - 확인할 로그 레벨
   * @returns 출력 여부
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
  }

  /**
   * 타임스탬프 생성 (HH:mm:ss.SSS)
   *
   * @returns 포맷된 타임스탬프 문자열
   */
  private getTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  /**
   * 포맷된 로그 메시지 생성
   *
   * @param level - 로그 레벨
   * @param message - 로그 메시지
   * @param context - 선택적 컨텍스트 데이터
   * @returns 포맷된 로그 문자열
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const emoji = EMOJI[level];
    const color = COLORS[level];
    const reset = COLORS.reset;
    const dim = COLORS.dim;

    let formatted = `${color}${emoji} [${this.module}]${reset} ${message}`;

    if (context && Object.keys(context).length > 0) {
      formatted += ` ${dim}${JSON.stringify(context)}${reset}`;
    }

    return formatted;
  }

  /**
   * Debug 로그 (개발 환경에서만 출력)
   *
   * @param message - 로그 메시지
   * @param context - 선택적 컨텍스트 데이터
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message, context));
  }

  /**
   * Info 로그
   *
   * @param message - 로그 메시지
   * @param context - 선택적 컨텍스트 데이터
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('info', message, context));
  }

  /**
   * Success 로그 (성공 작업 강조)
   *
   * @param message - 로그 메시지
   * @param context - 선택적 컨텍스트 데이터
   */
  success(message: string, context?: LogContext): void {
    if (!this.shouldLog('success')) return;
    console.info(this.formatMessage('success', message, context));
  }

  /**
   * Warning 로그
   *
   * @param message - 로그 메시지
   * @param context - 선택적 컨텍스트 데이터
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, context));
  }

  /**
   * Error 로그 (에러 객체 지원)
   *
   * @param message - 로그 메시지
   * @param error - 선택적 Error 객체 또는 기타 에러 값
   * @param context - 선택적 컨텍스트 데이터
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;

    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.error = error.message;
      errorContext.stack = IS_DEVELOPMENT ? error.stack : undefined;
    } else if (error) {
      errorContext.error = String(error);
    }

    console.error(this.formatMessage('error', message, errorContext));
  }

  /**
   * 작업 시작 로그 (성능 측정용)
   *
   * @param action - 시작하는 작업명
   * @param context - 선택적 컨텍스트 데이터
   * @returns 작업 종료 시 호출할 함수 (소요 시간 기록)
   */
  start(action: string, context?: LogContext): () => void {
    const startTime = Date.now();
    this.debug(`Starting: ${action}`, context);

    // 종료 함수 반환
    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Completed: ${action}`, { ...context, duration: `${duration}ms` });
    };
  }

  /**
   * 그룹 로그 (중첩된 로그, 개발 환경에서만 작동)
   *
   * @param label - 그룹 레이블
   * @param callback - 그룹 내에서 실행할 콜백 함수
   */
  group(label: string, callback: () => void): void {
    if (!IS_DEVELOPMENT) return;

    console.group(`${EMOJI.info} ${label}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Logger 인스턴스 생성
 *
 * @param module - 모듈명 (예: 'TemplateRepository', 'DailyDataRepository')
 * @returns Logger 인스턴스
 *
 * @example
 * const logger = createLogger('TemplateRepository');
 * logger.info('Loading templates');
 * logger.error('Failed to save', error);
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// ============================================================================
// Global Logger (레거시 지원)
// ============================================================================

/**
 * 앱 전역에서 사용할 수 있는 기본 Logger 인스턴스
 *
 * @deprecated 모듈별 Logger 생성을 권장합니다 (createLogger 사용)
 */
export const globalLogger = createLogger('App');

// ============================================================================
// Exports
// ============================================================================

export type { LogLevel, LogContext };
export { Logger };
