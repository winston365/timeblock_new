/**
 * GameplayTab
 *
 * @role 게임플레이 관련 설정 (점화, 통계 목표, 타임블록 XP, 와이푸, 비활동 집중모드) 탭
 * @input GameplayTabProps (localSettings, setLocalSettings)
 * @output 점화 설정, XP 목표, 와이푸 설정 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import type { BaseTabProps, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass } from './styles';
import { SETTING_DEFAULTS, IDLE_FOCUS_DEFAULTS, IGNITION_DEFAULTS } from '@/shared/constants/defaults';

export function GameplayTab({ localSettings, setLocalSettings }: BaseTabProps) {
    return (
        <div className={sectionClass}>
            {/* ADHD 집중 모드 - 비활동 감지 */}
            <h3>🎯 비활동 시 집중 모드</h3>
            <p className={sectionDescriptionClass}>
                일정 시간 동안 활동이 없으면 자동으로 집중 모드(FocusView)로 전환됩니다.
                ADHD 사용자를 위해 "지금 해야 할 것"에 집중할 수 있도록 도와줍니다.
            </p>

            <div className={formGroupClass}>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={localSettings?.idleFocusModeEnabled ?? IDLE_FOCUS_DEFAULTS.enabled}
                        onChange={(e) => {
                            setLocalSettings((prev: Settings | null) => prev ? ({
                                ...prev,
                                idleFocusModeEnabled: e.target.checked
                            }) : prev);
                        }}
                        className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-text)]">
                        비활동 시 집중 모드 자동 전환
                    </span>
                </label>
            </div>

            {localSettings?.idleFocusModeEnabled && (
                <div className={formGroupClass}>
                    <label htmlFor="idle-focus-minutes">비활동 감지 시간 (분)</label>
                    <input
                        id="idle-focus-minutes"
                        type="number"
                        min="1"
                        max="30"
                        className={inputClass}
                        value={localSettings?.idleFocusModeMinutes ?? IDLE_FOCUS_DEFAULTS.minutes}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 3;
                            const clamped = Math.max(1, Math.min(30, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({
                                ...prev,
                                idleFocusModeMinutes: clamped
                            }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                        이 시간 동안 마우스/키보드 활동이 없으면 집중 모드로 전환됩니다 (1-30분)
                    </small>
                </div>
            )}

            <div className={infoBoxClass}>
                <strong>💡 작동 방식:</strong> 비활동 감지 시 5초 카운트다운 토스트가 표시됩니다.
                카운트다운 중 마우스를 움직이면 취소됩니다. 이미 집중 모드인 경우 전환되지 않습니다.
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>🔥 점화 설정</h3>
            <p className={sectionDescriptionClass}>
                비활동 상태일 때 나타나는 점화 기능의 동작을 설정합니다.
            </p>

            <div className={formGroupClass}>
                <label htmlFor="ignition-inactivity">
                    비활동 시간 (분)
                </label>
                <input
                    id="ignition-inactivity"
                    type="number"
                    min="5"
                    max="180"
                    className={inputClass}
                    placeholder="45"
                    value={localSettings?.ignitionInactivityMinutes ?? SETTING_DEFAULTS.ignitionInactivityMinutes}
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

            <div className="grid gap-3 sm:grid-cols-2">
                <div className={formGroupClass}>
                    <label htmlFor="ignition-duration">점화 타이머 길이 (분)</label>
                    <input
                        id="ignition-duration"
                        type="number"
                        min="1"
                        max="30"
                        className={inputClass}
                        value={localSettings?.ignitionDurationMinutes ?? IGNITION_DEFAULTS.durationMinutes}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 3;
                            const clamped = Math.max(1, Math.min(30, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionDurationMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">기본 타이머 길이 (1-30분)</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="ignition-cooldown">점화 쿨다운 (분)</label>
                    <input
                        id="ignition-cooldown"
                        type="number"
                        min="1"
                        max="120"
                        className={inputClass}
                        value={localSettings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 15;
                            const clamped = Math.max(1, Math.min(120, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionCooldownMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">재사용 대기시간 (1-120분)</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="just-do-it-cooldown">'그냥해보자!' 쿨다운 (분)</label>
                    <input
                        id="just-do-it-cooldown"
                        type="number"
                        min="1"
                        max="120"
                        className={inputClass}
                        value={localSettings?.justDoItCooldownMinutes ?? SETTING_DEFAULTS.justDoItCooldownMinutes}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 15;
                            const clamped = Math.max(1, Math.min(120, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, justDoItCooldownMinutes: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">비활동 버튼 재사용 대기시간</small>
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="ignition-xp">점화 XP 비용</label>
                    <input
                        id="ignition-xp"
                        type="number"
                        min="0"
                        max="500"
                        className={inputClass}
                        value={localSettings?.ignitionXPCost ?? IGNITION_DEFAULTS.xpCost}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const clamped = Math.max(0, Math.min(500, value));
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, ignitionXPCost: clamped }) : prev);
                        }}
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">무료 횟수 소진 후 XP 비용</small>
                </div>
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>📊 타임블록 XP 목표</h3>
            <p className={sectionDescriptionClass}>
                각 타임블록(3시간 단위)별 XP 획득 목표를 설정합니다. 23시~05시는 휴식 시간입니다.
            </p>

            <div className={formGroupClass}>
                <label htmlFor="timeblock-xp-goal">타임블록당 XP 목표</label>
                <div className="flex items-center gap-3">
                    <input
                        id="timeblock-xp-goal"
                        type="number"
                        className={`${inputClass} flex-1`}
                        min={50}
                        max={500}
                        step={10}
                        value={localSettings?.timeBlockXPGoal ?? 200}
                        onChange={(e) =>
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, timeBlockXPGoal: parseInt(e.target.value) || 200 }) : prev)
                        }
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">XP</span>
                </div>
                <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                    권장값: 150~250 XP. 타임블록이 바뀔 때마다 XP 진행률이 초기화됩니다.
                </small>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <h4 className="text-sm font-semibold text-[var(--color-text)]">⏰ 타임블록 시간대</h4>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                    {[
                        { time: '05:00 ~ 08:00', emoji: '🌅', label: '아침' },
                        { time: '08:00 ~ 11:00', emoji: '☀️', label: '오전' },
                        { time: '11:00 ~ 14:00', emoji: '🍽️', label: '점심' },
                        { time: '14:00 ~ 17:00', emoji: '💼', label: '오후' },
                        { time: '17:00 ~ 20:00', emoji: '🌆', label: '저녁' },
                        { time: '20:00 ~ 23:00', emoji: '🌙', label: '밤' },
                    ].map((block) => (
                        <div key={block.time} className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-surface)] px-3 py-2">
                            <span>{block.emoji}</span>
                            <span className="text-[var(--color-text)]">{block.label}</span>
                            <span className="ml-auto text-[var(--color-text-tertiary)]">{block.time}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 rounded-xl bg-slate-500/10 px-3 py-2 text-center text-[var(--color-text-tertiary)]">
                    🌙 23:00 ~ 05:00 휴식 시간 (XP 비활성화)
                </div>
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>🎯 주간/월간 XP 목표</h3>
            <p className={sectionDescriptionClass}>
                통계 대시보드에서 진행률을 확인할 수 있는 장기 목표를 설정합니다.
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
                        주간 목표 설정 시 통계에 진행률 표시
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
                        월간 목표 설정 시 통계에 진행률 표시
                    </small>
                </div>
            </div>

            <div className={infoBoxClass}>
                <strong>💡 팁:</strong> 목표는 비워두면 통계에 표시되지 않습니다.
                현실적인 목표를 설정하여 꾸준히 달성하는 습관을 만들어보세요!
            </div>

            <div className="my-4 border-t border-[var(--color-border)]" />

            <h3>👧 와이푸 모드</h3>
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, waifuMode: e.target.value as 'characteristic' | 'normal' }) : prev)
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
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, waifuImageChangeInterval: parseInt(e.target.value) }) : prev)
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
        </div>
    );
}
