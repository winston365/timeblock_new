/**
 * Settings Tab Styles
 *
 * @role Settings 탭 컴포넌트들이 공유하는 Tailwind 스타일 상수 및 유틸리티 함수
 * @input 없음 (상수/유틸리티 정의 파일)
 * @output CSS 클래스 문자열, 색상 계산 함수, 비용 계산 함수
 * @external_dependencies 없음
 */

// Shared style constants for Settings tabs
export const modalOverlayClass =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';

export const modalContainerClass =
    'flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl';

export const sidebarClass =
    'flex w-40 shrink-0 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3';

export const tabButtonBase =
    'flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-all';

export const sectionClass = 'flex flex-col gap-4 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-[var(--color-text)]';

export const sectionDescriptionClass = 'text-sm text-[var(--color-text-secondary)] -mt-2 mb-2';

export const formGroupClass =
    'flex flex-col gap-1 [&>label]:text-sm [&>label]:font-semibold [&>label]:text-[var(--color-text)] [&>label>span.required]:ml-1 [&>label>span.required]:text-[var(--color-danger)]';

export const inputClass =
    'rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

export const infoBoxClass =
    'rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-[0.8rem] leading-6 text-sky-100';

export const primaryButtonClass =
    'rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

// Helper functions
export const getBadgeTextColor = (bg: string) => {
    if (!bg || bg.length < 7 || !bg.startsWith('#')) return '#0f172a';
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#0f172a' : '#f8fafc';
};

// Token cost calculation
export const calculateTokenCost = (inputTokens: number, outputTokens: number) => {
    const inputCost = (inputTokens / 1_000_000) * 2.0;
    const outputCost = (outputTokens / 1_000_000) * 12.0;
    return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
    };
};

export const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
};
