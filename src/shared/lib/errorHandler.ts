/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Error Handler Utility
 *
 * @fileoverview 애플리케이션 전반에서 일관된 에러 처리를 제공하는 유틸리티 모듈
 *
 * @role 일관된 에러 처리 및 사용자 친화적 에러 메시지 생성
 * @responsibilities
 *   - 에러 분류 (Network, Database, Validation, Permission, Unknown)
 *   - 구조화된 에러 객체 생성
 *   - 사용자 친화적 메시지 매핑
 *   - 에러 로깅
 *   - try-catch 래퍼 함수 제공
 *   - 유효성 검사 어설션
 *
 * @dependencies
 *   - logger: 로깅 유틸리티
 */

import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

// ============================================================================
// Types
// ============================================================================

export interface ErrorContext {
  operation: string;
  module: string;
  data?: Record<string, any>;
  userMessage?: string;
}

export interface HandledError {
  success: false;
  error: string;
  userMessage: string;
  timestamp: number;
  context: ErrorContext;
}

// ============================================================================
// Error Categories
// ============================================================================

const ERROR_CATEGORIES = {
  NETWORK: 'NETWORK_ERROR',
  DATABASE: 'DATABASE_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const;

type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

// ============================================================================
// User-Friendly Messages
// ============================================================================

const USER_MESSAGES: Record<ErrorCategory, string> = {
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  DATABASE_ERROR: '데이터 저장 중 문제가 발생했습니다.',
  VALIDATION_ERROR: '입력한 데이터를 확인해주세요.',
  PERMISSION_ERROR: '권한이 없습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
};

// ============================================================================
// Error Classification
// ============================================================================

/**
 * 에러를 카테고리별로 분류합니다.
 *
 * @param error - 분류할 에러 객체
 * @returns 에러 카테고리 (NETWORK, DATABASE, VALIDATION, PERMISSION, UNKNOWN)
 */
function classifyError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ERROR_CATEGORIES.NETWORK;
    }

    if (message.includes('indexeddb') || message.includes('dexie') || message.includes('database')) {
      return ERROR_CATEGORIES.DATABASE;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ERROR_CATEGORIES.VALIDATION;
    }

    if (message.includes('permission') || message.includes('forbidden')) {
      return ERROR_CATEGORIES.PERMISSION;
    }
  }

  return ERROR_CATEGORIES.UNKNOWN;
}

// ============================================================================
// Core Handler
// ============================================================================

/**
 * 에러를 처리하고 구조화된 에러 객체 반환
 *
 * @param error - 발생한 에러
 * @param context - 에러 컨텍스트 (작업명, 모듈명 등)
 * @returns 구조화된 에러 객체
 *
 * @example
 * try {
 *   await db.templates.add(template);
 * } catch (error) {
 *   return handleError(error, {
 *     operation: 'createTemplate',
 *     module: 'TemplateRepository',
 *     data: { templateId: template.id }
 *   });
 * }
 */
export function handleError(error: unknown, context: ErrorContext): HandledError {
  const category = classifyError(error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const userMessage = context.userMessage || USER_MESSAGES[category];

  // 로깅
  logger.error(`[${context.module}] ${context.operation} failed`, error, {
    category,
    data: context.data
  });

  return {
    success: false,
    error: errorMessage,
    userMessage,
    timestamp: Date.now(),
    context
  };
}

/**
 * 에러를 로깅만 하고 기본값 반환 (함수가 계속 실행되어야 할 때)
 *
 * @param error - 발생한 에러
 * @param context - 에러 컨텍스트
 * @param defaultValue - 반환할 기본값
 * @returns 기본값
 *
 * @example
 * try {
 *   const templates = await db.templates.toArray();
 *   return templates;
 * } catch (error) {
 *   return logErrorAndReturn(error, {
 *     operation: 'loadTemplates',
 *     module: 'TemplateRepository'
 *   }, []);
 * }
 */
export function logErrorAndReturn<T>(
  error: unknown,
  context: ErrorContext,
  defaultValue: T
): T {
  const category = classifyError(error);

  logger.error(`[${context.module}] ${context.operation} failed (returning default)`, error, {
    category,
    defaultValue,
    data: context.data
  });

  return defaultValue;
}

/**
 * 비동기 작업을 try-catch로 감싸서 실행
 *
 * @param fn - 실행할 비동기 함수
 * @param context - 에러 컨텍스트
 * @param defaultValue - 에러 발생 시 반환할 기본값
 * @returns 함수 실행 결과 또는 기본값
 *
 * @example
 * const templates = await tryCatch(
 *   () => db.templates.toArray(),
 *   { operation: 'loadTemplates', module: 'TemplateRepository' },
 *   []
 * );
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    return logErrorAndReturn(error, context, defaultValue);
  }
}

/**
 * 여러 작업을 병렬로 실행하고 성공한 결과만 반환
 *
 * @param tasks - 실행할 작업 배열
 * @param context - 에러 컨텍스트
 * @returns 성공한 작업의 결과 배열
 *
 * @example
 * const results = await tryAll([
 *   loadFromIndexedDB(),
 *   loadFromFirebase(),
 *   loadFromLocalStorage()
 * ], { operation: 'loadData', module: 'Repository' });
 */
export async function tryAll<T>(
  tasks: Promise<T>[],
  context: ErrorContext
): Promise<T[]> {
  const results = await Promise.allSettled(tasks);

  const successful: T[] = [];
  const failed: any[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        index,
        reason: result.reason
      });
    }
  });

  if (failed.length > 0) {
    logger.warn(`[${context.module}] ${context.operation}: ${failed.length}/${tasks.length} tasks failed`, {
      failed
    });
  }

  return successful;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * 값이 존재하는지 검증 (null, undefined, 빈 문자열 체크)
 */
export function assertExists<T>(
  value: T | null | undefined,
  fieldName: string
): asserts value is T {
  if (value === null || value === undefined || value === '') {
    throw new Error(`Validation failed: ${fieldName} is required`);
  }
}

/**
 * 배열이 비어있지 않은지 검증
 */
export function assertNotEmpty<T>(
  array: T[],
  fieldName: string
): asserts array is [T, ...T[]] {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error(`Validation failed: ${fieldName} must not be empty`);
  }
}

/**
 * 숫자가 범위 내에 있는지 검증
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw new Error(`Validation failed: ${fieldName} must be between ${min} and ${max}`);
  }
}
