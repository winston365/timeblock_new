import { useState, useEffect } from 'react';
import {
  getSyncLogs,
  clearSyncLogs,
  subscribeSyncLogs,
  type SyncLogEntry,
  type SyncType,
  type SyncAction,
} from '@/shared/services/syncLogger';
import { loadAllTokenUsage } from '@/data/repositories/chatHistoryRepository';
import type { DailyTokenUsage } from '@/shared/types/domain';

const PRICE_PER_MILLION_INPUT = 1.25;
const PRICE_PER_MILLION_OUTPUT = 10.0;

const overlayClass =
  'fixed inset-0 z-[1000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-6 backdrop-blur-sm md:items-center';
const containerClass =
  'flex h-[min(90vh,840px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)]';
const tabButtonClass =
  'flex-1 rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition';
const selectClass =
  'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30';
const dangerButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]/30';

function calculateTokenCost(promptTokens: number, candidatesTokens: number) {
  const inputCost = (promptTokens / 1_000_000) * PRICE_PER_MILLION_INPUT;
  const outputCost = (candidatesTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

function formatCost(cost: number) {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

const getActionIcon = (action: SyncAction) => {
  switch (action) {
    case 'save':
      return '💾';
    case 'load':
      return '📥';
    case 'sync':
      return '🔁';
    case 'error':
      return '⚠️';
    default:
      return 'ℹ️';
  }
};

const getTypeBadgeClass = (type: SyncType) =>
  type === 'dexie'
    ? 'bg-[rgba(34,197,94,0.15)] text-[var(--color-success,#22c55e)]'
    : 'bg-[rgba(99,102,241,0.15)] text-[var(--color-primary)]';

interface SyncLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncLogModal({ isOpen, onClose }: SyncLogModalProps) {
  const [activeTab, setActiveTab] = useState<'sync' | 'tokens'>('sync');
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [tokenUsage, setTokenUsage] = useState<DailyTokenUsage[]>([]);
  const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
  const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const sanitizedLogs = getSyncLogs().filter(
      log => !log.message.toLowerCase().includes('settings') && !log.message.includes('설정')
    );
    setLogs(sanitizedLogs);
    loadAllTokenUsage().then(setTokenUsage).catch(console.error);

    const unsubscribe = subscribeSyncLogs(newLogs => {
      const filtered = newLogs.filter(
        log => !log.message.toLowerCase().includes('settings') && !log.message.includes('설정')
      );
      setLogs(filtered);
    });

    return unsubscribe;
  }, [isOpen]);

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    return true;
  });

  const handleClearLogs = () => {
    if (confirm('모든 동기화 로그를 삭제할까요?')) {
      clearSyncLogs();
    }
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const totalMessages = tokenUsage.reduce((sum, t) => sum + t.messageCount, 0);
  const totalPromptTokens = tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0);
  const totalOutputTokens = tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0);
  const totalTokens = tokenUsage.reduce((sum, t) => sum + t.totalTokens, 0);
  const aggregateCost = calculateTokenCost(totalPromptTokens, totalOutputTokens);

  if (!isOpen) return null;

  return (
    <div className={overlayClass} onClick={handleOverlayClick}>
      <div className={containerClass}>
        <div className="flex items-start justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">📡 동기화 로그</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Firebase / Dexie 동기화와 Gemini 토큰 사용량을 확인하세요.</p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-3">
          {(['sync', 'tokens'] as const).map(tab => (
            <button
              key={tab}
              className={`${tabButtonClass} ${activeTab === tab ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-inner' : ''}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab === 'sync' ? '동기화 로그' : '토큰 사용'}
            </button>
          ))}
        </div>

        {activeTab === 'sync' ? (
          <>
            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-6 py-4 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <label>출처</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value as SyncType | 'all')} className={selectClass}>
                  <option value="all">전체</option>
                  <option value="dexie">Dexie</option>
                  <option value="firebase">Firebase</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label>액션</label>
                <select
                  value={filterAction}
                  onChange={e => setFilterAction(e.target.value as SyncAction | 'all')}
                  className={selectClass}
                >
                  <option value="all">전체</option>
                  <option value="save">저장</option>
                  <option value="load">로드</option>
                  <option value="sync">동기화</option>
                  <option value="error">오류</option>
                </select>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <span className="rounded-full bg-[var(--color-bg)] px-3 py-1">총 {filteredLogs.length}건</span>
                <span className="rounded-full bg-[var(--color-bg)] px-3 py-1">Dexie {logs.filter(l => l.type === 'dexie').length}</span>
                <span className="rounded-full bg-[var(--color-bg)] px-3 py-1">
                  Firebase {logs.filter(l => l.type === 'firebase').length}
                </span>
              </div>

              <button className={dangerButtonClass} onClick={handleClearLogs}>
                로그 초기화
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {filteredLogs.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-sm text-[var(--color-text-secondary)]">
                  {logs.length === 0 ? '수집된 로그가 없습니다.' : '필터 조건에 맞는 로그가 없습니다.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map(log => (
                    <div
                      key={log.id}
                      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm ${
                        log.action === 'error' ? 'border-l-4 border-[var(--color-danger)]' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <span className="text-base">{getActionIcon(log.action)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getTypeBadgeClass(log.type)}`}>
                            {log.type.toUpperCase()}
                          </span>
                          <span>{formatTime(log.timestamp)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">{log.message}</div>
                      {log.data && (
                        <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                          <strong className="text-[var(--color-text)]">Data:</strong> {log.data}
                        </div>
                      )}
                      {log.error && (
                        <div className="mt-2 text-xs text-[var(--color-danger)]">
                          <strong>Error:</strong> {log.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {tokenUsage.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-sm text-[var(--color-text-secondary)]">
                토큰 사용 기록이 없습니다.
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">총 메시지</p>
                    <p className="text-2xl font-bold text-[var(--color-text)]">{totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">입력 토큰</p>
                    <p className="text-2xl font-bold">{totalPromptTokens.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{formatCost(aggregateCost.inputCost)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">출력 토큰</p>
                    <p className="text-2xl font-bold">{totalOutputTokens.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{formatCost(aggregateCost.outputCost)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">총 사용량</p>
                    <p className="text-2xl font-bold text-[var(--color-primary)]">{totalTokens.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{formatCost(aggregateCost.totalCost)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--color-bg-secondary)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        <th className="border border-[var(--color-border)] px-3 py-2 text-left">날짜</th>
                        <th className="border border-[var(--color-border)] px-3 py-2 text-right">메시지</th>
                        <th className="border border-[var(--color-border)] px-3 py-2 text-right">입력 토큰</th>
                        <th className="border border-[var(--color-border)] px-3 py-2 text-right">출력 토큰</th>
                        <th className="border border-[var(--color-border)] px-3 py-2 text-right">총 토큰</th>
                        <th className="border border-[var(--color-border)] px-3 py-2 text-right">예상 비용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(entry => {
                          const cost = calculateTokenCost(entry.promptTokens, entry.candidatesTokens);
                          return (
                            <tr key={entry.date} className="text-[var(--color-text)]">
                              <td className="border border-[var(--color-border)] px-3 py-2 font-mono text-sm">{entry.date}</td>
                              <td className="border border-[var(--color-border)] px-3 py-2 text-right">{entry.messageCount.toLocaleString()}</td>
                              <td className="border border-[var(--color-border)] px-3 py-2 text-right">{entry.promptTokens.toLocaleString()}</td>
                              <td className="border border-[var(--color-border)] px-3 py-2 text-right">{entry.candidatesTokens.toLocaleString()}</td>
                              <td className="border border-[var(--color-border)] px-3 py-2 text-right font-semibold text-[var(--color-primary)]">
                                {entry.totalTokens.toLocaleString()}
                              </td>
                              <td className="border border-[var(--color-border)] px-3 py-2 text-right text-[var(--color-text-secondary)]">
                                {formatCost(cost.totalCost)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <button className={secondaryButtonClass} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
