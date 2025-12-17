/**
 * DirectQueryService - 구조화된 데이터 직접 조회
 * 
 * @role RAG 벡터 검색 대신 Repository를 통해 정확한 결과 반환
 *       날짜, 완료 상태 등 구조화된 조건은 벡터 검색보다 직접 쿼리가 효율적
 */

import { getRecentDailyData, loadDailyData } from '@/data/repositories/dailyDataRepository';
import { loadCompletedInboxTasks } from '@/data/repositories/inboxRepository';
import type { Task } from '@/shared/types/domain';
import type { ParsedQuery } from './queryParser';
import { getLocalDate } from '@/shared/lib/utils';

export interface QueryResult {
    tasks: TaskWithDate[];
    summary: {
        totalCount: number;
        completedCount: number;
        pendingCount: number;
        dateRange: string;
    };
}

export interface TaskWithDate extends Task {
    date: string;  // 작업이 속한 날짜
}

/**
 * 파싱된 쿼리를 기반으로 Repository에서 직접 데이터 조회
 */
export async function executeDirectQuery(parsed: ParsedQuery): Promise<QueryResult> {
    const tasks: TaskWithDate[] = [];

    // 날짜 범위 결정
    let dates: string[] = [];

    if (parsed.dateFilter) {
        // 특정 날짜
        dates = [parsed.dateFilter];
    } else if (parsed.dateRange) {
        // 날짜 범위
        dates = getDatesBetween(parsed.dateRange.start, parsed.dateRange.end);
    } else {
        // 기본값: 최근 30일
        const recentData = await getRecentDailyData(30);
        dates = recentData.map(d => d.date);
    }

    // DailyData에서 작업 수집
    for (const date of dates) {
        const dailyData = await loadDailyData(date);
        if (dailyData?.tasks) {
            for (const task of dailyData.tasks) {
                // 완료 상태 필터
                if (parsed.completedFilter !== undefined) {
                    if (task.completed !== parsed.completedFilter) continue;
                }

                // 시간대 필터
                if (parsed.timeBlockFilter && task.timeBlock !== parsed.timeBlockFilter) {
                    continue;
                }

                // 키워드 필터 (하나라도 포함되면 통과)
                if (parsed.keywords.length > 0) {
                    const taskText = `${task.text} ${task.memo || ''}`.toLowerCase();
                    const hasKeyword = parsed.keywords.some(kw => 
                        taskText.includes(kw.toLowerCase())
                    );
                    // 키워드 필터는 semantic search에서만 적용
                    if (parsed.queryType === 'semantic_search' && !hasKeyword) continue;
                }

                tasks.push({ ...task, date });
            }
        }
    }

    // CompletedInbox에서도 수집 (날짜 범위에 해당하는 것만)
    if (parsed.completedFilter !== false) {
        const completedInboxTasks = await loadCompletedInboxTasks();
        for (const task of completedInboxTasks) {
            if (!task.completedAt) continue;
            
            const taskDate = task.completedAt.slice(0, 10);
            
            // 날짜 필터 체크
            if (parsed.dateFilter && taskDate !== parsed.dateFilter) continue;
            if (parsed.dateRange) {
                if (taskDate < parsed.dateRange.start || taskDate > parsed.dateRange.end) continue;
            }

            // 중복 체크 (이미 dailyData에서 추가된 경우)
            if (tasks.some(t => t.id === task.id)) continue;

            tasks.push({ ...task, date: taskDate });
        }
    }

    // 결과 정렬 (최신 순)
    tasks.sort((a, b) => {
        // 완료 시간 기준 정렬 (있으면)
        if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        }
        // 날짜 기준 정렬
        return b.date.localeCompare(a.date);
    });

    // 요약 생성
    const completedCount = tasks.filter(t => t.completed).length;
    const dateRange = dates.length === 1 
        ? dates[0] 
        : `${dates[dates.length - 1]} ~ ${dates[0]}`;

    return {
        tasks,
        summary: {
            totalCount: tasks.length,
            completedCount,
            pendingCount: tasks.length - completedCount,
            dateRange,
        },
    };
}

