/**
 * LogsTab
 *
 * @role 동기화 로그 및 Gemini 토큰 사용량 모니터링 탭
 * @input LogsTabProps (logs, tokenUsage, 필터 상태 등)
 * @output 동기화 로그 목록, 토큰 사용량 테이블 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import { useState } from 'react';
import type { LogsTabProps, SyncLogEntry, SyncType, SyncAction, DailyTokenUsage } from './types';
import { sectionClass, infoBoxClass, calculateTokenCost, formatCost } from './styles';

export function LogsTab({
    logs,
    tokenUsage,
    filterType,
    setFilterType,
    filterAction,
    setFilterAction,
    handleClearLogs,
}: LogsTabProps) {
    // Sub-tab state managed internally
    const [logSubTab, setLogSubTab] = useState<'sync' | 'tokens'>('sync');

    const filteredLogs = logs.filter((log: SyncLogEntry) => {
        if (filterType !== 'all' && log.type !== filterType) return false;
        if (filterAction !== 'all' && log.action !== filterAction) return false;
        return true;
    });

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getActionIcon = (action: SyncAction) => {
        switch (action) {
            case 'save':
                return '💾';
            case 'load':
                return '📥';
            case 'sync':
                return '🔄';
            case 'error':
                return '❌';
            default:
                return '📝';
        }
    };

    const getTypeBadgeClass = (type: SyncType) =>
        type === 'dexie'
            ? 'rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-indigo-100'
            : 'rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-100';

    return (
        <div className={sectionClass}>
            {/* 서브 탭 */}
            <div className="flex gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                <button
                    className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${logSubTab === 'sync'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    onClick={() => setLogSubTab('sync')}
                >
                    🔄 동기화 로그
                </button>
                <button
                    className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${logSubTab === 'tokens'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    onClick={() => setLogSubTab('tokens')}
                >
                    🪙 Gemini 토큰
                </button>
            </div>

            {/* 동기화 로그 */}
            {logSubTab === 'sync' && (
                <>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        <label className="flex items-center gap-2">
                            <span>타입:</span>
                            <select
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value as SyncType | 'all')}
                            >
                                <option value="all">전체</option>
                                <option value="dexie">Dexie</option>
                                <option value="firebase">Firebase</option>
                            </select>
                        </label>

                        <label className="flex items-center gap-2">
                            <span>액션:</span>
                            <select
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value as SyncAction | 'all')}
                            >
                                <option value="all">전체</option>
                                <option value="save">저장</option>
                                <option value="load">로드</option>
                                <option value="sync">동기화</option>
                                <option value="error">오류</option>
                            </select>
                        </label>

                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em]">
                                총 {filteredLogs.length}개
                            </span>
                            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-indigo-200">
                                Dexie {logs.filter((l: SyncLogEntry) => l.type === 'dexie').length}
                            </span>
                            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-amber-200">
                                Firebase {logs.filter((l: SyncLogEntry) => l.type === 'firebase').length}
                            </span>
                            <button
                                className="rounded-2xl border border-rose-400/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                                onClick={handleClearLogs}
                            >
                                🗑️ 로그 삭제
                            </button>
                        </div>
                    </div>

                    <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
                        {filteredLogs.length === 0 ? (
                            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                                {logs.length === 0 ? '동기화 로그가 없습니다.' : '필터 조건에 맞는 로그가 없습니다.'}
                            </div>
                        ) : (
                            filteredLogs.map((log: SyncLogEntry) => (
                                <div
                                    key={log.id}
                                    className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs transition hover:bg-[var(--color-bg-elevated)]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={getTypeBadgeClass(log.type)}>{log.type}</span>
                                            <span className="font-mono text-[var(--color-text-tertiary)]">{formatTime(log.timestamp)}</span>
                                        </div>
                                        <span title={log.action} className="text-base">
                                            {getActionIcon(log.action)}
                                        </span>
                                    </div>
                                    <div className="font-medium text-[var(--color-text)]">{log.message}</div>
                                    {log.details && (
                                        <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-bg-tertiary)] p-2 font-mono text-[10px] text-[var(--color-text-secondary)]">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* 토큰 사용량 */}
            {logSubTab === 'tokens' && (
                <div className="flex flex-col gap-4">
                    <div className={infoBoxClass}>
                        <strong>💰 예상 비용:</strong> Gemini 2.5 Flash 기준 (Input $2.00/1M, Output $12.00/1M)
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                        {tokenUsage.length === 0 ? (
                            <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-secondary)]">
                                토큰 사용 기록이 없습니다.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-[var(--color-bg-tertiary)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">날짜</th>
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">메시지</th>
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">입력 토큰</th>
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">출력 토큰</th>
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">총 토큰</th>
                                            <th className="border border-[var(--color-border)] px-3 py-2 text-left">예상 비용</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...tokenUsage]
                                            .sort((a: DailyTokenUsage, b: DailyTokenUsage) => b.date.localeCompare(a.date))
                                            .map((usage: DailyTokenUsage) => {
                                                const { inputCost, outputCost, totalCost } = calculateTokenCost(usage.promptTokens, usage.candidatesTokens);
                                                return (
                                                    <tr key={usage.date} className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                                                        <td className="border border-[var(--color-border)] px-3 py-2 font-mono">{usage.date}</td>
                                                        <td className="border border-[var(--color-border)] px-3 py-2">{usage.messageCount.toLocaleString()}개</td>
                                                        <td className="border border-[var(--color-border)] px-3 py-2">{usage.promptTokens.toLocaleString()}</td>
                                                        <td className="border border-[var(--color-border)] px-3 py-2">{usage.candidatesTokens.toLocaleString()}</td>
                                                        <td className="border border-[var(--color-border)] px-3 py-2 font-semibold text-[var(--color-primary)]">{usage.totalTokens.toLocaleString()}</td>
                                                        <td className="border border-[var(--color-border)] px-3 py-2">
                                                            <div className="flex flex-col text-[var(--color-text-secondary)]">
                                                                <span>{formatCost(totalCost)}</span>
                                                                <span className="text-[10px]">입력 {formatCost(inputCost)} · 출력 {formatCost(outputCost)}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
