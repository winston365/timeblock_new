/**
 * 동기화 로그 모달
 */

import { useState, useEffect } from 'react';
import {
  getSyncLogs,
  clearSyncLogs,
  subscribeSyncLogs,
  filterSyncLogs,
  type SyncLogEntry,
  type SyncType,
  type SyncAction,
} from '@/shared/services/syncLogger';
import './syncLog.css';

interface SyncLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncLogModal({ isOpen, onClose }: SyncLogModalProps) {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
  const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');

  // 로그 구독
  useEffect(() => {
    if (!isOpen) return;

    // 초기 로그 로드
    setLogs(getSyncLogs());

    // 실시간 업데이트 구독
    const unsubscribe = subscribeSyncLogs((newLogs) => {
      setLogs(newLogs);
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
            <h2>📊 동기화 로그</h2>
            <p className="modal-subtitle">Dexie 및 Firebase 동기화 기록</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

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
