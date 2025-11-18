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

// Gemini 2.5 Flash 가격 (2025-01 기준)
const PRICE_PER_MILLION_INPUT = 1.25; // US$ 1.25 per 1M input tokens
const PRICE_PER_MILLION_OUTPUT = 10.0; // US$ 10.00 per 1M output tokens

const modalOverlayClass =
  'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.65)] p-4 backdrop-blur';
const modalContainerClass =
  'flex h-[min(95vh,820px)] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_45px_80px_rgba(0,0,0,0.5)]';
const tabsWrapperClass =
  'flex gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4';
const tabButtonBase =
  'flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors duration-200';
const sectionClass = 'flex flex-col gap-5 text-sm text-[var(--color-text)]';
const sectionDescriptionClass = 'text-sm text-[var(--color-text-secondary)] leading-relaxed';
const formGroupClass = 'flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]';
const inputClass =
  'rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const infoBoxClass =
  'rounded-2xl border-l-4 border-[var(--color-primary)] bg-[rgba(79,70,229,0.08)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]';
const secondaryButtonClass =
  'rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]';
const primaryButtonClass =
  'rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

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

  const getTypeBadgeClass = (type: SyncType) =>
    type === 'dexie'
      ? 'rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-indigo-100'
      : 'rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-100';

  const updateClass = !updateStatus
    ? ''
    : updateStatus.startsWith('✅')
    ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
    : updateStatus.startsWith('❌')
    ? 'border border-rose-400/40 bg-rose-500/10 text-rose-100'
    : 'border border-sky-400/40 bg-sky-500/10 text-sky-100';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.65)] p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="flex h-[min(95vh,820px)] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_45px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">⚙️ 설정</h2>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">API 키 및 앱 설정</p>
          </div>
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-lg font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:text-white"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4">
          <button
            className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'appearance'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 테마
          </button>
          <button
            className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'gemini'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            onClick={() => setActiveTab('gemini')}
          >
            🤖 Gemini AI
          </button>
          <button
            className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'firebase'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            onClick={() => setActiveTab('firebase')}
          >
            🔥 Firebase
          </button>
          <button
            className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'logs'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            📊 로그
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">로딩 중...</div>
          ) : (
            <>
              {/* 테마 설정 */}
              {activeTab === 'appearance' && (
                <div className={sectionClass}>
                  <h3>🎨 테마 설정</h3>
                  <p className={sectionDescriptionClass}>
                    다양한 색감 테마를 선택하여 나만의 작업 환경을 만들어보세요.
                  </p>

                  <div className={formGroupClass}>
                    <label htmlFor="theme-select">테마 선택</label>
                    <select
                      id="theme-select"
                      className={inputClass}
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

                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                    <h4 className="text-sm font-semibold text-[var(--color-text)]">미리보기</h4>
                    <div className="mt-4 flex items-center justify-center gap-6">
                      {[
                        { label: 'Primary', style: 'bg-[var(--color-primary)]' },
                        { label: 'Surface', style: 'bg-[var(--color-bg-surface)]' },
                        { label: 'Elevated', style: 'bg-[var(--color-bg-elevated)]' },
                      ].map(color => (
                        <div key={color.label} className="flex flex-col items-center gap-2">
                          <div className={`h-16 w-16 rounded-2xl border-2 border-[var(--color-border)] ${color.style}`} />
                          <span className="text-xs text-[var(--color-text-secondary)]">{color.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={infoBoxClass}>
                    <strong>💡 팁:</strong> 테마는 즉시 적용되며, 자동으로 저장됩니다.
                    작업 환경에 맞는 테마를 선택하여 눈의 피로를 줄이고 집중력을 높여보세요!
                  </div>

                  <div className="my-6 border-t border-[var(--color-border)]" />

                  <h3>ℹ️ 앱 정보</h3>
                  <div className={formGroupClass}>
                    <label className="font-semibold text-[var(--color-text)]">현재 버전</label>
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 font-mono text-sm font-semibold text-[var(--color-primary)]">
                      v{appVersion}
                    </div>
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                      새 버전이 출시되면 앱 시작 시 자동으로 알림이 표시됩니다.
                    </small>
                  </div>

                  <div className={formGroupClass}>
                    <label className="font-semibold text-[var(--color-text)]">수동 업데이트 확인</label>
                    <button
                      className={`${primaryButtonClass} w-full`}
                      onClick={handleCheckForUpdates}
                      disabled={checkingUpdate}
                    >
                      {checkingUpdate ? '⏳ 확인 중...' : '🔄 지금 업데이트 확인'}
                    </button>
                    {updateStatus && (
                      <div className={`mt-3 rounded-2xl px-3 py-2 text-xs ${updateClass}`}>
                        {updateStatus}
                      </div>
                    )}
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                      자동 업데이트가 작동하지 않을 때 이 버튼으로 수동 확인할 수 있습니다.
                    </small>
                  </div>

                  <div className={infoBoxClass}>
                    <strong>🚀 자동 업데이트:</strong> TimeBlock Planner는 GitHub Releases를 통해 자동으로 업데이트됩니다.
                    앱 시작 후 5초 뒤 최신 버전을 확인하며, 새 버전이 있으면 다운로드 및 설치 안내가 표시됩니다.
                  </div>

                  <div className={`${infoBoxClass} mt-4`}>
                    <strong>🔧 업데이트 문제 해결:</strong>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-6">
                      <li>앱을 <strong>프로덕션 빌드</strong>로 실행했는지 확인 (개발 모드에서는 업데이트 비활성화)</li>
                      <li>GitHub Releases에 <code>.exe</code>, <code>.exe.blockmap</code>, <code>latest.yml</code> 파일이 있는지 확인</li>
                      <li>네트워크 연결 확인 (GitHub에 접근 가능해야 함)</li>
                      <li>현재 버전이 <code>v{appVersion}</code>이고, 새 릴리스가 더 높은 버전인지 확인</li>
                    </ul>
                  </div>

                  <div className="my-6 border-t border-[var(--color-border)]" />

                  <h3>👧 와이푸 모드 설정</h3>
                  <p className={sectionDescriptionClass}>
                    와이푸 이미지 표시 방식을 선택할 수 있습니다.
                  </p>

                  <div className={formGroupClass}>
                    <label htmlFor="waifu-mode-select">모드 선택</label>
                    <select
                      id="waifu-mode-select"
                      className={inputClass}
                      value={settings.waifuMode}
                      onChange={(e) =>
                        setSettings({ ...settings, waifuMode: e.target.value as 'normal' | 'characteristic' })
                      }
                    >
                      <option value="characteristic">특성 모드 (호감도에 따라 변화)</option>
                      <option value="normal">일반 모드 (기본 이미지 고정)</option>
                    </select>
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                      {settings.waifuMode === 'characteristic'
                        ? '호감도에 따라 다양한 표정의 이미지가 표시됩니다.'
                        : '호감도와 관계없이 기본 이미지만 표시됩니다.'}
                    </small>
                  </div>

                  <div className={infoBoxClass}>
                    <strong>💡 참고:</strong> 설정은 로컬 저장소에 저장되어 페이지를 새로고침해도 유지됩니다.
                  </div>
                </div>
              )}

              {/* Gemini 설정 */}
              {activeTab === 'gemini' && (
                <div className={sectionClass}>
                  <h3>Gemini AI 설정</h3>
                  <p className={sectionDescriptionClass}>
                    Google Gemini API를 사용하여 AI 챗봇 기능을 이용할 수 있습니다.
                  </p>

                  <div className={formGroupClass}>
                    <label htmlFor="gemini-api-key">
                      Gemini API 키 <span className="required">*</span>
                    </label>
                    <input
                      id="gemini-api-key"
                      type="password"
                      className={inputClass}
                      placeholder="AIzaSy..."
                      value={settings.geminiApiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, geminiApiKey: e.target.value })
                      }
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        API 키 발급받기 →
                      </a>
                    </small>
                  </div>

                  <div className={formGroupClass}>
                    <label htmlFor="insight-interval">
                      💡 인사이트 자동 갱신 주기 (분)
                    </label>
                    <input
                      id="insight-interval"
                      type="number"
                      className={inputClass}
                      placeholder="15"
                      min="5"
                      max="120"
                      value={settings.autoMessageInterval || 15}
                      onChange={(e) =>
                        setSettings({ ...settings, autoMessageInterval: parseInt(e.target.value) || 15 })
                      }
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                      오늘의 인사이트 패널이 자동으로 갱신되는 주기입니다. (최소 5분, 최대 120분)
                    </small>
                  </div>

                  <div className={infoBoxClass}>
                    <strong>💡 참고:</strong> Gemini API 키가 없어도 앱의 다른 기능은 정상적으로
                    사용할 수 있습니다. AI 챗봇 및 인사이트 기능만 제한됩니다.
                  </div>
                </div>
              )}

              {/* Firebase 설정 */}
              {activeTab === 'firebase' && (
                <div className={sectionClass}>
                  <h3>Firebase 설정</h3>
                  <p className="section-description">
                    Firebase Realtime Database를 사용하여 다중 장치 간 데이터를 동기화할 수
                    있습니다.
                  </p>

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-api-key">API Key</label>
                    <input
                      id="firebase-api-key"
                      type="password"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-auth-domain">Auth Domain</label>
                    <input
                      id="firebase-auth-domain"
                      type="text"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-database-url">Database URL</label>
                    <input
                      id="firebase-database-url"
                      type="text"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-project-id">Project ID</label>
                    <input
                      id="firebase-project-id"
                      type="text"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-storage-bucket">Storage Bucket</label>
                    <input
                      id="firebase-storage-bucket"
                      type="text"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-messaging-sender-id">Messaging Sender ID</label>
                    <input
                      id="firebase-messaging-sender-id"
                      type="text"
                      className={inputClass}
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

                  <div className={formGroupClass}>
                    <label htmlFor="firebase-app-id">App ID</label>
                    <input
                      id="firebase-app-id"
                      type="text"
                      className={inputClass}
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

                  <div className={infoBoxClass}>
                    <strong>💡 참고:</strong> Firebase 설정이 없어도 앱은 로컬 저장소(IndexedDB)를
                    사용하여 정상적으로 동작합니다. 다중 장치 동기화 기능만 제한됩니다.
                  </div>
                </div>
              )}

              {/* 로그 탭 */}
              {activeTab === 'logs' && (
                <div className={sectionClass}>
                  {/* 서브 탭 */}
                  <div className="flex gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                    <button
                      className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                        logSubTab === 'sync'
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                      }`}
                      onClick={() => setLogSubTab('sync')}
                    >
                      🔄 동기화 로그
                    </button>
                    <button
                      className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                        logSubTab === 'tokens'
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
                            Dexie {logs.filter((l) => l.type === 'dexie').length}
                          </span>
                          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-amber-200">
                            Firebase {logs.filter((l) => l.type === 'firebase').length}
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
                          filteredLogs.map((log, index) => (
                            <div
                              key={`${log.timestamp}-${index}`}
                              className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm shadow-inner ${
                                log.action === 'error' ? 'border-l-4 border-l-rose-500' : ''
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                                <span className="text-base">{getActionIcon(log.action)}</span>
                                <span className={getTypeBadgeClass(log.type)}>{log.type.toUpperCase()}</span>
                                <span className="font-mono">{formatTime(log.timestamp)}</span>
                                <span className="rounded-2xl border border-[var(--color-border)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.3em]">
                                  {log.action.toUpperCase()}
                                </span>
                              </div>
                              <div className="mt-3 text-[var(--color-text)]">{log.message}</div>
                              {log.data && (
                                <div className="mt-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                                  <strong className="text-[var(--color-text)]">Data:</strong> {log.data}
                                </div>
                              )}
                              {log.error && (
                                <div className="mt-2 rounded-2xl border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                                  <strong>Error:</strong> {log.error}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {logSubTab === 'tokens' && (
                    <div className="flex flex-col gap-4">
                      {tokenUsage.length === 0 ? (
                        <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                          토큰 사용 기록이 없습니다.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 text-center text-sm text-[var(--color-text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                              <div className="text-[0.65rem] uppercase tracking-[0.3em]">총 메시지</div>
                              <div className="text-xl font-semibold text-[var(--color-text)]">
                                {tokenUsage.reduce((sum, t) => sum + t.messageCount, 0).toLocaleString()}개
                              </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                              <div className="text-[0.65rem] uppercase tracking-[0.3em]">총 입력 토큰</div>
                              <div className="text-xl font-semibold text-[var(--color-text)]">
                                {tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0).toLocaleString()}
                              </div>
                              <div className="text-[0.65rem] text-[var(--color-text-tertiary)]">
                                {formatCost(calculateTokenCost(tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0), 0).inputCost)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                              <div className="text-[0.65rem] uppercase tracking-[0.3em]">총 출력 토큰</div>
                              <div className="text-xl font-semibold text-[var(--color-text)]">
                                {tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0).toLocaleString()}
                              </div>
                              <div className="text-[0.65rem] text-[var(--color-text-tertiary)]">
                                {formatCost(calculateTokenCost(0, tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0)).outputCost)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                              <div className="text-[0.65rem] uppercase tracking-[0.3em]">총 토큰</div>
                              <div className="text-xl font-semibold text-[var(--color-primary)]">
                                {tokenUsage.reduce((sum, t) => sum + t.totalTokens, 0).toLocaleString()}
                              </div>
                              <div className="text-[0.65rem] text-[var(--color-text-tertiary)]">
                                {formatCost(
                                  calculateTokenCost(
                                    tokenUsage.reduce((sum, t) => sum + t.promptTokens, 0),
                                    tokenUsage.reduce((sum, t) => sum + t.candidatesTokens, 0)
                                  ).totalCost
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
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
                                  {tokenUsage
                                    .sort((a, b) => b.date.localeCompare(a.date))
                                    .map((usage) => {
                                      const cost = calculateTokenCost(usage.promptTokens, usage.candidatesTokens);
                                      return (
                                        <tr key={usage.date} className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                                          <td className="border border-[var(--color-border)] px-3 py-2 font-mono">{usage.date}</td>
                                          <td className="border border-[var(--color-border)] px-3 py-2">{usage.messageCount}개</td>
                                          <td className="border border-[var(--color-border)] px-3 py-2">{usage.promptTokens.toLocaleString()}</td>
                                          <td className="border border-[var(--color-border)] px-3 py-2">{usage.candidatesTokens.toLocaleString()}</td>
                                          <td className="border border-[var(--color-border)] px-3 py-2 font-semibold text-[var(--color-primary)]">{usage.totalTokens.toLocaleString()}</td>
                                          <td className="border border-[var(--color-border)] px-3 py-2">{formatCost(cost.totalCost)}</td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
