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
import type { TimeSlotTagTemplate, DontDoChecklistItem, Settings } from '@/shared/types/domain';
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
import { toast } from 'react-hot-toast';

// Gemini 2.5 Flash 가격 (업데이트): US$2.00 per 1M input, US$12.00 per 1M output
const PRICE_PER_MILLION_INPUT = 2.0;
const PRICE_PER_MILLION_OUTPUT = 12.0;

const modalOverlayClass =
    'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.65)] p-4 backdrop-blur';
const modalContainerClass =
    'flex h-[min(95vh,820px)] w-full max-w-[960px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_45px_80px_rgba(0,0,0,0.5)]';
const sidebarClass =
    'flex w-56 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-4';
const tabButtonBase =
    'mx-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200';
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
        updateSettings,
        updateLocalSettings,
    } = useSettingsStore();

    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'gemini' | 'firebase' | 'appearance' | 'logs' | 'dontdo' | 'shortcuts'>('gemini');
    const [currentTheme, setCurrentTheme] = useState<string>(() => {
        return localStorage.getItem('theme') || '';
    });

    // 로컬 설정 상태 (저장 전까지 임시 보관)
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);

    // 로그 관련 state
    const [logSubTab, setLogSubTab] = useState<'sync' | 'tokens'>('sync');
    const [logs, setLogs] = useState<SyncLogEntry[]>([]);
    const [tokenUsage, setTokenUsage] = useState<DailyTokenUsage[]>([]);
    const [filterType, setFilterType] = useState<SyncType | 'all'>('all');
    const [filterAction, setFilterAction] = useState<SyncAction | 'all'>('all');
    const [appVersion, setAppVersion] = useState<string>('...');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<string>('');

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
            // 이미 로컬 설정이 있고, 모달이 열려있는 상태라면 덮어쓰지 않음 (사용자 입력 보존)
            // 단, 처음 열릴 때는 초기화
            setLocalSettings(prev => prev || structuredClone(settings));
        }
        if (!isOpen) {
            setLocalSettings(null);
        }
    }, [isOpen, settings]);

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

    // 설정 저장 (닫기 전 확인 용도)
    const handleSave = async () => {
        if (!localSettings) return;

        try {
            setSaving(true);

            // 동기화 대상 필드 (나머지는 로컬 저장)
            const syncKeys: (keyof Settings)[] = ['dontDoChecklist', 'timeSlotTags', 'templateCategories'];
            // Dexter + Firebase 모두 필요한 키 (시간대 속성 템플릿)
            const dualPersistKeys: (keyof Settings)[] = ['timeSlotTags'];

            const syncUpdates: Partial<Settings> = {};
            const localUpdates: Partial<Settings> = {};

            (Object.keys(localSettings) as (keyof Settings)[]).forEach(key => {
                const value = localSettings[key];
                if (dualPersistKeys.includes(key)) {
                    // Dexie 보관 + Firebase 동기화 모두 수행
                    // @ts-ignore - 타입 추론 보조
                    syncUpdates[key] = value;
                    // @ts-ignore
                    localUpdates[key] = value;
                    return;
                }

                if (syncKeys.includes(key)) {
                    // @ts-ignore
                    syncUpdates[key] = value;
                } else {
                    // @ts-ignore
                    localUpdates[key] = value;
                }
            });

            // 병렬로 저장 실행 (Race Condition 방지를 위해 순차 실행으로 변경)
            // updateLocalSettings가 먼저 실행되어 로컬 데이터를 저장하고,
            // 그 다음 updateSettings가 실행되어 동기화 데이터를 저장합니다.
            // 이렇게 하면 updateSettings가 최신 로컬 데이터를 포함한 상태에서 동기화를 수행합니다.
            if (Object.keys(localUpdates).length > 0) {
                await updateLocalSettings(localUpdates);
            }
            if (Object.keys(syncUpdates).length > 0) {
                await updateSettings(syncUpdates);
            }

            // Firebase 설정이 있으면 재초기화
            if (localSettings.firebaseConfig) {
                const initialized = initializeFirebase(localSettings.firebaseConfig);
                if (initialized) {
                    // Firebase initialized
                }
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

    const tagTemplates = localSettings?.timeSlotTags || [];

    const addTagTemplate = () => {
        const newTag: TimeSlotTagTemplate = {
            id: `tag-${Date.now()}`,
            label: '새 속성',
            color: '#94a3b8',
            icon: '🏷️',
        };
        setLocalSettings(prev => prev ? ({
            ...prev,
            timeSlotTags: [...(prev.timeSlotTags || []), newTag]
        }) : prev);
    };

    // Don't-Do 항목 로컬 상태 업데이트
    const handleDontDoItemChange = (id: string, updates: Partial<DontDoChecklistItem>) => {
        setLocalSettings(prev => {
            if (!prev) return prev;
            const currentList = prev.dontDoChecklist || [];
            return {
                ...prev,
                dontDoChecklist: currentList.map(item =>
                    item.id === id ? { ...item, ...updates } : item
                )
            };
        });
    };

    const updateTagTemplate = (id: string, key: keyof TimeSlotTagTemplate, value: string) => {
        setLocalSettings(prev => {
            if (!prev) return prev;
            const currentTags = prev.timeSlotTags || [];
            return {
                ...prev,
                timeSlotTags: currentTags.map(tag => (tag.id === id ? { ...tag, [key]: value } : tag))
            };
        });
    };

    const removeTagTemplate = (id: string) => {
        setLocalSettings(prev => {
            if (!prev) return prev;
            const currentTags = prev.timeSlotTags || [];
            return {
                ...prev,
                timeSlotTags: currentTags.filter(tag => tag.id !== id)
            };
        });
    };

    const getBadgeTextColor = (bg: string) => {
        // 간단한 밝기 계산으로 대비 색상 결정
        if (!bg || bg.length < 7 || !bg.startsWith('#')) return '#0f172a';
        const r = parseInt(bg.slice(1, 3), 16);
        const g = parseInt(bg.slice(3, 5), 16);
        const b = parseInt(bg.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 150 ? '#0f172a' : '#f8fafc';
    };

    if (!isOpen) return null;

    return (
        <div
            className={modalOverlayClass}
            onClick={onClose}
        >
            <div
                className={modalContainerClass}
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

                {/* 왼쪽 사이드바와 오른쪽 콘텐츠 영역 */}
                <div className="flex flex-1 overflow-hidden">
                    {/* 왼쪽 네비게이션 사이드바 */}
                    <nav className={sidebarClass}>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'appearance'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <span className="text-lg">🎨</span>
                            <span>테마</span>
                        </button>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'gemini'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('gemini')}
                        >
                            <span className="text-lg">🤖</span>
                            <span>Gemini AI</span>
                        </button>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'firebase'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('firebase')}
                        >
                            <span className="text-lg">🔥</span>
                            <span>Firebase</span>
                        </button>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'dontdo'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('dontdo')}
                        >
                            <span className="text-lg">🚫</span>
                            <span>하지않기</span>
                        </button>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'logs'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('logs')}
                        >
                            <span className="text-lg">📊</span>
                            <span>로그</span>
                        </button>
                        <button
                            className={`${tabButtonBase} ${activeTab === 'shortcuts'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                                }`}
                            onClick={() => setActiveTab('shortcuts')}
                        >
                            <span className="text-lg">⌨️</span>
                            <span>단축키</span>
                        </button>
                    </nav>

                    {/* 오른쪽 콘텐츠 영역 */}
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
                                                value={localSettings?.waifuMode || 'characteristic'}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, waifuMode: e.target.value as any }) : prev)
                                                }
                                            >
                                                <option value="characteristic">특성 모드 (호감도에 따라 변화)</option>
                                                <option value="normal">일반 모드 (기본 이미지 고정)</option>
                                            </select>
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                {localSettings?.waifuMode === 'characteristic'
                                                    ? '호감도에 따라 다양한 표정의 이미지가 표시됩니다.'
                                                    : '호감도와 관계없이 기본 이미지만 표시됩니다.'}
                                            </small>
                                        </div>

                                        <div className={formGroupClass}>
                                            <label htmlFor="waifu-interval-select">이미지 자동 변경 주기</label>
                                            <select
                                                id="waifu-interval-select"
                                                className={inputClass}
                                                value={localSettings?.waifuImageChangeInterval ?? 600000}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, waifuImageChangeInterval: parseInt(e.target.value) }) : prev)
                                                }
                                            >
                                                <option value="300000">5분마다 변경</option>
                                                <option value="600000">10분마다 변경 (기본)</option>
                                                <option value="900000">15분마다 변경</option>
                                                <option value="1800000">30분마다 변경</option>
                                                <option value="0">자동 변경 안함</option>
                                            </select>
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                {localSettings?.waifuImageChangeInterval === 0
                                                    ? '이미지가 자동으로 변경되지 않습니다. 클릭할 때만 변경됩니다.'
                                                    : `설정한 주기마다 이미지와 대사가 자동으로 변경됩니다.`}
                                            </small>
                                        </div>

                                        <div className={infoBoxClass}>
                                            <strong>💡 참고:</strong> 설정은 로컬 저장소에 저장되어 페이지를 새로고침해도 유지됩니다.
                                        </div>
                                    </div>
                                )}

                                {/* Firebase 설정 */}
                                {activeTab === 'firebase' && (
                                    <div className={sectionClass}>
                                        <h3>🔥 Firebase 설정</h3>
                                        <p className={sectionDescriptionClass}>
                                            데이터 동기화 및 백업을 위한 Firebase 설정입니다.
                                        </p>

                                        <div className={formGroupClass}>
                                            <label htmlFor="bark-api-key">
                                                🔔 Bark API 키 (알림용)
                                            </label>
                                            <input
                                                id="bark-api-key"
                                                type="password"
                                                className={inputClass}
                                                placeholder="Bark 앱의 Key 입력"
                                                value={localSettings?.barkApiKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, barkApiKey: e.target.value }) : prev)
                                                }
                                            />
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                <a
                                                    href="https://apps.apple.com/us/app/bark-customed-notifications/id1403753865"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Bark 앱 설치 및 키 확인 →
                                                </a>
                                            </small>
                                        </div>

                                        <div className="my-4 border-t border-[var(--color-border)]" />
                                    </div>
                                )}

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
                                                value={localSettings?.geminiApiKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, geminiApiKey: e.target.value }) : prev)
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
                                                placeholder="gemini-3-pro-preview"
                                                value={localSettings?.geminiModel || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, geminiModel: e.target.value }) : prev)
                                                }
                                            />
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                사용할 Gemini 모델명을 입력하세요. (예: gemini-3-pro-preview, gemini-2.0-flash-exp, gemini-1.5-pro)
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
                                                        setLocalSettings(prev => prev ? ({ ...prev, autoEmojiEnabled: e.target.checked }) : prev)
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
                                                    setLocalSettings(prev => prev ? ({ ...prev, autoMessageInterval: parseInt(e.target.value) || 15 }) : prev)
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
                                                value={localSettings?.firebaseConfig?.apiKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                apiKey: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.authDomain || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                authDomain: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.databaseURL || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                databaseURL: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.projectId || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                projectId: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.storageBucket || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                storageBucket: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.messagingSenderId || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                messagingSenderId: e.target.value,
                                                            },
                                                        };
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
                                                value={localSettings?.firebaseConfig?.appId || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => {
                                                        if (!prev) return prev;
                                                        const currentConfig = prev.firebaseConfig || { apiKey: '', authDomain: '', databaseURL: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
                                                        return {
                                                            ...prev,
                                                            firebaseConfig: {
                                                                ...currentConfig,
                                                                appId: e.target.value,
                                                            },
                                                        };
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

                                {/* 하지않기 체크리스트 탭 */}
                                {activeTab === 'dontdo' && (
                                    <div className={sectionClass}>
                                        <div className={infoBoxClass}>
                                            <strong>🚫 하지않기 체크리스트:</strong> 하지 말아야 할 행동들을 정의하고, 이를 참았을 때 얻을 수 있는 XP 보상을 설정하세요.
                                            타임블록에서 해당 항목을 체크하면 XP를 획득합니다.
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {(localSettings?.dontDoChecklist || []).map((item, index) => (
                                                <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => {
                                                                if (index > 0) {
                                                                    setLocalSettings(prev => {
                                                                        if (!prev) return prev;
                                                                        const newItems = [...(prev.dontDoChecklist || [])];
                                                                        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                                                                        return { ...prev, dontDoChecklist: newItems };
                                                                    });
                                                                }
                                                            }}
                                                            disabled={index === 0}
                                                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] disabled:opacity-30"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (index < (localSettings?.dontDoChecklist || []).length - 1) {
                                                                    setLocalSettings(prev => {
                                                                        if (!prev) return prev;
                                                                        const newItems = [...(prev.dontDoChecklist || [])];
                                                                        [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
                                                                        return { ...prev, dontDoChecklist: newItems };
                                                                    });
                                                                }
                                                            }}
                                                            disabled={index === (localSettings?.dontDoChecklist || []).length - 1}
                                                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] disabled:opacity-30"
                                                        >
                                                            ▼
                                                        </button>
                                                    </div>

                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={item.label}
                                                            onChange={(e) => handleDontDoItemChange(item.id, { label: e.target.value })}
                                                            className="w-full bg-transparent text-sm font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                                                            placeholder="항목 이름 (예: 유튜브 보지 않기)"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-tertiary)] px-3 py-1.5">
                                                        <span className="text-xs text-[var(--color-text-secondary)]">XP</span>
                                                        <input
                                                            type="number"
                                                            value={item.xpReward}
                                                            onChange={(e) => handleDontDoItemChange(item.id, { xpReward: Number(e.target.value) })}
                                                            className="w-16 bg-transparent text-right text-sm font-bold text-[var(--color-primary)] outline-none"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            setLocalSettings(prev => prev ? ({
                                                                ...prev,
                                                                dontDoChecklist: (prev.dontDoChecklist || []).filter(i => i.id !== item.id)
                                                            }) : prev);
                                                        }}
                                                        className="ml-2 rounded-xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-red-500"
                                                        title="삭제"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            ))}

                                            <button
                                                onClick={() => {
                                                    const newItem: DontDoChecklistItem = {
                                                        id: `dontdo-${Date.now()}`,
                                                        label: '',
                                                        xpReward: 15,
                                                        order: (localSettings?.dontDoChecklist || []).length
                                                    };
                                                    setLocalSettings(prev => prev ? ({
                                                        ...prev,
                                                        dontDoChecklist: [...(prev.dontDoChecklist || []), newItem]
                                                    }) : prev);
                                                }}
                                                className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                                            >
                                                <span>➕ 새 항목 추가</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 단축키 탭 */}
                                {activeTab === 'shortcuts' && (
                                    <div className={sectionClass}>
                                        <h3>⌨️ 단축키 설정</h3>
                                        <p className={sectionDescriptionClass}>
                                            자주 사용하는 기능의 단축키를 설정할 수 있습니다.
                                        </p>

                                        <div className={infoBoxClass}>
                                            <strong>💡 사용법:</strong> 입력란을 클릭하고 원하는 키 조합을 누르세요.
                                            Ctrl, Shift, Alt 키와 함께 사용하거나, 입력 필드가 아닐 때는 '1', '2', 'Q' 같은 간단한 키도 사용할 수 있습니다.
                                        </div>

                                        <div className={formGroupClass}>
                                            <label htmlFor="left-panel-key">
                                                🔷 좌측 패널 토글
                                            </label>
                                            <input
                                                id="left-panel-key"
                                                type="text"
                                                className={inputClass}
                                                placeholder="Ctrl+B (기본값)"
                                                value={localSettings?.leftPanelToggleKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, leftPanelToggleKey: e.target.value }) : prev)
                                                }
                                                onKeyDown={(e) => {
                                                    e.preventDefault();
                                                    const keys = [];
                                                    if (e.ctrlKey) keys.push('Ctrl');
                                                    if (e.shiftKey) keys.push('Shift');
                                                    if (e.altKey) keys.push('Alt');
                                                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                                                        keys.push(e.key.toUpperCase());
                                                    }
                                                    if (keys.length >= 1) {
                                                        const shortcut = keys.join('+');
                                                        setLocalSettings(prev => prev ? ({ ...prev, leftPanelToggleKey: shortcut }) : prev);
                                                    }
                                                }}
                                            />
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                좌측 패널(인박스, 완료, 통계 등)을 열고 닫습니다.
                                            </small>
                                        </div>

                                        <div className={formGroupClass}>
                                            <label htmlFor="right-panel-key">
                                                🔶 우측 패널 토글
                                            </label>
                                            <input
                                                id="right-panel-key"
                                                type="text"
                                                className={inputClass}
                                                placeholder="Ctrl+Shift+B (기본값)"
                                                value={localSettings?.rightPanelToggleKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, rightPanelToggleKey: e.target.value }) : prev)
                                                }
                                                onKeyDown={(e) => {
                                                    e.preventDefault();
                                                    const keys = [];
                                                    if (e.ctrlKey) keys.push('Ctrl');
                                                    if (e.shiftKey) keys.push('Shift');
                                                    if (e.altKey) keys.push('Alt');
                                                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                                                        keys.push(e.key.toUpperCase());
                                                    }
                                                    if (keys.length >= 1) {
                                                        const shortcut = keys.join('+');
                                                        setLocalSettings(prev => prev ? ({ ...prev, rightPanelToggleKey: shortcut }) : prev);
                                                    }
                                                }}
                                            />
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                우측 패널(인사이트, 퀘스트, 샵)을 열고 닫습니다.
                                            </small>
                                        </div>

                                        <div className={formGroupClass}>
                                            <label htmlFor="bulk-add-key">
                                                📝 대량 할 일 추가
                                            </label>
                                            <input
                                                id="bulk-add-key"
                                                type="text"
                                                className={inputClass}
                                                placeholder="F1 (기본값)"
                                                value={localSettings?.bulkAddModalKey || ''}
                                                onChange={(e) =>
                                                    setLocalSettings(prev => prev ? ({ ...prev, bulkAddModalKey: e.target.value }) : prev)
                                                }
                                                onKeyDown={(e) => {
                                                    e.preventDefault();
                                                    const keys = [];
                                                    if (e.ctrlKey) keys.push('Ctrl');
                                                    if (e.shiftKey) keys.push('Shift');
                                                    if (e.altKey) keys.push('Alt');
                                                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                                                        // F1-F12 같은 특수 키는 그대로, 일반 키는 대문자로
                                                        const keyName = e.key.startsWith('F') && e.key.length <= 3 ? e.key : e.key.toUpperCase();
                                                        keys.push(keyName);
                                                    }
                                                    if (keys.length >= 1) {
                                                        const shortcut = keys.join('+');
                                                        setLocalSettings(prev => prev ? ({ ...prev, bulkAddModalKey: shortcut }) : prev);
                                                    }
                                                }}
                                            />
                                            <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                                                대량 할 일 추가 모달을 엽니다. 간단한 키(예: 'B')도 사용 가능합니다.
                                            </small>
                                        </div>

                                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                                            <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">📋 기본 단축키 목록</h4>
                                            <div className="grid gap-2 text-xs">
                                                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                                                    <span className="text-[var(--color-text-secondary)]">대량 할 일 추가</span>
                                                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 font-mono text-[var(--color-text)]">
                                                        {localSettings?.bulkAddModalKey || 'F1'}
                                                    </kbd>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                                                    <span className="text-[var(--color-text-secondary)]">좌측 패널 토글</span>
                                                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 font-mono text-[var(--color-text)]">
                                                        {localSettings?.leftPanelToggleKey || 'Ctrl+B'}
                                                    </kbd>
                                                </div>
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-[var(--color-text-secondary)]">우측 패널 토글</span>
                                                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 font-mono text-[var(--color-text)]">
                                                        {localSettings?.rightPanelToggleKey || 'Ctrl+Shift+B'}
                                                    </kbd>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 로그 탭 */}
                                {activeTab === 'logs' && (
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
                                )}
                            </>
                        )}
                    </div>
                </div>

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
        </div >
    );
}
