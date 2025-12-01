/**
 * Idle Focus Mode Service
 *
 * @role 사용자 비활동을 감지하고 자동으로 FocusView로 전환
 * @input 사용자 활동 이벤트 (mousemove, keydown, click)
 * @output FocusView 전환 트리거 + 토스트 알림
 * @dependencies focusModeStore, settingsStore
 *
 * @description
 * - 설정된 시간(기본 3분) 동안 앱 내에서 활동이 없으면 비활동 상태로 판단
 * - 비활동 감지 시 5초 카운트다운 토스트 표시 후 FocusView로 전환
 * - 카운트다운 중 클릭하면 취소 가능
 * - 이미 FocusMode인 경우 전환하지 않음
 */

import { toast } from 'react-hot-toast';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { IDLE_FOCUS_DEFAULTS } from '@/shared/constants/defaults';

// ============================================================================
// 에러 타입 정의
// ============================================================================

interface ServiceError {
    code: string;
    message: string;
    context?: Record<string, unknown>;
    originalError?: unknown;
}

function createServiceError(
    code: string,
    message: string,
    context?: Record<string, unknown>,
    originalError?: unknown
): ServiceError {
    return { code, message, context, originalError };
}

// ============================================================================
// 상수 정의
// ============================================================================

const COUNTDOWN_SECONDS = 5; // 카운트다운 시간
const ACTIVITY_THROTTLE_MS = 1000; // 활동 감지 throttle (1초)

// ============================================================================
// 순수 함수 (Core Logic) - I/O 없음
// ============================================================================

/**
 * 비활동 threshold를 분 단위에서 밀리초로 변환
 * @pure
 * @param {number} minutes - 분 단위 시간
 * @returns {number} 밀리초 단위 시간
 */
function calculateThresholdMs(minutes: number): number {
    return minutes * 60 * 1000;
}

/**
 * 활동 이벤트가 throttle 조건을 만족하는지 판단
 * @pure
 * @param {number} lastActivityTime - 마지막 활동 시간 (밀리초 타임스탬프)
 * @param {number} currentTime - 현재 시간 (밀리초 타임스탬프)
 * @param {number} throttleMs - throttle 간격 (밀리초)
 * @returns {boolean} throttle 조건 만족 여부
 */
function shouldProcessActivity(
    lastActivityTime: number,
    currentTime: number,
    throttleMs: number
): boolean {
    return currentTime - lastActivityTime >= throttleMs;
}

/**
 * 비활동 감지 시 FocusMode로 전환해야 하는지 판단
 * @pure
 * @param {boolean} isFocusModeActive - 현재 FocusMode 활성화 상태
 * @param {boolean} isFeatureEnabled - 기능 활성화 설정 여부
 * @returns {{ shouldActivate: boolean; skipReason: string | null }} 전환 필요 여부와 스킵 사유
 */
function shouldActivateFocusMode(
    isFocusModeActive: boolean,
    isFeatureEnabled: boolean
): { shouldActivate: boolean; skipReason: string | null } {
    if (isFocusModeActive) {
        return { shouldActivate: false, skipReason: 'Already in FocusMode' };
    }
    if (!isFeatureEnabled) {
        return { shouldActivate: false, skipReason: 'Feature disabled in settings' };
    }
    return { shouldActivate: true, skipReason: null };
}

// ============================================================================
// Shell 함수 (I/O 래퍼) - Store 접근 및 에러 처리
// ============================================================================

/**
 * 설정에서 threshold 분 값을 읽어옴 (I/O)
 * @shell
 */
