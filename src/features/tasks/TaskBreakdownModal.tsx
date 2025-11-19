/**
 * TaskBreakdownModal
 *
 * @role AI가 생성한 작업 세분화 결과를 보여주고, 사용자가 수정하여 적용할 수 있게 하는 모달
 * @input isOpen, onClose, onConfirm, initialText (AI 생성 결과)
 * @output 텍스트 입력 영역, 파싱된 작업 미리보기 (체크박스 포함), 적용 버튼, 재생성 버튼
 * @external_dependencies
 *   - TIME_BLOCKS, RESISTANCE_MULTIPLIERS: 도메인 타입 및 상수
 */

import { useState, useRef, useEffect, useId } from 'react';
import type { Task, TimeBlockId, Resistance } from '@/shared/types/domain';
import { TIME_BLOCKS, RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';
import { useTaskBreakdownStore } from './stores/breakdownStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';

interface TaskBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (tasks: Task[]) => Promise<void>;
    initialText: string;
}

interface ParsedTask {
    id: string; // 고유 ID 추가
    text: string;
    memo?: string;
    baseDuration?: number;
    resistance?: Resistance;
    timeBlock?: TimeBlockId;
    checked: boolean; // 체크박스 상태
}

const modalOverlayClass =
    'modal-overlay fixed inset-0 z-[2000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-xl md:items-center';
const modalContainerClass =
    'modal-content relative flex h-[min(92vh,820px)] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)] animate-in zoom-in-95 duration-200';
const controlCardClass =
    'flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4';
const selectClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const textareaClass =
    'h-full min-h-[260px] w-full flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30';
const previewContainerClass =
    'flex flex-1 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]';
const resistanceBadgeClass: Record<Resistance, string> = {
    low: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40',
    medium: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40',
    high: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40',
};
const resistanceLabel: Record<Resistance, string> = {
    low: '저항 낮음',
    medium: '보통 저항',
    high: '저항 높음',
};
const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120];

