/**
 * SettingsModal
 *
 * @role Gemini API 키, Firebase 설정, 테마 설정을 관리하는 모달 컴포넌트
 * @responsibilities
 *   - 탭 기반 설정 UI 제공 (테마, Gemini, Firebase, 게임플레이 등)
 *   - 로컬 설정 상태 관리 및 저장
 *   - 동기화 로그 및 토큰 사용량 표시
 *   - 앱 업데이트 확인
 * @dependencies
 *   - settingsStore: 설정 데이터 로드/저장
 *   - firebaseService: Firebase 초기화
 *   - syncLogger: 동기화 로그 관리
 */

import { useState, useEffect } from 'react';
import { initializeFirebase } from '@/shared/services/sync/firebaseService';
import type { Settings, DailyTokenUsage } from '@/shared/types/domain';
import {
    getSyncLogs,
    clearSyncLogs,
    subscribeSyncLogs,
    type SyncLogEntry,
    type SyncType,
    type SyncAction,
} from '@/shared/services/sync/syncLogger';
import { loadAllTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { toast } from 'react-hot-toast';
import {
    AppearanceTab,
    GeminiTab,
    FirebaseTab,
    DontDoTab,
    ShortcutsTab,
    LogsTab,
    GameplayTab,
    ScheduleTab,
    BattleTab,
    GoogleCalendarTab,
} from './components/tabs';
import { useModalHotkeys } from '@/shared/hooks';
import AsyncStatePanel from '@/shared/components/status/AsyncStatePanel';
import StatusBanner from '@/shared/components/status/StatusBanner';

const modalOverlayClass =
    'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.65)] p-4 backdrop-blur';
const modalContainerClass =
    'flex h-[min(95vh,820px)] w-full max-w-[960px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_45px_80px_rgba(0,0,0,0.5)]';
const sidebarClass =
    'flex w-56 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-4';
const tabButtonBase =
    'mx-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200';
const primaryButtonClass =
    'rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
}

/**
 * 설정 모달 컴포넌트입니다.
 * @param props - 모달 props
 * @param props.isOpen - 모달 표시 여부
 * @param props.onClose - 모달 닫기 콜백
 * @param props.onSaved - 설정 저장 완료 콜백 (선택적)
 * @returns 탭 기반 설정 UI를 포함한 모달
 */
