/**
 * Stats Tab Types
 *
 * @role Stats 모달의 탭 컴포넌트들이 공유하는 타입 정의
 * @input 없음 (타입 정의 파일)
 * @output FilterProps, XPHistoryEntry, Tab Props 인터페이스
 * @external_dependencies
 *   - GameState: 게임 상태 타입
 */

import type { GameState } from '@/shared/types/domain';

// Common filter props shared between tabs
export interface FilterProps {
    rangeDays: 7 | 14 | 30;
    onRangeDaysChange: (days: 7 | 14 | 30) => void;
    includeWeekends: boolean;
    onIncludeWeekendsChange: (include: boolean) => void;
    todayOnly: boolean;
    onTodayOnlyChange: (only: boolean) => void;
    showLastWeekComparison: boolean;
    onShowLastWeekComparisonChange: (show: boolean) => void;
    showAdvancedFilters: boolean;
    onShowAdvancedFiltersToggle: () => void;
    blockVisibility: Record<string, boolean>;
    onBlockVisibilityChange: (blockId: string, visible: boolean) => void;
}

// XP History entry type
export interface XPHistoryEntry {
    date: string;
    xp: number;
    lastWeekXP?: number;
}

// Stacked block data type
export interface StackedBlockDataEntry {
    date: string;
    [blockId: string]: number | string;
}

// Today block pie chart data type
export interface TodayBlockPieEntry {
    id: string;
    name: string;
    value: number;
}

// Goal progress type
export interface GoalProgress {
    current: number;
    target: number;
    percentage: number;
}

// Overview Tab Props
export interface OverviewTabProps {
    gameState: GameState;
    weeklyProgress: GoalProgress | null;
    monthlyProgress: GoalProgress | null;
    numberFormatter: Intl.NumberFormat;
}

// XP Analysis Tab Props
export interface XPAnalysisTabProps extends FilterProps {
    xpHistory: XPHistoryEntry[];
    averageXP: number;
    maxXP: number;
    numberFormatter: Intl.NumberFormat;
}

// Time Blocks Tab Props
export interface TimeBlocksTabProps extends FilterProps {
    gameState: GameState;
    stackedBlockData: StackedBlockDataEntry[];
    todayBlockPie: TodayBlockPieEntry[];
    todayXP: number;
    todayBlockSum: number;
    xpMismatch: boolean;
    numberFormatter: Intl.NumberFormat;
}

// Insights Tab Props
export interface InsightsTabProps {
    insight: string | null;
    isGeneratingInsight: boolean;
    insightError: string | null;
    onGenerateInsight: () => void;
}

// Summary Card Props (re-exported for convenience)
export interface SummaryCardProps {
    title: string;
    value: number | string;
    accent?: boolean;
}

// Today Block Progress Props
export interface TodayBlockProgressProps {
    blocks: GameState['timeBlockXP'];
}