function readThresholdMinutesFromSettings(): number {
    try {
        const settings = useSettingsStore.getState().settings;
        return settings?.idleFocusModeMinutes ?? IDLE_FOCUS_DEFAULTS.minutes;
    } catch (error) {
        const serviceError = createServiceError(
            'SETTINGS_READ_ERROR',
            'Failed to read idleFocusModeMinutes from settings',
            { fallbackValue: IDLE_FOCUS_DEFAULTS.minutes },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
        return IDLE_FOCUS_DEFAULTS.minutes;
    }
}

/**
 * FocusMode 활성화 상태 읽기 (I/O)
 * @shell
 */
function readFocusModeState(): boolean {
    try {
        return useFocusModeStore.getState().isFocusMode;
    } catch (error) {
        const serviceError = createServiceError(
            'FOCUS_STORE_READ_ERROR',
            'Failed to read isFocusMode from store',
            { fallbackValue: false },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
        return false;
    }
}

/**
 * 기능 활성화 여부 읽기 (I/O)
 * @shell
 */
function readIdleFocusModeEnabled(): boolean {
    try {
        const settings = useSettingsStore.getState().settings;
        return settings?.idleFocusModeEnabled ?? false;
    } catch (error) {
        const serviceError = createServiceError(
            'SETTINGS_READ_ERROR',
            'Failed to read idleFocusModeEnabled from settings',
            { fallbackValue: false },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
        return false;
    }
}

/**
 * FocusMode 활성화 (I/O)
 * @shell
 */
function writeFocusModeState(enabled: boolean): void {
    try {
        const { setFocusMode } = useFocusModeStore.getState();
        setFocusMode(enabled);
    } catch (error) {
        const serviceError = createServiceError(
            'FOCUS_STORE_WRITE_ERROR',
            'Failed to set FocusMode state',
            { attemptedValue: enabled },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
        throw serviceError;
    }
}

/**
 * 토스트 표시 - 카운트다운 (I/O)
 * @shell
 */
function showCountdownToast(remainingSeconds: number): string | null {
    try {
        return toast.loading(
            `🎯 ${remainingSeconds}초 후 집중 모드로 전환합니다...`,
            {
                duration: Infinity,
                id: 'idle-focus-countdown',
            }
        );
    } catch (error) {
        const serviceError = createServiceError(
            'TOAST_ERROR',
            'Failed to show countdown toast',
            { remainingSeconds },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
        return null;
    }
}

/**
 * 토스트 업데이트 - 카운트다운 (I/O)
 * @shell
 */
function updateCountdownToast(remainingSeconds: number): void {
    try {
        toast.loading(
            `🎯 ${remainingSeconds}초 후 집중 모드로 전환합니다...`,
            { id: 'idle-focus-countdown' }
        );
    } catch (error) {
        const serviceError = createServiceError(
            'TOAST_ERROR',
            'Failed to update countdown toast',
            { remainingSeconds },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
    }
}

/**
 * 토스트 닫기 (I/O)
 * @shell
 */
function dismissToast(toastId: string): void {
    try {
        toast.dismiss(toastId);
    } catch (error) {
        const serviceError = createServiceError(
            'TOAST_ERROR',
            'Failed to dismiss toast',
            { toastId },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
    }
}

/**
 * 성공 토스트 표시 (I/O)
 * @shell
 */
function showSuccessToast(message: string, icon: string): void {
    try {
        toast.success(message, {
            duration: 3000,
            icon,
        });
    } catch (error) {
        const serviceError = createServiceError(
            'TOAST_ERROR',
            'Failed to show success toast',
            { message },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
    }
}

/**
 * 정보 토스트 표시 (I/O)
 * @shell
 */
function showInfoToast(message: string, icon: string): void {
    try {
        toast(message, {
            duration: 2000,
            icon,
        });
    } catch (error) {
        const serviceError = createServiceError(
            'TOAST_ERROR',
            'Failed to show info toast',
            { message },
            error
        );
        console.error('[IdleFocusMode]', serviceError);
    }
}

// ============================================================================
// Service 클래스
// ============================================================================

/**
 * 비활동 감지 후 자동 집중 모드 전환 서비스
 * 
 * 설정된 시간 동안 사용자 활동이 없으면 카운트다운 후
 * 자동으로 FocusView로 전환합니다.
 */
class IdleFocusModeService {
    private idleTimer: NodeJS.Timeout | null = null;
    private countdownTimer: NodeJS.Timeout | null = null;
    private countdownToastId: string | null = null;
    private isRunning = false;
    private isInCountdown = false; // 카운트다운 진행 중 여부
    private lastActivityTime = 0; // throttle용

    /**
     * 현재 threshold를 설정에서 동적으로 가져옴
     * 사용자 설정값을 항상 존중함 (분 단위 → 밀리초 변환)
     * @returns {number} 비활동 감지 임계값 (밀리초)
     */
    private getThresholdMs(): number {
        const minutes = readThresholdMinutesFromSettings();
        const thresholdMs = calculateThresholdMs(minutes);
        
        return thresholdMs;
    }

    /**
     * 서비스 시작
     * 비활동 감지 타이머와 키보드 이벤트 리스너를 초기화합니다.
     * @returns {void}
     */
    start(): void {
        if (this.isRunning) {
            console.warn('[IdleFocusMode] Service already running');
            return;
        }

        this.isRunning = true;
        this.isInCountdown = false;
        this.startIdleTimer();
        this.attachActivityListeners();
    }

    /**
     * 서비스 중지
     * 모든 타이머와 이벤트 리스너를 정리합니다.
     * @returns {void}
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.cleanup();
    }

    /**
     * 비활동 타이머 시작 (새로 시작)
     * 매번 설정에서 최신 threshold를 읽어옴
     */
    private startIdleTimer(): void {
        // 기존 타이머 클리어
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        const thresholdMs = this.getThresholdMs();

        // 새로운 타이머 설정
        this.idleTimer = setTimeout(() => {
            this.onIdleDetected();
        }, thresholdMs);
    }

    /**
     * 비활동 감지 시 호출
     */
    private onIdleDetected(): void {
        const isFocusModeActive = readFocusModeState();
        const isFeatureEnabled = readIdleFocusModeEnabled();
        
        const { shouldActivate } = shouldActivateFocusMode(
            isFocusModeActive,
            isFeatureEnabled
        );

        if (!shouldActivate) {
            if (isFocusModeActive) {
                this.startIdleTimer();
            }
            return;
        }

        this.startCountdown();
    }

    /**
     * 카운트다운 시작
     */
    private startCountdown(): void {
        this.isInCountdown = true;
        let remaining = COUNTDOWN_SECONDS;

        // 초기 토스트 표시
        this.countdownToastId = showCountdownToast(remaining);

        this.countdownTimer = setInterval(() => {
            remaining--;

            if (remaining <= 0) {
                // 카운트다운 완료 - FocusMode 전환
                this.cancelCountdown();
                this.activateFocusMode();
            } else {
                // 카운트다운 업데이트
                updateCountdownToast(remaining);
            }
        }, 1000);
    }

    /**
     * 카운트다운 취소
     */
    private cancelCountdown(): void {
        this.isInCountdown = false;

        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        if (this.countdownToastId) {
            dismissToast('idle-focus-countdown');
            this.countdownToastId = null;
        }
    }

    /**
     * FocusMode 활성화
     * 사용자를 집중 모드로 전환하고 성공 토스트를 표시합니다.
     */
    private activateFocusMode(): void {
        try {
            writeFocusModeState(true);
            showSuccessToast('🎯 집중 모드가 활성화되었습니다!', '🔥');
        } catch (error) {
            console.error('[IdleFocusMode] Failed to activate FocusMode:', error);
        }

        // 다음 비활동 감지를 위해 타이머 리셋
        this.startIdleTimer();
    }

    /**
     * 활동 감지 이벤트 리스너 등록
     */
    private attachActivityListeners(): void {
        try {
            document.addEventListener('keydown', this.handleActivity);
        } catch (error) {
            const serviceError = createServiceError(
                'EVENT_LISTENER_ERROR',
                'Failed to attach activity listeners',
                {},
                error
            );
            console.error('[IdleFocusMode]', serviceError);
        }
    }

    /**
     * 활동 감지 이벤트 리스너 제거
     */
    private detachActivityListeners(): void {
        try {
            document.removeEventListener('keydown', this.handleActivity);
        } catch (error) {
            const serviceError = createServiceError(
                'EVENT_LISTENER_ERROR',
                'Failed to detach activity listeners',
                {},
                error
            );
            console.error('[IdleFocusMode]', serviceError);
        }
    }

    /**
     * 활동 감지 핸들러 (throttle 적용)
     */
    private handleActivity = (): void => {
        if (!this.isRunning) {
            return;
        }

        // Throttle 체크 - 순수 함수 사용
        const now = Date.now();
        if (!shouldProcessActivity(this.lastActivityTime, now, ACTIVITY_THROTTLE_MS)) {
            return;
        }
        this.lastActivityTime = now;

        // 카운트다운 중이면 취소하고 타이머 리셋
        if (this.isInCountdown) {
            this.cancelCountdown();
            dismissToast('idle-focus-countdown');
            showInfoToast('⏸️ 집중 모드 전환이 취소되었습니다', '👋');
        }

        // 타이머 새로 시작
        this.startIdleTimer();
    };

    /**
     * 정리
     */
    private cleanup(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        this.cancelCountdown();
        this.detachActivityListeners();
        this.isInCountdown = false;
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const idleFocusModeService = new IdleFocusModeService();
