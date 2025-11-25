import type { GeminiTabProps, TimeSlotTagTemplate, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass, primaryButtonClass, getBadgeTextColor } from './styles';

export function GeminiTab({ localSettings, setLocalSettings }: GeminiTabProps) {
    const tagTemplates = localSettings?.timeSlotTags || [];

    const addTagTemplate = () => {
        const newTag: TimeSlotTagTemplate = {
            id: `tag-${Date.now()}`,
            label: '새 속성',
            color: '#94a3b8',
            icon: '🏷️',
        };
        setLocalSettings((prev: Settings | null) => prev ? ({
            ...prev,
            timeSlotTags: [...(prev.timeSlotTags || []), newTag]
        }) : prev);
    };

    const updateTagTemplate = (id: string, key: keyof TimeSlotTagTemplate, value: string) => {
        setLocalSettings((prev: Settings | null) => {
            if (!prev) return prev;
            const currentTags = prev.timeSlotTags || [];
            return {
                ...prev,
                timeSlotTags: currentTags.map((tag: TimeSlotTagTemplate) => (tag.id === id ? { ...tag, [key]: value } : tag))
            };
        });
    };

    const removeTagTemplate = (id: string) => {
        setLocalSettings((prev: Settings | null) => {
            if (!prev) return prev;
            const currentTags = prev.timeSlotTags || [];
            return {
                ...prev,
                timeSlotTags: currentTags.filter((tag: TimeSlotTagTemplate) => tag.id !== id)
            };
        });
    };

    return (
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, geminiApiKey: e.target.value }) : prev)
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, geminiModel: e.target.value }) : prev)
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
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, autoEmojiEnabled: e.target.checked }) : prev)
                        }
                    />
                    <div className="group h-12 w-24 rounded-full border border-gray-600 bg-gradient-to-tr from-rose-100 via-rose-400 to-rose-500 shadow-md shadow-gray-900 transition duration-300 peer-checked:bg-gradient-to-tr peer-checked:from-green-100 peer-checked:via-lime-400 peer-checked:to-lime-500">
                        <span className="absolute left-1 top-1 flex h-10 w-10 items-center justify-center rounded-full border border-gray-600 bg-gray-50 text-lg transition-all duration-300 -rotate-180 peer-checked:translate-x-12 peer-checked:rotate-0 peer-hover:scale-95">
                            {localSettings?.autoEmojiEnabled ? '✔️' : '✖️'}
                        </span>
                    </div>
                </label>
            </div>

            <div className={formGroupClass}>
                <label htmlFor="ignition-inactivity">
                    🔥 점화 버튼 비활동 시간 (분)
                </label>
                <input
                    id="ignition-inactivity"
                    type="number"
                    min="5"
                    max="180"
                    className={inputClass}
                    placeholder="45"
                    value={localSettings?.ignitionInactivityMinutes ?? 45}
                    onChange={(e) => {
                        const value = parseInt(e.target.value) || 45;
                        const clampedValue = Math.max(5, Math.min(180, value));
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionInactivityMinutes: clampedValue }) : prev);
                    }}
                />
                <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                    마지막 작업 완료 후 이 시간이 지나면 점화 버튼이 나타납니다 (5-180분)
                </small>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className={formGroupClass}>
                    <label htmlFor="ignition-duration">점화 길이 (분)</label>
                    <input
                        id="ignition-duration"
                        type="number"
                        min="1"
                        max="30"
                        className={inputClass}
                        value={localSettings?.ignitionDurationMinutes ?? 3}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 3;
                            const clamped = Math.max(1, Math.min(30, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionDurationMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">점화 타이머 기본 길이 (1-30분)</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="ignition-cooldown">쿨다운 (분)</label>
                    <input
                        id="ignition-cooldown"
                        type="number"
                        min="1"
                        max="120"
                        className={inputClass}
                        value={localSettings?.ignitionCooldownMinutes ?? 5}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 15;
                            const clamped = Math.max(1, Math.min(120, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionCooldownMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">점화 재사용 대기시간 (1-120분)</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="just-do-it-cooldown">'그냥해보자!' 쿨다운 (분)</label>
                    <input
                        id="just-do-it-cooldown"
                        type="number"
                        min="1"
                        max="120"
                        className={inputClass}
                        value={localSettings?.justDoItCooldownMinutes ?? 15}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 15;
                            const clamped = Math.max(1, Math.min(120, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, justDoItCooldownMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">비활동 시 나타나는 버튼의 재사용 대기시간</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="ignition-xp">XP 비용</label>
                    <input
                        id="ignition-xp"
                        type="number"
                        min="0"
                        max="500"
                        className={inputClass}
                        value={localSettings?.ignitionXPCost ?? 50}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const clamped = Math.max(0, Math.min(500, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionXPCost: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">무료 횟수 소진 후 XP로 구매 시 비용</small>
                </div>
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>🎯 통계 목표 설정</h3>
            <p className={sectionDescriptionClass}>
                주간 및 월간 XP 목표를 설정하여 통계 대시보드에서 진행률을 확인할 수 있습니다.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className={formGroupClass}>
                    <label htmlFor="weekly-xp-goal">주간 XP 목표</label>
                    <input
                        id="weekly-xp-goal"
                        type="number"
                        min="0"
                        max="50000"
                        step="100"
                        className={inputClass}
                        placeholder="설정 안 함"
                        value={localSettings?.weeklyXPGoal || ''}
                        onChange={(e) => {
                            const value = e.target.value === '' ? undefined : parseInt(e.target.value) || 0;
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, weeklyXPGoal: value }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                        주간 XP 목표를 설정하면 통계 대시보드에 진행률이 표시됩니다
                    </small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="monthly-xp-goal">월간 XP 목표</label>
                    <input
                        id="monthly-xp-goal"
                        type="number"
                        min="0"
                        max="200000"
                        step="500"
                        className={inputClass}
                        placeholder="설정 안 함"
                        value={localSettings?.monthlyXPGoal || ''}
                        onChange={(e) => {
                            const value = e.target.value === '' ? undefined : parseInt(e.target.value) || 0;
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, monthlyXPGoal: value }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                        월간 XP 목표를 설정하면 통계 대시보드에 진행률이 표시됩니다
                    </small>
                </div>
            </div>

            <div className={infoBoxClass}>
                <strong>💡 팁:</strong> 목표는 비워두면 통계에 표시되지 않습니다.
                현실적인 목표를 설정하여 꾸준히 달성하는 습관을 만들어보세요!
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
                            아직 템플릿이 없습니다. "+ 템플릿 추가" 버튼으로 시작하세요.
                        </div>
                    )}

                    {tagTemplates.map((tag: TimeSlotTagTemplate) => (
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, autoMessageInterval: parseInt(e.target.value) || 15 }) : prev)
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
    );
}
