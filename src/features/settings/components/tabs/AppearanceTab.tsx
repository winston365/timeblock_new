import type { AppearanceTabProps } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass, primaryButtonClass } from './styles';

export function AppearanceTab({
    localSettings,
    setLocalSettings,
    currentTheme,
    setCurrentTheme,
    appVersion,
    checkingUpdate,
    updateStatus,
    handleCheckForUpdates,
}: AppearanceTabProps) {
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

    const updateClass = !updateStatus
        ? ''
        : updateStatus.startsWith('✅')
            ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
            : updateStatus.startsWith('❌')
                ? 'border border-rose-400/40 bg-rose-500/10 text-rose-100'
                : 'border border-sky-400/40 bg-sky-500/10 text-sky-100';

    return (
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
                        setLocalSettings(prev => prev ? ({ ...prev, waifuMode: e.target.value as 'characteristic' | 'normal' }) : prev)
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
    );
}
