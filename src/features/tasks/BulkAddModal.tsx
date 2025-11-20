/**
 * BulkAddModal
 *
 * @role 여러 작업을 한 번에 추가할 수 있는 대량 추가 모달 컴포넌트 (F1 단축키로 열기)
 * @input isOpen (boolean), onClose (function), onAddTasks (function)
 * @output 텍스트 입력 영역, 기본 설정 옵션, 파싱된 작업 미리보기, 추가 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - TIME_BLOCKS, RESISTANCE_MULTIPLIERS: 도메인 타입 및 상수
 */

import { useState, useRef, useEffect, useId } from 'react';
import type { Task, TimeBlockId, Resistance } from '@/shared/types/domain';
import { TIME_BLOCKS, RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';

interface BulkAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddTasks: (tasks: Task[]) => Promise<void>;
}

interface ParsedTask {
    text: string;
    memo?: string;
    baseDuration?: number;
    resistance?: Resistance;
    timeBlock?: TimeBlockId;
}

const modalOverlayClass =
    'modal-overlay fixed inset-0 z-[1000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-xl md:items-center';
const modalContainerClass =
    'modal-content relative flex h-[min(92vh,820px)] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)]';
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

/**
 * 대량 할 일 추가 모달 컴포넌트
 * 한 줄에 하나씩 작업을 입력하면 자동으로 파싱하여 여러 작업을 한 번에 추가할 수 있습니다.
 *
 * @param {BulkAddModalProps} props - isOpen, onClose, onAddTasks를 포함하는 props
 * @returns {JSX.Element | null} 모달 UI (isOpen이 false면 null)
 * @sideEffects
 *   - ESC 키로 모달 닫기
 *   - Ctrl/Cmd + Enter로 작업 추가
 *   - 입력값 변경 시 실시간 미리보기 업데이트
 */
export default function BulkAddModal({ isOpen, onClose, onAddTasks }: BulkAddModalProps) {
    const [input, setInput] = useState('');
    const [defaultTimeBlock, setDefaultTimeBlock] = useState<TimeBlockId>(null);
    const [defaultResistance, setDefaultResistance] = useState<Resistance>('low');
    const [defaultDuration, setDefaultDuration] = useState(30);
    const [loading, setLoading] = useState(false);
    const [previewTasks, setPreviewTasks] = useState<ParsedTask[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    // 모달 열릴 때 textarea에 포커스
    useEffect(() => {
        if (isOpen) {
            textareaRef.current?.focus();
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
     * 입력 텍스트 파싱
     * 각 줄을 하나의 작업으로 변환
     *
     * 포맷:
     * - 기본: "작업 제목"
     * - 메모 포함: "작업 제목 | 메모"
     * - 시간 포함: "작업 제목 [30m]" 또는 "작업 제목 [1h]"
     * - 저항도 포함: "작업 제목 🟢" 또는 "작업 제목 🟡" 또는 "작업 제목 🔴"
     * - 블록 지정: "작업 제목 @8-11" (블록 ID)
     * - 복합: "작업 제목 [45m] 🟡 @11-14 | 메모"
     */
    function parseInput(text: string): ParsedTask[] {
        const lines = text.split('\n').filter((line) => line.trim());
        const tasks: ParsedTask[] = [];

        for (const line of lines) {
            let remainingText = line.trim();
            const task: ParsedTask = {
                text: '',
                resistance: defaultResistance,
                baseDuration: defaultDuration,
                timeBlock: defaultTimeBlock,
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
            task.text = remainingText || '(제목 없음)';

            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 작업 추가
     */
    const handleSubmit = async () => {
        if (previewTasks.length === 0) {
            alert('추가할 작업이 없습니다.');
            return;
        }

        setLoading(true);

        try {
            // ParsedTask를 Task로 변환
            const tasks: Task[] = previewTasks.map((parsed) => {
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

            await onAddTasks(tasks);

            // 초기화
            setInput('');
            setPreviewTasks([]);
            onClose();

            alert(`${tasks.length}개의 작업이 추가되었습니다!`);
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-2xl shadow-[0_18px_45px_rgba(79,70,229,0.45)]">
                            🧾
                        </div>
                        <div className="space-y-1">
                            <h2 id={titleId} className="text-2xl font-bold leading-tight text-[var(--color-text)]">
                                대량 작업 추가
                            </h2>
                            <p id={descriptionId} className="text-sm text-[var(--color-text-secondary)]">
                                여러 줄을 붙여넣으면 타임블록, 저항도, 메모, 예상 시간을 자동으로 파싱해 드려요.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="대량 추가 모달 닫기"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
                    >
                        ×
                    </button>

                </div>



                <div className="flex flex-1 flex-col overflow-hidden">

                    <div className="flex-1 overflow-y-auto px-6 py-6">

                        <div className="flex flex-col gap-6">

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
                                        <option value="">각 줄에서 지정</option>
                                        {TIME_BLOCKS.map((block) => (
                                            <option key={block.id} value={block.id}>
                                                {block.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[var(--color-text-tertiary)]">@태그가 없는 줄에 기본으로 적용돼요.</p>
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
                                    <p className="text-xs text-[var(--color-text-tertiary)]">줄에 저항 태그가 없으면 이 값이 사용돼요.</p>
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
                                    <p className="text-xs text-[var(--color-text-tertiary)]">작업 모달과 동일한 빠른 선택지예요.</p>
                                </div>
                            </div>



                            <div className="grid gap-4 lg:grid-cols-2">

                                <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                                        <span className="text-sm font-semibold text-[var(--color-text)]">작업 입력</span>
                                        <span className="text-xs text-[var(--color-text-tertiary)]">| 메모, [30m], @8-11 태그를 활용해 보세요.</span>
                                    </div>
                                    <div className="flex flex-1 flex-col p-4">
                                        <textarea
                                            ref={textareaRef}
                                            className={textareaClass}
                                            placeholder={`각 줄이 하나의 작업이 됩니다.

예시:
딥워크 스프린트 [45m] high(저항 높음) @8-11 | React 기능 리팩터링
인박스 제로 [15m] low(저항 낮음)
내일 계획 세우기 [30m] medium(보통 저항) | 에너지 체크`}
                                            value={input}

                                            onChange={(e) => setInput(e.target.value)}

                                            onKeyDown={handleKeyDown}

                                            rows={12}

                                        />

                                    </div>

                                </div>



                                <div className={previewContainerClass}>
                                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                                        <span className="text-sm font-semibold text-[var(--color-text)]">미리보기</span>
                                        {previewTasks.length > 0 && (
                                            <span className="text-xs text-[var(--color-text-tertiary)]">{previewTasks.length}개</span>
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

                                                            key={`${task.text}-${index}`}

                                                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition hover:border-[var(--color-primary)]/40"

                                                        >

                                                            <div className="flex items-start gap-3">

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

                                                    );

                                                })}

                                            </div>

                                        ) : (
                                            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
                                                입력을 시작하면 이곳에서 파싱된 작업을 확인할 수 있어요.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>



                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                        팁: Ctrl/Cmd + Enter를 누르면 마우스 조작 없이 바로 추가할 수 있어요.
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
                            disabled={loading || previewTasks.length === 0}
                            className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.45)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {loading ? '작업 추가 중…' : `작업 ${previewTasks.length}개 추가`}
                        </button>
                    </div>
                </div>
            </div>

        </div>

    );

}