export default function TaskBreakdownModal({ isOpen, onClose, onConfirm, initialText }: TaskBreakdownModalProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    const { taskData, source, triggerBreakdown } = useTaskBreakdownStore();
    const { settings } = useSettingsStore();
    const { waifuState } = useWaifu();

    const [input, setInput] = useState(initialText);
    const [defaultTimeBlock, setDefaultTimeBlock] = useState<TimeBlockId>(null);
    const [defaultResistance, setDefaultResistance] = useState<Resistance>('low');
    const [defaultDuration, setDefaultDuration] = useState(30);
    const [loading, setLoading] = useState(false);
    const [previewTasks, setPreviewTasks] = useState<ParsedTask[]>([]);
    const [regenerating, setRegenerating] = useState(false);

    // 초기 텍스트 및 기본값 설정
    useEffect(() => {
        if (isOpen && taskData) {
            setInput(initialText);
            // 원본 작업의 timeBlock을 기본값으로 설정
            setDefaultTimeBlock(taskData.timeBlock || null);
            setDefaultResistance(taskData.resistance || 'low');
            setDefaultDuration(taskData.baseDuration || 30);
        }
    }, [isOpen, initialText, taskData]);

    // 모달 열릴 때 textarea에 포커스
    useEffect(() => {
        if (isOpen) {
            // 약간의 지연 후 포커스 (모달 애니메이션 고려)
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
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

    // 입력값 변경 시 미리보기 업데이트
    useEffect(() => {
        if (input.trim()) {
            const parsed = parseInput(input);
            setPreviewTasks(parsed);
        } else {
            setPreviewTasks([]);
        }
    }, [input, defaultTimeBlock, defaultResistance, defaultDuration]);

    /**
     * 입력 텍스트 파싱 (BulkAddModal과 동일한 로직)
     */
    function parseInput(text: string): ParsedTask[] {
        const lines = text.split('\n').filter((line) => line.trim());
        const tasks: ParsedTask[] = [];

        for (const line of lines) {
            let remainingText = line.trim();

            // 마크다운 불릿 포인트 제거
            remainingText = remainingText.replace(/^[-*]\s+/, '');
            // 숫자 리스트 제거 (1. )
            remainingText = remainingText.replace(/^\d+\.\s+/, '');

            const task: ParsedTask = {
                id: generateId('parsed-task'),
                text: '',
                resistance: defaultResistance,
                baseDuration: defaultDuration,
                timeBlock: defaultTimeBlock,
                checked: true, // 기본적으로 모두 체크
            };

            // 메모 추출 (| 뒤의 내용)
            const memoMatch = remainingText.match(/\|(.+)$/);
            if (memoMatch) {
                task.memo = memoMatch[1].trim();
                remainingText = remainingText.replace(/\|.+$/, '').trim();
            }

            // 블록 ID 추출 (@블록ID)
            const blockMatch = remainingText.match(/@(\d+-\d+)/);
            if (blockMatch) {
                const blockId = blockMatch[1];
                if (TIME_BLOCKS.some((b) => b.id === blockId)) {
                    task.timeBlock = blockId as TimeBlockId;
                }
                remainingText = remainingText.replace(/@\d+-\d+/, '').trim();
            }

            // 저항도 추출 (이모지)
            if (remainingText.includes('🟢')) {
                task.resistance = 'low';
                remainingText = remainingText.replace('🟢', '').trim();
            } else if (remainingText.includes('🟡')) {
                task.resistance = 'medium';
                remainingText = remainingText.replace('🟡', '').trim();
            } else if (remainingText.includes('🔴')) {
                task.resistance = 'high';
                remainingText = remainingText.replace('🔴', '').trim();
            }

            // 시간 추출 ([30m] 또는 [1h] 또는 [1h30m])
            const timeMatch = remainingText.match(/\[(\d+(?:\.\d+)?)(h|m)\]/);
            if (timeMatch) {
                const value = parseFloat(timeMatch[1]);
                const unit = timeMatch[2];
                task.baseDuration = unit === 'h' ? value * 60 : value;
                remainingText = remainingText.replace(/\[\d+(?:\.\d+)?(h|m)\]/, '').trim();
            }

            // 남은 텍스트가 작업 제목
            // 대괄호로 감싸진 부분 제거 (혹시 남은게 있다면)
            remainingText = remainingText.replace(/\[.*?\]/g, '').trim();

            task.text = remainingText || '(제목 없음)';

            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 체크박스 토글
     */
    const toggleTaskCheck = (taskId: string) => {
        setPreviewTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, checked: !task.checked } : task
        ));
    };

    /**
     * 전체 선택/해제
     */
    const toggleAllChecks = () => {
        const allChecked = previewTasks.every(task => task.checked);
        setPreviewTasks(prev => prev.map(task => ({ ...task, checked: !allChecked })));
    };

    /**
     * 재생성 핸들러
     */
    const handleRegenerate = async (refinement: 'more_detailed' | 'simpler') => {
        if (!taskData || !source || !settings?.geminiApiKey) return;

        setRegenerating(true);
        try {
            await triggerBreakdown(
                taskData,
                source,
                settings.geminiApiKey,
                waifuState?.affection ?? 50,
                refinement
            );
        } catch (error) {
            console.error('Failed to regenerate:', error);
        } finally {
            setRegenerating(false);
        }
    };

    /**
     * 작업 적용
     */
    const handleSubmit = async () => {
        const checkedTasks = previewTasks.filter(task => task.checked);

        if (checkedTasks.length === 0) {
            alert('최소 1개 이상의 작업을 선택해주세요.');
            return;
        }

        setLoading(true);

        try {
            // ParsedTask를 Task로 변환 (체크된 것만)
            const tasks: Task[] = checkedTasks.map((parsed) => {
                const resistance = parsed.resistance || defaultResistance;
                const baseDuration = parsed.baseDuration || defaultDuration;
                const multiplier = RESISTANCE_MULTIPLIERS[resistance];
                const adjustedDuration = Math.round(baseDuration * multiplier);

                return {
                    id: generateId('task'),
                    text: parsed.text,
                    memo: parsed.memo || '',
                    baseDuration,
                    resistance,
                    adjustedDuration,
                    timeBlock: parsed.timeBlock || defaultTimeBlock,
                    completed: false,
                    actualDuration: 0,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                };
            });

            await onConfirm(tasks);
            onClose();
        } catch (error) {
            console.error('Failed to add tasks:', error);
            alert('작업 추가에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl/Cmd + Enter로 제출
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (!isOpen) return null;

    const checkedCount = previewTasks.filter(task => task.checked).length;
    const allChecked = previewTasks.length > 0 && previewTasks.every(task => task.checked);

    return (
        <div className={modalOverlayClass} onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={modalContainerClass}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl shadow-[0_18px_45px_rgba(79,70,229,0.45)]">
                            🧠
                        </div>
                        <div className="space-y-1">
                            <h2 id={titleId} className="text-2xl font-bold leading-tight text-[var(--color-text)]">
                                AI 작업 세분화
                            </h2>
                            <p id={descriptionId} className="text-sm text-[var(--color-text-secondary)]">
                                AI가 제안한 세부 할일들을 확인하고 수정해주세요.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
                    >
                        ×
                    </button>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        <div className="flex flex-col gap-6">
                            {/* 재생성 버튼 */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleRegenerate('more_detailed')}
                                    disabled={regenerating || !taskData}
                                    className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    🔍 더 잘게 쪼개기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRegenerate('simpler')}
                                    disabled={regenerating || !taskData}
                                    className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    📦 더 간단하게 묶기
                                </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className={controlCardClass}>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        기본 타임블록
                                    </span>
                                    <select
                                        className={selectClass}
                                        value={defaultTimeBlock ?? ''}
                                        onChange={(e) => setDefaultTimeBlock(e.target.value ? (e.target.value as TimeBlockId) : null)}
                                    >
                                        <option value="">지정 안 함 (인박스)</option>
                                        {TIME_BLOCKS.map((block) => (
                                            <option key={block.id} value={block.id}>
                                                {block.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={controlCardClass}>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        기본 저항도
                                    </span>
                                    <select
                                        className={selectClass}
                                        value={defaultResistance}
                                        onChange={(e) => setDefaultResistance(e.target.value as Resistance)}
                                    >
                                        <option value="low">저항 낮음</option>
                                        <option value="medium">보통 저항</option>
                                        <option value="high">저항 높음</option>
                                    </select>
                                </div>

                                <div className={controlCardClass}>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        기본 예상 시간
                                    </span>
                                    <select
                                        className={selectClass}
                                        value={String(defaultDuration)}
                                        onChange={(e) => setDefaultDuration(Number(e.target.value))}
                                    >
                                        {DURATION_OPTIONS.map((minutes) => (
                                            <option key={minutes} value={minutes}>
                                                {minutes < 60 ? `${minutes}분` : `${minutes / 60}시간`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                                        <span className="text-sm font-semibold text-[var(--color-text)]">편집하기</span>
                                        <span className="text-xs text-[var(--color-text-tertiary)]">자유롭게 수정하세요</span>
                                    </div>
                                    <div className="flex flex-1 flex-col p-4">
                                        <textarea
                                            ref={textareaRef}
                                            className={textareaClass}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            rows={12}
                                        />
                                    </div>
                                </div>

                                <div className={previewContainerClass}>
                                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-[var(--color-text)]">미리보기</span>
                                            {previewTasks.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={toggleAllChecks}
                                                    className="text-xs text-[var(--color-primary)] hover:underline"
                                                >
                                                    {allChecked ? '전체 해제' : '전체 선택'}
                                                </button>
                                            )}
                                        </div>
                                        {previewTasks.length > 0 && (
                                            <span className="text-xs text-[var(--color-text-tertiary)]">
                                                {checkedCount}/{previewTasks.length}개 선택됨
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-4">
                                        {previewTasks.length > 0 ? (
                                            <div className="flex flex-col gap-3">
                                                {previewTasks.map((task, index) => {
                                                    const resistance = task.resistance || defaultResistance;
                                                    const duration = task.baseDuration || defaultDuration;
                                                    const blockLabel = task.timeBlock
                                                        ? TIME_BLOCKS.find((b) => b.id === task.timeBlock)?.label
                                                        : null;

                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`rounded-2xl border ${
                                                                task.checked
                                                                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-bg)]'
                                                                    : 'border-[var(--color-border)] bg-[var(--color-bg)]/50 opacity-50'
                                                            } p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition hover:border-[var(--color-primary)]/60`}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={task.checked}
                                                                    onChange={() => toggleTaskCheck(task.id)}
                                                                    className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 cursor-pointer"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">#{index + 1}</span>
                                                                        <p className="flex-1 text-sm font-semibold leading-relaxed text-[var(--color-text)]">
                                                                            {task.text}
                                                                        </p>
                                                                    </div>
                                                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                                                        <span
                                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resistanceBadgeClass[resistance]}`}
                                                                        >
                                                                            {resistanceLabel[resistance]}
                                                                        </span>
                                                                        <span className="rounded-full bg-[var(--color-bg-tertiary)]/60 px-2 py-0.5 font-semibold text-[var(--color-text)]">
                                                                            ⏱ {duration}분
                                                                        </span>
                                                                        {blockLabel && (
                                                                            <span className="rounded-full bg-[var(--color-bg-tertiary)]/60 px-2 py-0.5 font-semibold text-[var(--color-text)]">
                                                                                📅 {blockLabel}
                                                                            </span>
                                                                        )}
                                                                        {task.memo && (
                                                                            <span className="truncate text-[var(--color-text-tertiary)]">📝 {task.memo}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
                                                AI가 제안한 내용이 없거나 모두 지워졌어요.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                        팁: Ctrl/Cmd + Enter를 누르면 바로 적용됩니다.
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60 disabled:opacity-60"
                            disabled={loading}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || checkedCount === 0}
                            className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.45)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {loading ? '적용 중…' : `작업 ${checkedCount}개 적용하기`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
