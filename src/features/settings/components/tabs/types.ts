import type { Settings, DontDoChecklistItem, TimeSlotTagTemplate } from '@/shared/types';
import type { SyncAction, SyncType, SyncLogEntry } from '@/shared/services/firebase/syncLogger';
import type { DailyTokenUsage } from '@/data/repositories/tokenUsageRepository';

// Setter type for local settings
export type SetLocalSettings = React.Dispatch<React.SetStateAction<Settings | null>>;

// Shared types for Settings tabs
export interface BaseTabProps {
    localSettings: Settings | null;
    setLocalSettings: SetLocalSettings;
}

export interface AppearanceTabProps extends BaseTabProps {
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
