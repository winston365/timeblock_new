/**
 * systemRepository.ts
 *
 * @role 시스템 전역 상태 관리 (Dexie 'systemState' 테이블 사용)
 * @description localStorage 대신 Dexie를 사용하여 시스템 상태를 영구 저장하고 관리합니다.
 */

import { db } from '../db/dexieClient';

/**
 * 시스템 상태 키 정의
 */
export const SYSTEM_KEYS = {
    LAST_INSIGHT_TIME: 'lastInsightGenerationTime',
    LAST_INSIGHT_TEXT: 'lastInsightText',
    PROCRASTINATION_MONITOR: 'procrastinationMonitorState',
    QUICK_WINS_COMPLETED: 'quickWinsCompletedState',
    CATCH_UP_ALERT_SHOWN_DATE: 'catchUpAlertShownDate',
    /** 오늘 할당량 달성한 목표 ID 목록 */
    QUOTA_ACHIEVED_GOALS: 'quotaAchievedGoals',
    /** Catch-up 알림 스누즈 상태 */
    CATCH_UP_SNOOZE_STATE: 'catchUpSnoozeState',
    /** 워밍업 자동생성 활성화 여부 (기본: true) */
    WARMUP_AUTO_GENERATE_ENABLED: 'schedule:warmupAutoGenerateEnabled',
    /** 타임라인 지난 블록 표시 여부 */
    TIMELINE_SHOW_PAST: 'timelineShowPastBlocks',
    /** 하지않기 체크리스트 접힘 상태 */
    DONT_DO_COLLAPSED: 'dontDoCollapsed',
    /** 좌측 사이드바 접힘 상태 */
    LEFT_SIDEBAR_COLLAPSED: 'leftSidebarCollapsed',
    /** 우측 패널 접힘 상태 */
    RIGHT_PANELS_COLLAPSED: 'rightPanelsCollapsed',
    /** 타임라인 표시 상태 */
    TIMELINE_VISIBLE: 'timelineVisible',
    /** 동기화 로그 저장 키 */
    SYNC_LOGS: 'syncLogs',
    /** 디바이스 ID */
    DEVICE_ID: 'deviceId',
    /** Google Calendar 설정 */
    GOOGLE_CALENDAR_SETTINGS: 'googleCalendarSettings',
    /** 일일 요약 보고서 캐시 접두사 */
    DAILY_SUMMARY_REPORT_PREFIX: 'daily_summary_report',
    /** 템플릿 UX v1 기능 플래그 */
    TEMPLATE_UX_V1_ENABLED: 'template:uxV1Enabled',
    /** 템플릿 UI 환경설정 (정렬, 필터 등) */
    TEMPLATE_UI_PREFS: 'template:uiPrefs',
    /** 템플릿 자동생성 상태 */
    TEMPLATE_AUTO_GENERATE_STATE: 'template:autoGenerateState',
    /** 템플릿 실행 로그 (최대 50개) */
    TEMPLATE_EXECUTION_LOG: 'template:executionLog',
} as const;

/**
 * 시스템 상태 값 저장
 * @param key 상태 키
 * @param value 저장할 값 (타입 안전성을 위해 unknown 사용)
 */
export async function setSystemState(key: string, value: unknown): Promise<void> {
    try {
        await db.systemState.put({ key, value });
    } catch (error) {
        console.error(`Failed to set system state for key "${key}":`, error);
    }
}

/**
 * 시스템 상태 값 조회
 * @param key 상태 키
 * @returns 저장된 값 또는 undefined
 */
export async function getSystemState<T>(key: string): Promise<T | undefined> {
    try {
        const record = await db.systemState.get(key);
        return record?.value as T;
    } catch (error) {
        console.error(`Failed to get system state for key "${key}":`, error);
        return undefined;
    }
}

/**
 * 시스템 상태 값 삭제
 * @param key 상태 키
 */
export async function deleteSystemState(key: string): Promise<void> {
    try {
        await db.systemState.delete(key);
    } catch (error) {
        console.error(`Failed to delete system state for key "${key}":`, error);
    }
}
