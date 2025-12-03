/**
 * GoogleCalendarTab
 *
 * @role Google Calendar 연동 설정을 관리하는 탭 컴포넌트
 * @responsibilities
 *   - Google OAuth 로그인/로그아웃
 *   - 연동 상태 표시
 * @dependencies
 *   - googleCalendarService: Google Calendar API 서비스
 */

import { useState, useEffect } from 'react';
import {
    sectionClass,
    sectionDescriptionClass,
} from './styles';
import {
    getGoogleCalendarSettings,
    loginWithGoogle,
    disconnectGoogleCalendar,
    isTokenValid,
} from '@/shared/services/calendar/googleCalendarService';
import type { GoogleCalendarSettings } from '@/shared/services/calendar/googleCalendarTypes';
import { toast } from 'react-hot-toast';

// 하드코딩된 OAuth credentials (개인용 앱)
const GOOGLE_CLIENT_ID = '907237023842-ssrh0av5k3g9davc1bcj2vfgnmkg371e.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';

/**
 * Google Calendar 연동 탭 컴포넌트
 * @returns Google Calendar 설정 UI
 */
export function GoogleCalendarTab() {
    const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [tokenValid, setTokenValid] = useState(false);
    const [isElectron, setIsElectron] = useState(false);

    // 설정 로드
    useEffect(() => {
        loadSettings();
        // Electron 환경 확인
        setIsElectron(!!window.electronAPI?.googleOAuthLogin);
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const loaded = await getGoogleCalendarSettings();
            setSettings(loaded);
            
            if (loaded?.enabled) {
                const valid = await isTokenValid();
                setTokenValid(valid);
            }
        } catch (error) {
            console.error('[GoogleCalendarTab] Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Google 로그인
    const handleConnect = async () => {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            toast.error('Google OAuth 설정이 누락되었습니다. .env 파일을 확인해주세요.');
            return;
        }

        try {
            setConnecting(true);
            toast.loading('브라우저에서 Google 로그인을 진행해주세요...', { id: 'google-oauth' });
            
            const result = await loginWithGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

            if (result.success) {
                toast.success(`✅ Google Calendar 연동 완료! (${result.email})`, { id: 'google-oauth' });
                await loadSettings();
            } else {
                toast.error(result.error || '연동에 실패했습니다.', { id: 'google-oauth' });
            }
        } catch (error) {
            console.error('[GoogleCalendarTab] Connect failed:', error);
            toast.error('연동 중 오류가 발생했습니다.', { id: 'google-oauth' });
        } finally {
            setConnecting(false);
        }
    };

    // 연동 해제
    const handleDisconnect = async () => {
        if (!confirm('Google Calendar 연동을 해제하시겠습니까?\n기존 동기화 데이터는 유지됩니다.')) {
            return;
        }

        try {
            await disconnectGoogleCalendar();
            setSettings(null);
            setTokenValid(false);
            toast.success('Google Calendar 연동이 해제되었습니다.');
        } catch (error) {
            console.error('[GoogleCalendarTab] Disconnect failed:', error);
            toast.error('연동 해제에 실패했습니다.');
        }
    };

    // 토큰 수동 갱신 (재로그인)
    const handleRefreshToken = async () => {
        await handleConnect();
    };

    if (loading) {
        return (
            <div className={sectionClass}>
                <h3>📅 Google Calendar 연동</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">로딩 중...</p>
            </div>
        );
    }

    const isConnected = settings?.enabled && settings.accessToken;

    return (
        <div className={sectionClass}>
            <h3>📅 Google Calendar 연동</h3>
            <p className={sectionDescriptionClass}>
                TimeBlock의 할일을 Google Calendar와 자동으로 동기화합니다.
                스케줄된 작업만 동기화되며, 완료 상태도 반영됩니다.
            </p>

            {/* Electron 환경 체크 */}
            {!isElectron && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                    ⚠️ Google Calendar 연동은 데스크톱 앱에서만 사용할 수 있습니다.
                </div>
            )}

            {/* 연동 상태 표시 */}
            {isConnected ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">✅</span>
                            <div>
                                <p className="font-semibold text-emerald-400">연동됨</p>
                                <p className="text-sm text-emerald-300/80">{settings.userEmail}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!tokenValid && (
                                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400">
                                    토큰 만료
                                </span>
                            )}
                            {settings.refreshToken && (
                                <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs text-sky-400">
                                    자동 갱신 활성화
                                </span>
                            )}
                        </div>
                    </div>

                    {settings.lastSyncAt && (
                        <p className="mt-3 text-xs text-emerald-300/60">
                            마지막 동기화: {new Date(settings.lastSyncAt).toLocaleString('ko-KR')}
                        </p>
                    )}

                    <div className="mt-4 flex gap-2">
                        {!tokenValid && (
                            <button
                                className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/30"
                                onClick={handleRefreshToken}
                                disabled={connecting}
                            >
                                {connecting ? '갱신 중...' : '🔄 토큰 갱신'}
                            </button>
                        )}
                        <button
                            className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/30"
                            onClick={handleDisconnect}
                        >
                            연동 해제
                        </button>
                    </div>
                </div>
            ) : isElectron && (
                <button
                    className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-6 py-3 font-semibold text-gray-700 shadow-md transition hover:shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleConnect}
                    disabled={connecting}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {connecting ? '연결 중...' : 'Google 계정으로 연동하기'}
                </button>
            )}

            {/* 동기화 동작 설명 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 mt-4">
                <p className="font-semibold text-sm mb-2">🔄 동기화 동작</p>
                <ul className="text-xs text-[var(--color-text-secondary)] space-y-1">
                    <li>• <strong>추가:</strong> 타임블록에 할일을 배치하면 Google Calendar에 자동 생성</li>
                    <li>• <strong>수정:</strong> 할일 제목, 시간, 난이도 변경 시 자동 업데이트</li>
                    <li>• <strong>삭제:</strong> 할일 삭제 시 Calendar 이벤트도 삭제</li>
                    <li>• <strong>완료:</strong> 완료된 할일은 회색으로 표시되고 설명에 완료 시간 추가</li>
                    <li>• <strong>난이도:</strong> 🟢쉬움(초록) / 🟡보통(노랑) / 🔴어려움(빨강) 색상으로 구분</li>
                </ul>
            </div>
        </div>
    );
}