export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
    const {
        settings,
        loading,
        loadData,
        updateSettings,
        updateLocalSettings,
    } = useSettingsStore();

    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'gemini' | 'firebase' | 'appearance' | 'logs' | 'dontdo' | 'shortcuts' | 'gameplay' | 'schedule' | 'battle' | 'googlecalendar'>('appearance');
    const [currentTheme, setCurrentTheme] = useState<string>(() => {
        // eslint-disable-next-line no-restricted-globals -- theme is an allowed exception per CLAUDE.md
        return localStorage.getItem('theme') || '';
    });

    // 로컬 설정 상태 (저장 전까지 임시 보관)
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);

    // 로그 관련 state
    const [logs, setLogs] = useState<SyncLogEntry[]>([]);
    const [tokenUsage, setTokenUsage] = useState<DailyTokenUsage[]>([]);
    const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
    const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');
    const [appVersion, setAppVersion] = useState<string>('...');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<string>('');
    const [lastUpdateCheckAt, setLastUpdateCheckAt] = useState<number | null>(null);

    // 설정 로드 및 로컬 상태 초기화
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

    // Store 설정이 로드되면 로컬 상태 동기화 (모달이 열릴 때만)
    useEffect(() => {
        if (isOpen && settings) {
            setLocalSettings(prev => prev || structuredClone(settings));
        }
        if (!isOpen) {
            setLocalSettings(null);
        }
    }, [isOpen, settings]);

    // 로그 및 토큰 사용량 로드
    useEffect(() => {
        if (!isOpen || activeTab !== 'logs') return;

        const allLogs = getSyncLogs();
        setLogs(allLogs);

        loadAllTokenUsage().then(setTokenUsage).catch(console.error);

        const unsubscribe = subscribeSyncLogs((newLogs) => {
            setLogs(newLogs);
        });

        return unsubscribe;
    }, [isOpen, activeTab]);

    // 설정 저장
    const handleSave = async () => {
        if (!localSettings) return;

        try {
            setSaving(true);

            const secretKeys: (keyof Settings)[] = ['geminiApiKey', 'firebaseConfig', 'barkApiKey', 'githubToken', 'weatherApiKey'];
            const syncUpdates: Partial<Settings> = {};
            const secretUpdates: Partial<Settings> = {};

            (Object.keys(localSettings) as (keyof Settings)[]).forEach(key => {
                const value = localSettings[key];
                if (secretKeys.includes(key)) {
                    secretUpdates[key] = value;
                } else {
                    syncUpdates[key] = value;
                }
            });

            if (Object.keys(secretUpdates).length > 0) {
                await updateLocalSettings(secretUpdates);
            }
            if (Object.keys(syncUpdates).length > 0) {
                await updateSettings(syncUpdates);
            }
            await loadData(); // 저장 후 재로드하여 로컬 상태 확정

            if (localSettings.firebaseConfig) {
                initializeFirebase(localSettings.firebaseConfig);
            }

            toast.success('설정이 저장되었습니다!');
            onSaved?.();
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    useModalHotkeys({
        isOpen,
        onEscapeClose: onClose,
        primaryAction: {
            enabled: !saving,
            onPrimary: handleSave,
        },
    });

    const handleClearLogs = () => {
        if (confirm('모든 동기화 로그를 삭제하시겠습니까?')) {
            clearSyncLogs();
        }
    };

    const handleCheckForUpdates = async () => {
        if (checkingUpdate) {
            return;
        }
        const now = Date.now();
        if (lastUpdateCheckAt && now - lastUpdateCheckAt < 30_000) {
            setUpdateStatus('⚠️ 잠시 후 다시 시도해주세요 (중복 확인 방지)');
            return;
        }
        setLastUpdateCheckAt(now);

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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            console.error('Update check failed:', error);
            setUpdateStatus(`❌ 오류: ${errorMessage}`);
        } finally {
            setCheckingUpdate(false);
        }
    };

    if (!isOpen) return null;

    const getTabButtonClass = (tab: string) =>
        `${tabButtonBase} ${activeTab === tab
            ? 'bg-[var(--color-primary)] text-white shadow-lg'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
        }`;

    return (
        <div className={modalOverlayClass}>
            <div className={modalContainerClass} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
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

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <nav className={sidebarClass}>
                        <button className={getTabButtonClass('appearance')} onClick={() => setActiveTab('appearance')}>
                            <span className="text-lg">🎨</span>
                            <span>테마</span>
                        </button>
                        <button className={getTabButtonClass('gameplay')} onClick={() => setActiveTab('gameplay')}>
                            <span className="text-lg">🎮</span>
                            <span>게임플레이</span>
                        </button>
                        <button className={getTabButtonClass('schedule')} onClick={() => setActiveTab('schedule')}>
                            <span className="text-lg">📅</span>
                            <span>스케줄</span>
                        </button>
                        <button className={getTabButtonClass('battle')} onClick={() => setActiveTab('battle')}>
                            <span className="text-lg">⚔️</span>
                            <span>전투</span>
                        </button>
                        <button className={getTabButtonClass('gemini')} onClick={() => setActiveTab('gemini')}>
                            <span className="text-lg">🤖</span>
                            <span>Gemini AI</span>
                        </button>
                        <button className={getTabButtonClass('firebase')} onClick={() => setActiveTab('firebase')}>
                            <span className="text-lg">🔥</span>
                            <span>Firebase</span>
                        </button>
                        <button className={getTabButtonClass('googlecalendar')} onClick={() => setActiveTab('googlecalendar')}>
                            <span className="text-lg">📆</span>
                            <span>캘린더</span>
                        </button>
                        <button className={getTabButtonClass('dontdo')} onClick={() => setActiveTab('dontdo')}>
                            <span className="text-lg">🚫</span>
                            <span>하지않기</span>
                        </button>
                        <button className={getTabButtonClass('shortcuts')} onClick={() => setActiveTab('shortcuts')}>
                            <span className="text-lg">⌨️</span>
                            <span>단축키</span>
                        </button>
                        <button className={getTabButtonClass('logs')} onClick={() => setActiveTab('logs')}>
                            <span className="text-lg">📊</span>
                            <span>로그</span>
                        </button>
                    </nav>

                    {/* Tab Content Area */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-4">
                          {saving ? (
                            <StatusBanner variant="loading" title="설정 저장 중..." />
                          ) : null}

                          <AsyncStatePanel loading={loading} loadingTitle="설정 불러오는 중...">
                                {activeTab === 'appearance' && (
                                    <AppearanceTab
                                        currentTheme={currentTheme}
                                        setCurrentTheme={setCurrentTheme}
                                        appVersion={appVersion}
                                        checkingUpdate={checkingUpdate}
                                        updateStatus={updateStatus}
                                        handleCheckForUpdates={handleCheckForUpdates}
                                    />
                                )}
                                {activeTab === 'gameplay' && (
                                    <GameplayTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'schedule' && (
                                    <ScheduleTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'battle' && (
                                    <BattleTab />
                                )}
                                {activeTab === 'gemini' && (
                                    <GeminiTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'firebase' && (
                                    <FirebaseTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'googlecalendar' && (
                                    <GoogleCalendarTab />
                                )}
                                {activeTab === 'dontdo' && (
                                    <DontDoTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'shortcuts' && (
                                    <ShortcutsTab
                                        localSettings={localSettings}
                                        setLocalSettings={setLocalSettings}
                                    />
                                )}
                                {activeTab === 'logs' && (
                                    <LogsTab
                                        logs={logs}
                                        tokenUsage={tokenUsage}
                                        filterType={filterType}
                                        setFilterType={setFilterType}
                                        filterAction={filterAction}
                                        setFilterAction={setFilterAction}
                                        handleClearLogs={handleClearLogs}
                                    />
                                )}
                          </AsyncStatePanel>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-4">
                    <button
                        className={primaryButtonClass}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? '저장 중...' : '닫기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
