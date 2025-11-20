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
import { initializeFirebase } from '@/shared/services/sync/firebaseService';
import type { TimeSlotTagTemplate } from '@/shared/types/domain';
import {
  getSyncLogs,
  clearSyncLogs,
  subscribeSyncLogs,
  type SyncLogEntry,
  type SyncType,
  type SyncAction,
} from '@/shared/services/sync/syncLogger';
import { loadAllTokenUsage } from '@/data/repositories/chatHistoryRepository';
import type { DailyTokenUsage } from '@/shared/types/domain';
import { useSettingsStore } from '@/shared/stores/settingsStore';

// Gemini 2.5 Flash 가격 (업데이트): US$2.00 per 1M input, US$12.00 per 1M output
const PRICE_PER_MILLION_INPUT = 2.0;
const PRICE_PER_MILLION_OUTPUT = 12.0;

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
  const {
    settings,
    loading,
    loadData,
    updateWaifuMode,
    updateApiKey,
    updateAutoMessage,
    updateSettings,
  } = useSettingsStore();

  // 로컬 버퍼 (입력 중 즉시 저장하지 않고 모달 닫을 때 저장)
  const [localSettings, setLocalSettings] = useState(settings);
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

  // 설정 로드 및 로컬 상태 동기화
  useEffect(() => {
    if (isOpen) {
      loadData();
      // Electron 환경에서 앱 버전 가져오기
      if (window.electronAPI?.getAppVersion) {
        window.electronAPI.getAppVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
      } else {
        // 웹 환경일 경우
        setAppVersion('Web Version');
      }
    }
  }, [isOpen, loadData]);

  // store settings 변경 시 로컬 상태 동기화
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

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
                  </div >
                </div >
              )
}

{/* Gemini 설정 */ }
{
  activeTab === 'gemini' && (
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
          value={localSettings?.geminiApiKey || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({ ...prev, geminiApiKey: e.target.value }))
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
        <label htmlFor="gemini-model">
          🤖 Gemini 모델명
        </label>
        <input
          id="gemini-model"
          type="text"
          className={inputClass}
          placeholder="gemini-2.0-flash-exp"
          value={localSettings?.geminiModel || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({ ...prev, geminiModel: e.target.value }))
          }
        />
        <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
          사용할 Gemini 모델명을 입력하세요. (예: gemini-2.0-flash-exp, gemini-1.5-pro)
        </small>
      </div>

      <div className={`${formGroupClass} flex-row items-center gap-3`}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[var(--color-text)]">작업 자동 이모지</span>
          <span className="text-[0.8rem] text-[var(--color-text-tertiary)]">
            제목 기반 추천 이모지를 접두로 붙입니다 (비용 절약을 위해 기본 OFF)
          </span>
        </div>
        <label className="relative ml-auto inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!localSettings?.autoEmojiEnabled}
            onChange={(e) =>
              setLocalSettings((prev: any) => ({ ...prev, autoEmojiEnabled: e.target.checked }))
            }
          />
          <div className="group h-12 w-24 rounded-full border border-gray-600 bg-gradient-to-tr from-rose-100 via-rose-400 to-rose-500 shadow-md shadow-gray-900 transition duration-300 peer-checked:bg-gradient-to-tr peer-checked:from-green-100 peer-checked:via-lime-400 peer-checked:to-lime-500">
            <span className="absolute left-1 top-1 flex h-10 w-10 items-center justify-center rounded-full border border-gray-600 bg-gray-50 text-lg transition-all duration-300 -rotate-180 peer-checked:translate-x-12 peer-checked:rotate-0 peer-hover:scale-95">
              {localSettings?.autoEmojiEnabled ? '✔️' : '✖️'}
            </span>
          </div>
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--color-text)]">시간대 속성 템플릿</span>
            <span className="text-[0.8rem] text-[var(--color-text-tertiary)]">
              시간대 헤더에 표시할 속성(휴식/청소/집중 등)을 관리하세요.
            </span>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={addTagTemplate}
          >
            + 템플릿 추가
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {tagTemplates.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-tertiary)]">
              아직 템플릿이 없습니다. “+ 템플릿 추가” 버튼으로 시작하세요.
            </div>
          )}

          {tagTemplates.map((tag) => (
            <div
              key={tag.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm"
                  style={{
                    backgroundColor: tag.color,
                    color: getBadgeTextColor(tag.color),
                  }}
                >
                  <span aria-hidden="true">{tag.icon || '🏷️'}</span>
                  {tag.label || '이름 없음'}
                </div>
                <button
                  type="button"
                  onClick={() => removeTagTemplate(tag.id)}
                  className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
                >
                  삭제
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_0.8fr]">
                <input
                  className={inputClass}
                  placeholder="라벨 (예: 휴식, 청소)"
                  value={tag.label}
                  onChange={(e) => updateTagTemplate(tag.id, 'label', e.target.value)}
                />
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
                  <input
                    type="color"
                    className="h-10 w-10 rounded-lg border border-[var(--color-border-light)] bg-transparent"
                    value={tag.color}
                    onChange={(e) => updateTagTemplate(tag.id, 'color', e.target.value)}
                  />
                  <span className="text-xs text-[var(--color-text-tertiary)]">배경색</span>
                </div>
                <input
                  className={inputClass}
                  placeholder="아이콘/이모지 (예: 🧹)"
                  value={tag.icon || ''}
                  onChange={(e) => updateTagTemplate(tag.id, 'icon', e.target.value)}
                />
              </div>
              <input
                className={`${inputClass} mt-2`}
                placeholder="툴팁 메모 (선택)"
                value={tag.note || ''}
                onChange={(e) => updateTagTemplate(tag.id, 'note', e.target.value)}
              />
            </div>
          ))}
        </div>
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
          value={localSettings?.autoMessageInterval || 15}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({ ...prev, autoMessageInterval: parseInt(e.target.value) || 15 }))
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
  )
}

{/* Firebase 설정 */ }
{
  activeTab === 'firebase' && (
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
          value={localSettings?.firebaseConfig?.apiKey || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                apiKey: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.authDomain || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                authDomain: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.databaseURL || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                databaseURL: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.projectId || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                projectId: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.storageBucket || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                storageBucket: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.messagingSenderId || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                messagingSenderId: e.target.value,
              },
            }))
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
          value={localSettings?.firebaseConfig?.appId || ''}
          onChange={(e) =>
            setLocalSettings((prev: any) => ({
              ...prev,
              firebaseConfig: {
                ...prev?.firebaseConfig,
                appId: e.target.value,
              },
            }))
          }
        />
      </div>

      <div className={infoBoxClass}>
        <strong>💡 참고:</strong> Firebase 설정이 없어도 앱은 로컬 저장소(IndexedDB)를
        사용하여 정상적으로 동작합니다. 다중 장치 동기화 기능만 제한됩니다.
      </div>
    </div>
  )
}

{/* 로그 탭 */ }
{
  activeTab === 'logs' && (
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
              filteredLogs.map((log) => (
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
                    {tokenUsage
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((usage) => {
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
  )
}
            </>
          )}
        </div >

  <div className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-4">
    <button
      className={primaryButtonClass}
      onClick={handleSave}
      disabled={saving}
    >
      {saving ? '저장 중...' : '닫기'}
    </button>
  </div>
      </div >
    </div >
  );
}
