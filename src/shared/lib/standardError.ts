/**
 * Standard Error Utilities
 *
 * @fileoverview I/O 계층에서 발생한 에러를 일관된 구조로 감싸기 위한 유틸리티입니다.
 *
 * 규칙:
 * - 표준 구조: { code, message, context }
 * - 반드시 Error 객체를 사용합니다.
 */

export type StandardErrorCode = string;

export type StandardErrorContext = Readonly<Record<string, unknown>>;

export type StandardizedError = Error & {
  readonly code: StandardErrorCode;
  readonly context: StandardErrorContext;
  readonly cause?: unknown;
};

const getMessageFromUnknown = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

/**
 * 표준 에러 구조를 갖는 Error 객체를 생성합니다.
 */
export const createStandardError = (params: {
  code: StandardErrorCode;
  message: string;
  context: StandardErrorContext;
  cause?: unknown;
}): StandardizedError => {
  const error = new Error(params.message) as StandardizedError;
  (error as { code: StandardErrorCode }).code = params.code;
  (error as { context: StandardErrorContext }).context = params.context;
  (error as { cause?: unknown }).cause = params.cause;
  return error;
};

/**
 * unknown 에러를 표준 에러로 변환합니다.
 * - message는 원본 에러 메시지를 최대한 보존합니다.
 */
export const toStandardError = (params: {
  code: StandardErrorCode;
  error: unknown;
  context: StandardErrorContext;
  messageOverride?: string;
}): StandardizedError => {
  const message = params.messageOverride ?? getMessageFromUnknown(params.error);

  if (params.error instanceof Error) {
    const existing = params.error as StandardizedError;

    // 이미 표준 에러면 context만 확장하여 재사용합니다.
    if (typeof existing.code === 'string' && typeof existing.context === 'object' && existing.context) {
      return createStandardError({
        code: existing.code,
        message: existing.message,
        context: { ...existing.context, ...params.context },
        cause: existing.cause ?? params.error,
      });
    }
  }

  return createStandardError({
    code: params.code,
    message,
    context: params.context,
    cause: params.error,
  });
};
