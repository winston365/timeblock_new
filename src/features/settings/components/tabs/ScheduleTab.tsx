/**
 * ScheduleTab
 *
 * @role 스케줄 관련 설정 (시간대 속성 템플릿, 인사이트 주기) 탭
 * @input ScheduleTabProps (localSettings, setLocalSettings)
 * @output 시간대 태그 템플릿 CRUD, 인사이트 주기 설정 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import type { BaseTabProps, TimeSlotTagTemplate, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass, primaryButtonClass, getBadgeTextColor } from './styles';

export function ScheduleTab({ localSettings, setLocalSettings }: BaseTabProps) {
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
            <h3>🏷️ 시간대 속성 템플릿</h3>
            <p className={sectionDescriptionClass}>
                시간대 헤더에 표시할 속성(휴식/청소/집중 등)을 관리하세요.
            </p>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-text)]">템플릿 목록</span>
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

            <div className={infoBoxClass}>
                <strong>💡 팁:</strong> 시간대 속성은 스케줄 뷰에서 각 시간대 헤더의 태그 버튼을 클릭하여 적용할 수 있습니다.
                집중 시간, 휴식 시간, 미팅 등 다양한 용도로 활용해보세요!
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>💡 인사이트 설정</h3>
            <p className={sectionDescriptionClass}>
                AI 인사이트 패널의 자동 갱신 주기를 설정합니다.
            </p>

            <div className={formGroupClass}>
                <label htmlFor="insight-interval">
                    자동 갱신 주기 (분)
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
                <strong>💡 참고:</strong> 인사이트 자동 갱신은 Gemini API 키가 설정되어 있어야 작동합니다.
                갱신 주기가 짧을수록 API 사용량이 증가합니다.
            </div>
        </div>
    );
}