/**
 * 통계 쿼리 실행 (몇 개, 얼마나 등)
 */
export async function executeStatsQuery(parsed: ParsedQuery): Promise<string> {
    const result = await executeDirectQuery(parsed);
    const { tasks, summary } = result;

    // 날짜별 그룹화
    const tasksByDate: Record<string, TaskWithDate[]> = {};
    for (const task of tasks) {
        if (!tasksByDate[task.date]) tasksByDate[task.date] = [];
        tasksByDate[task.date].push(task);
    }

    const parts: string[] = [];
    parts.push(`📊 **조회 결과 요약**`);
    parts.push(`- 기간: ${summary.dateRange}`);
    parts.push(`- 총 작업: ${summary.totalCount}개`);
    parts.push(`- 완료: ${summary.completedCount}개 (${Math.round(summary.completedCount / summary.totalCount * 100) || 0}%)`);
    parts.push(`- 미완료: ${summary.pendingCount}개`);
    parts.push('');

    // 날짜별 상세 (최신 5일만)
    const sortedDates = Object.keys(tasksByDate).sort().reverse().slice(0, 5);
    if (sortedDates.length > 0) {
        parts.push(`📅 **날짜별 상세** (최근 ${sortedDates.length}일)`);
        for (const date of sortedDates) {
            const dateTasks = tasksByDate[date];
            const completed = dateTasks.filter(t => t.completed);
            parts.push(`\n${date}: ${dateTasks.length}개 (✅${completed.length}개 완료)`);
            
            // 완료된 작업 목록
            if (completed.length > 0) {
                const taskNames = completed.slice(0, 5).map(t => t.text);
                parts.push(`  ✅ ${taskNames.join(', ')}${completed.length > 5 ? ` 외 ${completed.length - 5}개` : ''}`);
            }
        }
    }

    return parts.join('\n');
}

/**
 * 작업 목록을 AI 컨텍스트 형식으로 포맷
 */
export function formatTasksAsContext(tasks: TaskWithDate[], maxTasks: number = 30): string {
    if (tasks.length === 0) return '';

    // 날짜별 그룹화
    const tasksByDate: Record<string, TaskWithDate[]> = {};
    for (const task of tasks.slice(0, maxTasks)) {
        if (!tasksByDate[task.date]) tasksByDate[task.date] = [];
        tasksByDate[task.date].push(task);
    }

    const parts: string[] = [];
    const sortedDates = Object.keys(tasksByDate).sort().reverse();

    for (const date of sortedDates) {
        const dateTasks = tasksByDate[date];
        const completedTasks = dateTasks.filter(t => t.completed);
        const pendingTasks = dateTasks.filter(t => !t.completed);

        parts.push(`\n📅 ${date}:`);

        if (completedTasks.length > 0) {
            parts.push(`  ✅ 완료된 작업 (${completedTasks.length}개):`);
            for (const task of completedTasks) {
                const memo = task.memo ? ` (${task.memo})` : '';
                const time = task.completedAt 
                    ? ` [${new Date(task.completedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}]`
                    : '';
                parts.push(`    - ${task.text}${memo}${time}`);
            }
        }

        if (pendingTasks.length > 0) {
            parts.push(`  ⏳ 미완료 작업 (${pendingTasks.length}개):`);
            for (const task of pendingTasks) {
                const memo = task.memo ? ` (${task.memo})` : '';
                parts.push(`    - ${task.text}${memo}`);
            }
        }
    }

    if (tasks.length > maxTasks) {
        parts.push(`\n... 외 ${tasks.length - maxTasks}개 작업`);
    }

    return parts.join('\n');
}

// 헬퍼 함수
function getDatesBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(getLocalDate(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}
