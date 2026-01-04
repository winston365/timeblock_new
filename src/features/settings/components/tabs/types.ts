/**
 * Settings Tab Types
 *
 * @role Settings 모달의 탭 컴포넌트들이 공유하는 타입 정의
 * @input 없음 (타입 정의 파일)
 * @output Props 인터페이스, 공유 타입
 * @external_dependencies
 *   - Settings: 앱 설정 타입
 *   - SyncLogEntry: Firebase 동기화 로그 타입
 *   - DailyTokenUsage: 토큰 사용량 타입
 */

import type { Settings, DontDoChecklistItem, TimeSlotTagTemplate, DailyTokenUsage } from '@/shared/types/domain';
import type { SyncAction, SyncType, SyncLogEntry } from '@/shared/services/sync/syncLogger';

// Setter type for local settings
export type SetLocalSettings = React.Dispatch<React.SetStateAction<Settings | null>>;

// Shared types for Settings tabs
export interface BaseTabProps {
    localSettings: Settings | null;
    setLocalSettings: SetLocalSettings;
}

export interface AppearanceTabProps {
    currentTheme: string;
    setCurrentTheme: (theme: string) => void;
    appVersion: string;
    checkingUpdate: boolean;
    updateStatus: string;
    handleCheckForUpdates: () => Promise<void>;
}

export interface GeminiTabProps extends BaseTabProps {}

export interface FirebaseTabProps extends BaseTabProps {}

export interface DontDoTabProps extends BaseTabProps {}

export interface ShortcutsTabProps extends BaseTabProps {}

export interface LogsTabProps {
    logs: SyncLogEntry[];
    tokenUsage: DailyTokenUsage[];
    filterType: SyncType | 'all';
    setFilterType: (type: SyncType | 'all') => void;
    filterAction: SyncAction | 'all';
    setFilterAction: (action: SyncAction | 'all') => void;
    handleClearLogs: () => void;
}

// Re-export for convenience
export type { 
    Settings, 
    DontDoChecklistItem, 
    TimeSlotTagTemplate,
    SyncAction, 
    SyncType, 
    SyncLogEntry,
    DailyTokenUsage 
};
