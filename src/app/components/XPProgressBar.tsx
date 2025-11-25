/**
 * XPProgressBar Component
 *
 * @role XP 진행률 표시 바
 * @input availableXP
 * @output XP 진행률 UI
 */

import { memo } from 'react';

interface XPProgressBarProps {
  availableXP: number;
}

/**
 * XP 진행률 바 컴포넌트
 */
function XPProgressBarComponent({ availableXP }: XPProgressBarProps) {
  const safeXP = Math.max(0, availableXP);
  const level = Math.floor(safeXP / 100);
  const currentXP = safeXP % 100;
  const percent = Math.min(100, currentXP);
  const marks = [25, 50, 75];

  return (
    <div className="px-[var(--spacing-lg)] pb-1 pt-1">
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[11px] shadow-[0_8px_20px_rgba(0,0,0,0.2)] backdrop-blur-md">
        <div className="flex items-center justify-center rounded-lg bg-[var(--color-primary)]/15 px-2 py-1 text-[var(--color-text)]">
          <span className="mr-1 text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">Lv.</span>
          <span className="text-base font-extrabold text-[var(--color-primary)]">{level}</span>
        </div>

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="whitespace-nowrap text-[10px] text-[var(--color-text-secondary)]">다음 레벨</span>
          <div className="relative h-3 flex-1 overflow-visible rounded-full border border-white/10 bg-white/10">
            {marks.map(mark => (
              <div
                key={mark}
                className="absolute top-0 h-full w-[2px] bg-white/35"
                style={{ left: `${mark}%` }}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-white/70">{mark}</span>
              </div>
            ))}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] via-amber-500 to-orange-500 transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <span className="whitespace-nowrap tabular-nums text-[11px] font-semibold text-[var(--color-text)]">
            {currentXP} / 100
          </span>
        </div>

        <div className="whitespace-nowrap text-[11px] font-semibold text-[var(--color-text)]">
          {availableXP} XP
        </div>
      </div>
    </div>
  );
}

export const XPProgressBar = memo(XPProgressBarComponent);
