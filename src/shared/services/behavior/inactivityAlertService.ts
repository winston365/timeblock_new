/**
 * Inactivity Alert Service
 *
 * @role 사용자 비활동을 감지하고 주기적으로 알림을 표시
 * @input 사용자 활동 이벤트 (mousemove, keydown, click) - 앱 내부에서만
 * @output Windows 네이티브 알림
 * @dependencies window.electronAPI.showNotification
 *
 * @description
 * - 1시간 동안 앱 내에서 활동이 없으면 비활동 상태로 판단
 * - 비활동 상태에서는 10분마다 알림 표시
 * - 앱 내에서 활동 감지 시 타이머 리셋
 */

import { TEN_MINUTES_MS } from '@/shared/lib/constants';

// ============================================================================
// 상수 정의
// ============================================================================

// 개발 모드 체크 (Vite 환경 변수 사용)
const isDev = import.meta.env.DEV;

// 개발 모드: 빠른 테스트를 위해 짧은 타이머 사용
// 프로덕션 모드: 실제 운영 타이머 사용
const INACTIVITY_THRESHOLD = isDev
    ? 10 * 1000 // 개발: 10초
    : 60 * 60 * 1000; // 프로덕션: 1시간

const ALERT_INTERVAL = isDev
    ? 5 * 1000 // 개발: 5초
    : TEN_MINUTES_MS; // 프로덕션: 10분 (중앙 상수 사용)



// ============================================================================
// Service 클래스
// ============================================================================

/**
 * 사용자 비활동 감지 및 알림 서비스
 * 
 * 앱 내에서 사용자 활동이 없을 경우 주기적으로 알림을 표시하여
 * 사용자에게 휴식 후 작업 재개를 권장합니다.
 */
class InactivityAlertService {
    private inactivityTimer: NodeJS.Timeout | null = null;
    private alertIntervalTimer: NodeJS.Timeout | null = null;
    private isInactive = false;
    private alertCount = 0;
    private isRunning = false;

    /**
     * 서비스 시작
     * 비활동 감지 타이머와 활동 이벤트 리스너를 초기화합니다.
     * @returns {void}
     */
    start(): void {
        if (this.isRunning) {
            console.warn('[InactivityAlert] Service already running');
            return;
        }

        this.isRunning = true;
        this.resetInactivityTimer();
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
     * 비활동 타이머 리셋
     */
    private resetInactivityTimer(): void {
        // 기존 타이머 클리어
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        // 알림 인터벌 타이머도 클리어 (활동이 있으므로)
        if (this.alertIntervalTimer) {
            clearInterval(this.alertIntervalTimer);
            this.alertIntervalTimer = null;
        }

        // 비활동 상태 해제
        if (this.isInactive) {
            this.isInactive = false;
            this.alertCount = 0;
        }

        // 새로운 타이머 설정 (1시간 후)
        this.inactivityTimer = setTimeout(() => {
            this.onInactivityDetected();
        }, INACTIVITY_THRESHOLD);
    }

    /**
     * 비활동 감지 시 호출
     * 비활동 상태를 설정하고 주기적 알림을 시작합니다.
     */
    private onInactivityDetected(): void {
        this.isInactive = true;
        this.alertCount = 0;

        // 첫 번째 알림 즉시 표시
        this.showAlert();

        // 10분마다 반복 알림 설정
        this.alertIntervalTimer = setInterval(() => {
            this.showAlert();
        }, ALERT_INTERVAL);
    }

    /**
     * 알림 표시
     * Windows 네이티브 알림 또는 브라우저 Notification API를 사용합니다.
     */
    private async showAlert(): Promise<void> {
        this.alertCount++;

        const title = '⏰ TimeBlock 알림';
        const body = '1시간 동안 활동이 없었습니다. 휴식 후 다시 시작해보세요!';

        try {
            // 1. Electron API 시도
            if (window.electronAPI?.showNotification) {
                await window.electronAPI.showNotification(title, body);
                return;
            }

            // 2. 브라우저 Native Notification API 시도 (Fallback)
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(title, { body, icon: '/icon.png' });
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        new Notification(title, { body, icon: '/icon.png' });
                    }
                } else {
                    console.warn('[InactivityAlert] Notification permission denied');
                }
                return;
            }

            console.warn('[InactivityAlert] No notification method available');
        } catch (error) {
            console.error('[InactivityAlert] Failed to show notification:', error);
        }
    }

    /**
     * 활동 감지 이벤트 리스너 등록 (앱 내부에서만)
     */
    private attachActivityListeners(): void {
        // 앱 내부 document에서만 이벤트 감지
        document.addEventListener('mousemove', this.handleActivity);
        document.addEventListener('keydown', this.handleActivity);
        document.addEventListener('click', this.handleActivity);
    }

    /**
     * 활동 감지 이벤트 리스너 제거
     */
    private detachActivityListeners(): void {
        document.removeEventListener('mousemove', this.handleActivity);
        document.removeEventListener('keydown', this.handleActivity);
        document.removeEventListener('click', this.handleActivity);
    }

    /**
     * 활동 감지 핸들러
     */
    private handleActivity = (): void => {
        if (!this.isRunning) {
            return;
        }
        this.resetInactivityTimer();
    };

    /**
     * 정리 (타이머 클리어, 이벤트 리스너 제거)
     */
    private cleanup(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }

        if (this.alertIntervalTimer) {
            clearInterval(this.alertIntervalTimer);
            this.alertIntervalTimer = null;
        }

        this.detachActivityListeners();
        this.isInactive = false;
        this.alertCount = 0;
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const inactivityAlertService = new InactivityAlertService();
