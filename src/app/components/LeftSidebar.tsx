/**
 * LeftSidebar - 좌측 사이드바
 *
 * @role 전투 모드 패널을 포함한 좌측 사이드바
 * @input collapsed - 접힘 상태
 * @output 전투 모드 UI
 */

import { BattleSidebar } from '@/features/battle/components';
import { useBattleStore } from '@/features/battle/stores/battleStore';

/** LeftSidebar 컴포넌트 Props */
interface LeftSidebarProps {
  /** 사이드바 접힘 상태 */
  collapsed?: boolean;
}

/**
 * 좌측 사이드바 컴포넌트
 * @param props - LeftSidebarProps
 * @returns 전투 모드 UI
 */
export default function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  const dailyState = useBattleStore(state => state.dailyState);
  
  const defeatedCount = dailyState?.totalDefeated ?? 0;
  const totalBosses = dailyState?.bosses.length ?? 0;

  return (
    <nav
      className={`left-sidebar flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text)] transition-all duration-300 ${collapsed ? 'w-0 opacity-0 invisible' : 'w-full opacity-100 visible'
        }`}
      aria-label="메인 네비게이션"
      aria-hidden={collapsed}
    >
      {/* 헤더 - 진행 상황 포함 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">⚔️</span>
          <h3
            className="text-xs font-bold text-[var(--color-text)]"
            style={{ fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 900 }}
          >
            전투
          </h3>
        </div>
        
        {/* 진행 인디케이터 */}
        {totalBosses > 0 && (
          <div className="flex items-center gap-1.5">
            {/* 보스별 상태 점 */}
            <div className="flex gap-1">
              {dailyState?.bosses.map((boss, idx) => (
                <div
                  key={boss.bossId}
                  className={`h-2 w-2 rounded-full transition-all ${
                    boss.defeatedAt
                      ? 'bg-green-500'
                      : idx === dailyState.currentBossIndex
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">
              {defeatedCount}/{totalBosses}
            </span>
          </div>
        )}
      </div>

      {/* 전투 사이드바 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <BattleSidebar />
      </div>
    </nav>
  );
}
