/**
 * SettingsModal
 *
 * @role Gemini API 키, Firebase 설정, 테마 설정을 관리하는 모달 컴포넌트
 * @input isOpen (모달 표시 여부), onClose (모달 닫기), onSaved (저장 완료 콜백)
 * @output 탭 기반 설정 UI (테마, Gemini, Firebase)
 * @external_dependencies
 *   - settingsRepository: 설정 데이터 로드/저장
 *   - firebaseService: Firebase 초기화
 */

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/data/repositories/settingsRepository';
import { initializeFirebase } from '@/shared/services/firebaseService';
import type { Settings } from '@/shared/types/domain';
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
import './settings.css';
import './syncLog.css';

// Gemini 2.5 Flash 가격 (2025-01 기준)
const PRICE_PER_MILLION_INPUT = 1.25; // US$ 1.25 per 1M input tokens
const PRICE_PER_MILLION_OUTPUT = 10.0; // US$ 10.00 per 1M output tokens

/**
 * 토큰 비용 계산
 */
function calculateTokenCost(promptTokens: number, candidatesTokens: number): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (promptTokens / 1_000_000) * PRICE_PER_MILLION_INPUT;
  const outputCost = (candidatesTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

/**
 * 비용 포맷팅
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * 설정 모달 컴포넌트
 *
 * @param {SettingsModalProps} props - 컴포넌트 props
 * @returns {JSX.Element | null} 설정 모달 또는 null
 * @sideEffects
 *   - 설정 데이터 로드/저장
 *   - Firebase 재초기화
 *   - 테마 변경 시 DOM 및 localStorage 업데이트
 */
export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    autoMessageInterval: 30,
    autoMessageEnabled: false,
    waifuMode: 'characteristic',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'gemini' | 'firebase' | 'appearance' | 'logs'>('gemini');
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || '';
  });

  // 로그 관련 state
  const [logSubTab, setLogSubTab] = useState<'sync' | 'tokens'>('sync');
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [tokenUsage, setTokenUsage] = useState<DailyTokenUsage[]>([]);
  const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
  const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');
  const [appVersion, setAppVersion] = useState<string>('...');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  // 설정 로드
  useEffect(() => {
    if (isOpen) {
      loadSettingsData();
      // Electron 환경에서 앱 버전 가져오기
      if (window.electronAPI?.getAppVersion) {
        window.electronAPI.getAppVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
      } else {
        // 웹 환경일 경우
        setAppVersion('Web Version');
      }
    }
  }, [isOpen]);

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
    if (!isOpen || activeTab !== 'logs') return;

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
  }, [isOpen, activeTab]);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const data = await loadSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // 테마 변경
  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    }
  };

  // 설정 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(settings);

      // Firebase 설정이 있으면 재초기화
      if (settings.firebaseConfig) {
        const initialized = initializeFirebase(settings.firebaseConfig);
        if (initialized) {
        }
      }

      alert('설정이 저장되었습니다!');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 로그 관련 헬퍼 함수들
  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    return true;
  });

  const handleClearLogs = () => {
    if (confirm('모든 동기화 로그를 삭제하시겠습니까?')) {
      clearSyncLogs();
    }
  };

  // 수동 업데이트 체크
  const handleCheckForUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setUpdateStatus('❌ Electron 환경이 아닙니다 (웹 버전)');
      return;
    }

    try {
      setCheckingUpdate(true);
      setUpdateStatus('🔍 업데이트 확인 중...');

      const result = await window.electronAPI.checkForUpdates();

      if (result.success) {
        if (result.updateInfo) {
          setUpdateStatus(`✅ 업데이트 확인 완료! (현재: v${result.currentVersion})`);
        } else {
          setUpdateStatus(`✅ 최신 버전입니다 (v${result.currentVersion})`);
        }
      } else {
        setUpdateStatus(`❌ ${result.message}`);
      }
    } catch (error: any) {
      console.error('Update check failed:', error);
      setUpdateStatus(`❌ 오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

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

  const getTypeBadgeClass = (type: SyncType) => {
    return type === 'dexie' ? 'type-badge-dexie' : 'type-badge-firebase';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div>
            <h2>⚙️ 설정</h2>
            <p className="modal-subtitle">API 키 및 앱 설정</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 테마
          </button>
          <button
            className={`settings-tab ${activeTab === 'gemini' ? 'active' : ''}`}
            onClick={() => setActiveTab('gemini')}
          >
            🤖 Gemini AI
          </button>
          <button
            className={`settings-tab ${activeTab === 'firebase' ? 'active' : ''}`}
            onClick={() => setActiveTab('firebase')}
          >
            🔥 Firebase
          </button>
          <button
            className={`settings-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📊 로그
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="settings-content">
          {loading ? (
            <div className="settings-loading">로딩 중...</div>
          ) : (
            <>
              {/* 테마 설정 */}
              {activeTab === 'appearance' && (
                <div className="settings-section">
                  <h3>🎨 테마 설정</h3>
                  <p className="section-description">
                    다양한 색감 테마를 선택하여 나만의 작업 환경을 만들어보세요.
                  </p>

                  <div className="form-group">
                    <label htmlFor="theme-select">테마 선택</label>
                    <select
                      id="theme-select"
                      className="form-input"
                      value={currentTheme}
                      onChange={(e) => handleThemeChange(e.target.value)}
                    >
                      <option value="">Indigo (기본)</option>
                      <option value="ocean">🌊 Ocean - 차분하고 집중력 향상</option>
                      <option value="forest">🌲 Forest - 편안하고 자연스러운</option>
                      <option value="sunset">🌅 Sunset - 따뜻하고 활력적인</option>
                      <option value="purple">💜 Purple Dream - 창의적이고 우아한</option>
                      <option value="rose">🌸 Rose Gold - 세련되고 모던한</option>
                      <option value="midnight">🌃 Midnight - 깊고 프로페셔널한</option>
                      <option value="cyberpunk">⚡ Cyberpunk - 네온과 미래적인</option>
                      <option value="mocha">☕ Mocha - 부드럽고 눈에 편안한</option>
                    </select>
                  </div>

                  <div className="theme-preview">
                    <h4>미리보기</h4>
                    <div className="preview-colors">
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-primary)'
                        }}></div>
                        <span>Primary</span>
                      </div>
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-bg-surface)'
                        }}></div>
                        <span>Surface</span>
                      </div>
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-bg-elevated)'
                        }}></div>
                        <span>Elevated</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-box">
                    <strong>💡 팁:</strong> 테마는 즉시 적용되며, 자동으로 저장됩니다.
                    작업 환경에 맞는 테마를 선택하여 눈의 피로를 줄이고 집중력을 높여보세요!
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h3>ℹ️ 앱 정보</h3>
                  <div className="form-group">
                    <label>현재 버전</label>
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                    }}>
                      v{appVersion}
                    </div>
                    <small className="form-hint">
                      새 버전이 출시되면 앱 시작 시 자동으로 알림이 표시됩니다.
                    </small>
                  </div>

                  <div className="form-group">
                    <label>수동 업데이트 확인</label>
                    <button
                      className="btn-primary"
                      onClick={handleCheckForUpdates}
                      disabled={checkingUpdate}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      {checkingUpdate ? '⏳ 확인 중...' : '🔄 지금 업데이트 확인'}
                    </button>
                    {updateStatus && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: updateStatus.startsWith('✅')
                          ? 'rgba(34, 197, 94, 0.1)'
                          : updateStatus.startsWith('❌')
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${
                          updateStatus.startsWith('✅')
                            ? 'rgba(34, 197, 94, 0.3)'
                            : updateStatus.startsWith('❌')
                            ? 'rgba(239, 68, 68, 0.3)'
                            : 'rgba(59, 130, 246, 0.3)'
                        }`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                      }}>
                        {updateStatus}
                      </div>
                    )}
                    <small className="form-hint">
                      자동 업데이트가 작동하지 않을 때 이 버튼으로 수동 확인할 수 있습니다.
                    </small>
                  </div>

                  <div className="info-box">
                    <strong>🚀 자동 업데이트:</strong> TimeBlock Planner는 GitHub Releases를 통해 자동으로 업데이트됩니다.
                    앱 시작 후 5초 뒤 최신 버전을 확인하며, 새 버전이 있으면 다운로드 및 설치 안내가 표시됩니다.
                  </div>

                  <div className="info-box" style={{ marginTop: '16px' }}>
                    <strong>🔧 업데이트 문제 해결:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>앱을 <strong>프로덕션 빌드</strong>로 실행했는지 확인 (개발 모드에서는 업데이트 비활성화)</li>
                      <li>GitHub Releases에 <code>.exe</code>, <code>.exe.blockmap</code>, <code>latest.yml</code> 파일이 있는지 확인</li>
                      <li>네트워크 연결 확인 (GitHub에 접근 가능해야 함)</li>
                      <li>현재 버전이 <code>v{appVersion}</code>이고, 새 릴리스가 더 높은 버전인지 확인</li>
                    </ul>
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h3>👧 와이푸 모드 설정</h3>
                  <p className="section-description">
                    와이푸 이미지 표시 방식을 선택할 수 있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="waifu-mode-select">모드 선택</label>
                    <select
                      id="waifu-mode-select"
                      className="form-input"
                      value={settings.waifuMode}
                      onChange={(e) =>
                        setSettings({ ...settings, waifuMode: e.target.value as 'normal' | 'characteristic' })
                      }
                    >
                      <option value="characteristic">특성 모드 (호감도에 따라 변화)</option>
                      <option value="normal">일반 모드 (기본 이미지 고정)</option>
                    </select>
                    <small className="form-hint">
                      {settings.waifuMode === 'characteristic'
                        ? '호감도에 따라 다양한 표정의 이미지가 표시됩니다.'
                        : '호감도와 관계없이 기본 이미지만 표시됩니다.'}
                    </small>
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> 설정은 로컬 저장소에 저장되어 페이지를 새로고침해도 유지됩니다.
                  </div>
                </div>
              )}

              {/* Gemini 설정 */}
              {activeTab === 'gemini' && (
                <div className="settings-section">
                  <h3>Gemini AI 설정</h3>
                  <p className="section-description">
                    Google Gemini API를 사용하여 AI 챗봇 기능을 이용할 수 있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="gemini-api-key">
                      Gemini API 키 <span className="required">*</span>
                    </label>
                    <input
                      id="gemini-api-key"
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={settings.geminiApiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, geminiApiKey: e.target.value })
                      }
                    />
                    <small className="form-hint">
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        API 키 발급받기 →
                      </a>
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="insight-interval">
                      💡 인사이트 자동 갱신 주기 (분)
                    </label>
                    <input
                      id="insight-interval"
                      type="number"
                      className="form-input"
                      placeholder="15"
                      min="5"
                      max="120"
                      value={settings.autoMessageInterval || 15}
                      onChange={(e) =>
                        setSettings({ ...settings, autoMessageInterval: parseInt(e.target.value) || 15 })
                      }
                    />
                    <small className="form-hint">
                      오늘의 인사이트 패널이 자동으로 갱신되는 주기입니다. (최소 5분, 최대 120분)
                    </small>
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> Gemini API 키가 없어도 앱의 다른 기능은 정상적으로
                    사용할 수 있습니다. AI 챗봇 및 인사이트 기능만 제한됩니다.
                  </div>
                </div>
              )}

              {/* Firebase 설정 */}
              {activeTab === 'firebase' && (
                <div className="settings-section">
                  <h3>Firebase 설정</h3>
                  <p className="section-description">
                    Firebase Realtime Database를 사용하여 다중 장치 간 데이터를 동기화할 수
                    있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="firebase-api-key">API Key</label>
                    <input
                      id="firebase-api-key"
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={settings.firebaseConfig?.apiKey || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            apiKey: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-auth-domain">Auth Domain</label>
                    <input
                      id="firebase-auth-domain"
                      type="text"
                      className="form-input"
                      placeholder="your-app.firebaseapp.com"
                      value={settings.firebaseConfig?.authDomain || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            authDomain: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-database-url">Database URL</label>
                    <input
                      id="firebase-database-url"
                      type="text"
                      className="form-input"
                      placeholder="https://your-app.firebaseio.com"
                      value={settings.firebaseConfig?.databaseURL || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            databaseURL: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-project-id">Project ID</label>
                    <input
                      id="firebase-project-id"
                      type="text"
                      className="form-input"
                      placeholder="your-app"
                      value={settings.firebaseConfig?.projectId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            projectId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-storage-bucket">Storage Bucket</label>
                    <input
                      id="firebase-storage-bucket"
                      type="text"
                      className="form-input"
                      placeholder="your-app.appspot.com"
                      value={settings.firebaseConfig?.storageBucket || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            storageBucket: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-messaging-sender-id">Messaging Sender ID</label>
                    <input
                      id="firebase-messaging-sender-id"
                      type="text"
                      className="form-input"
                      placeholder="123456789012"
                      value={settings.firebaseConfig?.messagingSenderId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            messagingSenderId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-app-id">App ID</label>
                    <input
                      id="firebase-app-id"
                      type="text"
                      className="form-input"
                      placeholder="1:123456789012:web:abc123def456"
                      value={settings.firebaseConfig?.appId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            appId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> Firebase 설정이 없어도 앱은 로컬 저장소(IndexedDB)를
                    사용하여 정상적으로 동작합니다. 다중 장치 동기화 기능만 제한됩니다.
                  </div>
                </div>
              )}

              {/* 로그 탭 */}
              {activeTab === 'logs' && (
                <div className="settings-section">
                  {/* 서브 탭 */}
                  <div className="log-tabs">
                    <button
                      className={`tab-btn ${logSubTab === 'sync' ? 'active' : ''}`}
                      onClick={() => setLogSubTab('sync')}
                    >
                      🔄 동기화 로그
                    </button>
                    <button
                      className={`tab-btn ${logSubTab === 'tokens' ? 'active' : ''}`}
                      onClick={() => setLogSubTab('tokens')}
                    >
                      🪙 Gemini 토큰
                    </button>
                  </div>

                  {/* 동기화 로그 */}
                  {logSubTab === 'sync' && (
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

                  {/* Gemini 토큰 */}
                  {logSubTab === 'tokens' && (
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
                </div>
              )}
            </>
          )}
        </div>

        {/* 버튼 */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
