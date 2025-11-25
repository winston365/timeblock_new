/**
 * WaifuAside Component
 *
 * @role 와이푸 패널 컨테이너 컴포넌트
 * @input visibility state
 * @output 와이푸 패널 aside UI
 */

import { memo } from 'react';
import WaifuPanel from '@/features/waifu/WaifuPanel';

interface WaifuAsideProps {
  visibility: 'visible' | 'peeking' | 'hidden';
  waifuContainerClass: string;
  waifuVisibilityClass: string;
}

/**
 * 와이푸 패널 Aside 컴포넌트
 */
function WaifuAsideComponent({ 
  visibility, 
  waifuContainerClass, 
  waifuVisibilityClass 
}: WaifuAsideProps) {
  return (
    <aside
      className={waifuContainerClass}
      data-visibility={visibility}
      aria-label="와이푸 패널"
      role="complementary"
      aria-hidden={visibility !== 'visible'}
      {...(visibility !== 'visible' ? { inert: 'true' as any } : {})}
    >
      <div className={`waifu-panel-shell relative w-[320px] transform transition-all duration-300 ${waifuVisibilityClass}`}>
        {visibility !== 'visible' && (
          <div
            aria-hidden="true"
            className="absolute left-[-2.5rem] top-1/2 flex min-w-[2.2rem] -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/10 bg-[var(--color-bg-secondary)]/90 px-2 py-3 text-center text-[0.5rem] font-semibold uppercase tracking-[0.25em] text-white/80 shadow-[0_12px_35px_rgba(0,0,0,0.55)] backdrop-blur-md"
          >
            <span className="rotate-90 text-[0.6rem] text-white/70">와이푸</span>
          </div>
        )}
        <WaifuPanel />
      </div>
    </aside>
  );
}

export const WaifuAside = memo(WaifuAsideComponent);
