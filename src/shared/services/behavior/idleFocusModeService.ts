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
// 상수 정의
// ============================================================================

const COUNTDOWN_SECONDS = 5; // 카운트다운 시간
const ACTIVITY_THROTTLE_MS = 1000; // 활동 감지 throttle (1초)

// ============================================================================
// Service 클래스
// ============================================================================

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
     */
    private getThresholdMs(): number {
        const settings = useSettingsStore.getState().settings;
        const minutes = settings?.idleFocusModeMinutes ?? IDLE_FOCUS_DEFAULTS.minutes;
        const thresholdMs = minutes * 60 * 1000;
        
        console.log(`[IdleFocusMode] getThresholdMs: ${minutes}분 = ${thresholdMs}ms`);
        return thresholdMs;
    }

    /**
     * 서비스 시작
     */
    start(): void {
        if (this.isRunning) {
            console.warn('[IdleFocusMode] Service already running');
            return;
        }

        const thresholdMs = this.getThresholdMs();

        console.log(
            `[IdleFocusMode] Service started | Threshold: ${thresholdMs / 1000}s (${thresholdMs / 60000}min)`
        );

        this.isRunning = true;
        this.isInCountdown = false;
        this.startIdleTimer();
        this.attachActivityListeners();
    }

    /**
     * 서비스 중지
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        console.log('[IdleFocusMode] Service stopped');
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
        console.log(`[IdleFocusMode] Starting idle timer: ${thresholdMs / 1000}s`);

        // 새로운 타이머 설정
        this.idleTimer = setTimeout(() => {
            this.onIdleDetected();
        }, thresholdMs);
    }

    /**
     * 비활동 감지 시 호출
     */
    private onIdleDetected(): void {
        // 이미 FocusMode면 무시
        const { isFocusMode } = useFocusModeStore.getState();
        if (isFocusMode) {
            console.log('[IdleFocusMode] Already in FocusMode, skipping');
            this.startIdleTimer();
            return;
        }

        // 설정에서 활성화 여부 재확인
        const settings = useSettingsStore.getState().settings;
        if (!settings?.idleFocusModeEnabled) {
            console.log('[IdleFocusMode] Feature disabled in settings, skipping');
            return;
        }

        console.log('[IdleFocusMode] Idle detected, starting countdown');
        this.startCountdown();
    }

    /**
     * 카운트다운 시작
     */
    private startCountdown(): void {
        this.isInCountdown = true;
        let remaining = COUNTDOWN_SECONDS;

        // 초기 토스트 표시
        this.countdownToastId = toast.loading(
            `🎯 ${remaining}초 후 집중 모드로 전환합니다...`,
            {
                duration: Infinity,
                id: 'idle-focus-countdown',
            }
        );

        this.countdownTimer = setInterval(() => {
            remaining--;

            if (remaining <= 0) {
                // 카운트다운 완료 - FocusMode 전환
                this.cancelCountdown();
                this.activateFocusMode();
            } else {
                // 카운트다운 업데이트
                toast.loading(
                    `🎯 ${remaining}초 후 집중 모드로 전환합니다...`,
                    { id: 'idle-focus-countdown' }
                );
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
            toast.dismiss('idle-focus-countdown');
            this.countdownToastId = null;
        }
    }

    /**
     * FocusMode 활성화
     */
    private activateFocusMode(): void {
        const { setFocusMode } = useFocusModeStore.getState();
        setFocusMode(true);

        toast.success('🎯 집중 모드가 활성화되었습니다!', {
            duration: 3000,
            icon: '🔥',
        });

        console.log('[IdleFocusMode] FocusMode activated');

        // 다음 비활동 감지를 위해 타이머 리셋
        this.startIdleTimer();
    }

    /**
     * 활동 감지 이벤트 리스너 등록
     */
    private attachActivityListeners(): void {
        document.addEventListener('mousemove', this.handleActivity);
        document.addEventListener('keydown', this.handleActivity);
        document.addEventListener('click', this.handleActivity);
        document.addEventListener('scroll', this.handleActivity);
        document.addEventListener('touchstart', this.handleActivity);
    }

    /**
     * 활동 감지 이벤트 리스너 제거
     */
    private detachActivityListeners(): void {
        document.removeEventListener('mousemove', this.handleActivity);
        document.removeEventListener('keydown', this.handleActivity);
        document.removeEventListener('click', this.handleActivity);
        document.removeEventListener('scroll', this.handleActivity);
        document.removeEventListener('touchstart', this.handleActivity);
    }

    /**
     * 활동 감지 핸들러 (throttle 적용)
     */
    private handleActivity = (): void => {
        if (!this.isRunning) {
            return;
        }

        // Throttle: 1초 이내 중복 호출 무시
        const now = Date.now();
        if (now - this.lastActivityTime < ACTIVITY_THROTTLE_MS) {
            return;
        }
        this.lastActivityTime = now;

        // 카운트다운 중이면 취소하고 타이머 리셋
        if (this.isInCountdown) {
            console.log('[IdleFocusMode] Activity during countdown - cancelling');
            this.cancelCountdown();
            toast.dismiss('idle-focus-countdown');
            toast('⏸️ 집중 모드 전환이 취소되었습니다', {
                duration: 2000,
                icon: '👋',
            });
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
