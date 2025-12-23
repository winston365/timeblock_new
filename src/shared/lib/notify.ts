/**
 * notify.ts
 *
 * @role Toast 알림 단일 진입점 래퍼
 * @description react-hot-toast를 단일 API로 추상화하여 일관된 피드백 UX 제공
 *
 * 사용 방법:
 * ```typescript
 * import { notify } from '@/shared/lib/notify';
 * 
 * notify.success('작업 완료');
 * notify.error('오류 발생');
 * notify.info('안내 메시지');
 * notify.undo('삭제됨', { label: '되돌리기', onAction: () => restore() });
 * notify.placement('오늘 11-14 블록으로 이동');
 * ```
 *
 * @dependencies react-hot-toast
 */

import { createElement } from 'react';
import { toast, type Toast, type ToastOptions } from 'react-hot-toast';

// ============================================================================
// Types
// ============================================================================

/**
 * Undo 액션 정의
 */
export interface NotifyAction {
  /** 버튼 레이블 */
  readonly label: string;
  /** 액션 콜백 */
  readonly onAction: () => void | Promise<void>;
}

/**
 * notify 옵션
 */
export interface NotifyOptions {
  /** toast 고유 ID (중복 방지) */
  readonly id?: string;
  /** 표시 지속 시간 (ms) */
  readonly durationMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 토스트 지속 시간 (ms) */
const DEFAULT_DURATION_MS = 3000;

/** Undo 토스트 지속 시간 (ms) - 복구 기회 제공을 위해 길게 */
const UNDO_DURATION_MS = 5000;

/** 배치 피드백 지속 시간 (ms) */
const PLACEMENT_DURATION_MS = 2500;

// ============================================================================
// Implementation
// ============================================================================

/**
 * react-hot-toast 옵션 변환
 */
const toHotToastOptions = (options?: NotifyOptions): ToastOptions => ({
  id: options?.id,
  duration: options?.durationMs ?? DEFAULT_DURATION_MS,
});

/**
 * Toast 알림 단일 API
 *
 * @description
 * 모든 인박스/스케줄 관련 피드백은 이 래퍼를 통해서만 호출합니다.
 * - 산만함 최소화: 짧고 구체적인 문장
 * - 일관된 UX: 동일한 스타일/위치
 * - ADHD 친화: 과한 애니메이션 금지
 */
export const notify = {
  /**
   * 성공 알림 (체크 아이콘)
   * @param message - 표시할 메시지
   * @param options - 옵션
   */
  success: (message: string, options?: NotifyOptions): string => {
    return toast.success(message, toHotToastOptions(options));
  },

  /**
   * 오류 알림 (X 아이콘)
   * @param message - 표시할 메시지
   * @param options - 옵션
   */
  error: (message: string, options?: NotifyOptions): string => {
    return toast.error(message, toHotToastOptions(options));
  },

  /**
   * 정보 알림 (기본 아이콘)
   * @param message - 표시할 메시지
   * @param options - 옵션
   */
  info: (message: string, options?: NotifyOptions): string => {
    return toast(message, toHotToastOptions(options));
  },

  /**
   * 배치 성공 피드백 (인박스 → 스케줄 이동)
   * @param message - 표시할 메시지 (예: "오늘 11-14 블록으로 이동")
   * @param options - 옵션
   */
  placement: (message: string, options?: NotifyOptions): string => {
    return toast.success(`📍 ${message}`, {
      ...toHotToastOptions(options),
      duration: options?.durationMs ?? PLACEMENT_DURATION_MS,
    });
  },

  /**
   * Undo 가능한 알림 (되돌리기 버튼 포함)
   * 
   * @description
   * toast.custom + React.createElement를 사용하여 되돌리기 버튼을 구현합니다.
   * 버튼 클릭 시 onAction 콜백이 호출되고 토스트가 닫힙니다.
   * 
   * @param message - 표시할 메시지 (예: "삭제됨")
   * @param action - Undo 액션 정의
   * @param options - 옵션
   */
  undo: (message: string, action: NotifyAction, options?: NotifyOptions): string => {
    return toast.custom(
      (t: Toast) =>
        createElement(
          'div',
          {
            role: 'alert',
            'aria-live': 'polite',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(17, 24, 39, 0.95)',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
              opacity: t.visible ? 1 : 0,
              transition: 'opacity 150ms ease-in-out',
              maxWidth: 'min(560px, calc(100vw - 32px))',
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                flex: 1,
                minWidth: 0,
              },
            },
            createElement(
              'div',
              {
                style: {
                  fontSize: '14px',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              },
              message,
            ),
          ),
          createElement(
            'button',
            {
              type: 'button',
              onClick: () => {
                toast.dismiss(t.id);
                void action.onAction();
              },
              'aria-label': action.label,
              style: {
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'transparent',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              },
            },
            action.label,
          ),
        ),
      {
        id: options?.id,
        duration: options?.durationMs ?? UNDO_DURATION_MS,
      },
    );
  },

  /**
   * 목표 달성 피드백 (HUD 연동용)
   * @param message - 표시할 메시지 (예: "🎉 오늘 목표 달성!")
   * @param options - 옵션
   */
  goalAchieved: (message: string, options?: NotifyOptions): string => {
    return toast.success(message, {
      ...toHotToastOptions(options),
      duration: options?.durationMs ?? 4000,
      icon: '🎉',
    });
  },

  /**
   * 기존 토스트 닫기
   * @param toastId - 닫을 토스트 ID
   */
  dismiss: (toastId?: string): void => {
    toast.dismiss(toastId);
  },

  /**
   * 모든 토스트 닫기
   */
  dismissAll: (): void => {
    toast.dismiss();
  },
} as const;
