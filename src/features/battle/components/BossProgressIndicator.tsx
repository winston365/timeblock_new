/**
 * BossProgressIndicator - 보스 진행 인디케이터
 *
 * @role 오늘의 보스 진행 상황 표시 (n/n 처치)
 * @input 일일 전투 상태
 * @output 미니 진행 표시 UI
 */

import type { DailyBossProgress } from '@/shared/types/domain';

interface BossProgressIndicatorProps {
  bosses: DailyBossProgress[];
  currentIndex: number;
}

export function BossProgressIndicator({ bosses, currentIndex }: BossProgressIndicatorProps) {
  if (bosses.length <= 1) return null;

  const defeatedCount = bosses.filter(b => b.defeatedAt).length;

  return (
    <div className="flex items-center justify-center gap-2">
      {/* 개별 보스 인디케이터 */}
      <div className="flex gap-1">
        {bosses.map((boss, index) => (
          <div
            key={boss.bossId}
            className={`h-2 w-6 rounded-full transition-all duration-300 ${
              boss.defeatedAt
                ? 'bg-green-500'
                : index === currentIndex
                ? 'animate-pulse bg-red-500'
                : 'bg-gray-600'
            }`}
            title={boss.defeatedAt ? '처치 완료' : index === currentIndex ? '현재 보스' : '대기 중'}
          />
        ))}
      </div>

      {/* 텍스트 표시 */}
      <span className="ml-2 text-xs font-medium text-[var(--color-text-secondary)]">
        {defeatedCount}/{bosses.length} 처치
      </span>
    </div>
  );
}
