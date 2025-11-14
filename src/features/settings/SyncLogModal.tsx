/**
 * 전체 로그 모달 (동기화 로그 + Gemini 토큰 사용량)
 */

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
import './syncLog.css';

type TabType = 'sync' | 'tokens';

// Gemini 2.5 Flash 가격 (2025-01 기준)
const PRICE_PER_MILLION_INPUT = 1.25; // US$ 1.25 per 1M input tokens
const PRICE_PER_MILLION_OUTPUT = 10.0; // US$ 10.00 per 1M output tokens

/**
 * 토큰 비용 계산 (USD)
 */
function calculateTokenCost(promptTokens: number, candidatesTokens: number): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (promptTokens / 1_000_000) * PRICE_PER_MILLION_INPUT;
  const outputCost = (candidatesTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

/**
 * 비용을 포맷팅 (USD)
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

interface SyncLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncLogModal({ isOpen, onClose }: SyncLogModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('sync');
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [tokenUsage, setTokenUsage] = useState<DailyTokenUsage[]>([]);
  const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
  const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 로그 및 토큰 사용량 로드
  useEffect(() => {
    if (!isOpen) return;

    // 초기 로그 로드 (설정 관련 로그 제외)
    const allLogs = getSyncLogs();
    const filteredLogs = allLogs.filter(log =>
      !log.message.toLowerCase().includes('settings') &&
      !log.message.toLowerCase().includes('설정')
    );
    setLogs(filteredLogs);

    // 토큰 사용량 로드
    loadAllTokenUsage().then(setTokenUsage).catch(console.error);

    // 실시간 업데이트 구독
    const unsubscribe = subscribeSyncLogs((newLogs) => {
      const filtered = newLogs.filter(log =>
        !log.message.toLowerCase().includes('settings') &&
        !log.message.toLowerCase().includes('설정')
      );
      setLogs(filtered);
    });

    return unsubscribe;
  }, [isOpen]);

  // 로그 필터링
  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    return true;
  });

  // 로그 초기화
  const handleClearLogs = () => {
    if (confirm('모든 동기화 로그를 삭제하시겠습니까?')) {
      clearSyncLogs();
    }
  };

  // 시간 포맷팅
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 액션 아이콘
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

  // 타입 뱃지 색상
  const getTypeBadgeClass = (type: SyncType) => {
    return type === 'dexie' ? 'type-badge-dexie' : 'type-badge-firebase';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sync-log-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div>
            <h2>📊 전체 로그</h2>
            <p className="modal-subtitle">동기화 로그 및 Gemini 토큰 사용량</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="log-tabs">
          <button
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 동기화 로그
          </button>
          <button
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens')}
          >
            🪙 Gemini 토큰
          </button>
        </div>

        {/* 동기화 로그 탭 */}
        {activeTab === 'sync' && (
          <>
            {/* 필터 */}
            <div className="sync-log-filters">
          <div className="filter-group">
            <label>타입:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as SyncType | 'all')}
            >
              <option value="all">전체</option>
              <option value="dexie">Dexie</option>
              <option value="firebase">Firebase</option>
            </select>
          </div>

          <div className="filter-group">
            <label>액션:</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as SyncAction | 'all')}
            >
              <option value="all">전체</option>
              <option value="save">저장</option>
              <option value="load">로드</option>
              <option value="sync">동기화</option>
              <option value="error">에러</option>
            </select>
          </div>

          <div className="filter-stats">
            <span className="stat-badge">
              총 {filteredLogs.length}개
            </span>
            <span className="stat-badge">
              Dexie {logs.filter((l) => l.type === 'dexie').length}
            </span>
            <span className="stat-badge">
              Firebase {logs.filter((l) => l.type === 'firebase').length}
            </span>
          </div>

          <button className="btn-clear-logs" onClick={handleClearLogs}>
            🗑️ 로그 삭제
          </button>
        </div>

        {/* 로그 목록 */}
        <div className="sync-log-content">
          {filteredLogs.length === 0 ? (
            <div className="sync-log-empty">
              {logs.length === 0 ? '동기화 로그가 없습니다.' : '필터 조건에 맞는 로그가 없습니다.'}
            </div>
          ) : (
            <div className="sync-log-list">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`sync-log-item ${log.action === 'error' ? 'log-error' : ''}`}
                >
                  <div className="log-header">
                    <div className="log-meta">
                      <span className="log-icon">{getActionIcon(log.action)}</span>
                      <span className={`log-type-badge ${getTypeBadgeClass(log.type)}`}>
                        {log.type.toUpperCase()}
                      </span>
                      <span className="log-time">{formatTime(log.timestamp)}</span>
                    </div>
                  </div>

                  <div className="log-message">{log.message}</div>

                  {log.data && (
                    <div className="log-data">
                      <strong>Data:</strong> {log.data}
                    </div>
                  )}

                  {log.error && (
                    <div className="log-error-message">
                      <strong>Error:</strong> {log.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {/* Gemini 토큰 탭 */}
        {activeTab === 'tokens' && (
          <div className="token-usage-content">
            {tokenUsage.length === 0 ? (
              <div className="sync-log-empty">
                토큰 사용 기록이 없습니다.
              </div>
            ) : (
              <div className="token-usage-list">
                {/* 통계 요약 */}
                <div className="token-stats-summary">
                  <div className="stat-card">
                    <div className="stat-label">총 메시지</div>
                    <div className="stat-value">
                      {tokenUsage.reduce((sum, t) => sum + t.messageCount, 0)}개
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">총 입력 토큰</div>
                    <div className="stat-value">
                      {tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0).toLocaleString()}
                    </div>
                    <div className="stat-sublabel">
                      {formatCost(calculateTokenCost(tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0), 0).inputCost)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">총 출력 토큰</div>
                    <div className="stat-value">
                      {tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0).toLocaleString()}
                    </div>
                    <div className="stat-sublabel">
                      {formatCost(calculateTokenCost(0, tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0)).outputCost)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">총합</div>
                    <div className="stat-value primary">
                      {tokenUsage.reduce((sum, t) => sum + t.totalTokens, 0).toLocaleString()}
                    </div>
                    <div className="stat-sublabel">
                      {formatCost(calculateTokenCost(
                        tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0),
                        tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0)
                      ).totalCost)}
                    </div>
                  </div>
                </div>

                {/* 일별 목록 */}
                <div className="token-usage-table">
                  <table>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>메시지</th>
                        <th>입력 토큰</th>
                        <th>출력 토큰</th>
                        <th>총 토큰</th>
                        <th>예상 비용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((usage) => {
                          const cost = calculateTokenCost(usage.promptTokens, usage.candidatesTokens);
                          return (
                            <tr key={usage.date}>
                              <td className="date-cell">{usage.date}</td>
                              <td>{usage.messageCount}개</td>
                              <td>{usage.promptTokens.toLocaleString()}</td>
                              <td>{usage.candidatesTokens.toLocaleString()}</td>
                              <td className="total-cell">{usage.totalTokens.toLocaleString()}</td>
                              <td className="cost-cell">{formatCost(cost.totalCost)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 푸터 */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
