import type { ShortcutsTabProps, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass } from './styles';

export function ShortcutsTab({ localSettings, setLocalSettings }: ShortcutsTabProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, settingKey: keyof Settings) => {
        e.preventDefault();
        const keys: string[] = [];
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
            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, [settingKey]: shortcut }) : prev);
        }
    };

    return (
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, leftPanelToggleKey: e.target.value }) : prev)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 'leftPanelToggleKey')}
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, rightPanelToggleKey: e.target.value }) : prev)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 'rightPanelToggleKey')}
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, bulkAddModalKey: e.target.value }) : prev)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 'bulkAddModalKey')}
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
    );
}
