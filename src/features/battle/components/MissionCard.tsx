/**
 * MissionCard - 미션 카드 컴포넌트
 *
 * @role 개별 미션 표시 및 완료 버튼
 * @input mission 정보, 완료 상태
 * @output 클릭 가능한 미션 카드 UI
 */

import type { BattleMission } from '@/shared/types/domain';

interface MissionCardProps {
  mission: BattleMission;
  /** 이미 완료된 미션인지 */
  completed?: boolean;
  /** 미션 완료 클릭 핸들러 */
  onComplete?: (missionId: string) => void;
  /** 비활성화 (보스 처치됨 등) */
  disabled?: boolean;
}

export function MissionCard({
  mission,
  completed = false,
  onComplete,
  disabled = false,
}: MissionCardProps) {
  const handleClick = () => {
    if (!completed && !disabled && onComplete) {
      onComplete(mission.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || completed}
      className={`group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all duration-200 ${
        completed
          ? 'border-green-500/30 bg-green-500/10 opacity-60'
          : disabled
          ? 'cursor-not-allowed border-gray-500/30 bg-gray-500/10 opacity-40'
          : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)] hover:shadow-md active:scale-[0.98]'
      }`}
    >
      {/* 완료 체크마크 오버레이 */}
      {completed && (
        <div className="absolute right-2 top-2 text-green-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* 미션 내용 */}
      <div className="flex items-start gap-3">
        {/* 공격 아이콘 */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
            completed
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400 group-hover:bg-red-500/30'
          }`}
        >
          <span className="text-lg">{completed ? '✓' : '⚔️'}</span>
        </div>

        {/* 텍스트 */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              completed
                ? 'text-gray-500 line-through'
                : 'text-[var(--color-text)] group-hover:text-[var(--color-accent)]'
            }`}
          >
            {mission.text}
          </p>

          {/* 데미지 표시 */}
          <div className="mt-1 flex items-center gap-1 text-xs">
            <span className="text-red-400">💥</span>
            <span className={`font-mono font-bold ${completed ? 'text-gray-500' : 'text-red-400'}`}>
              -{mission.damage} HP
            </span>
          </div>
        </div>
      </div>

      {/* 호버 시 "공격!" 표시 */}
      {!completed && !disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-accent)]/90 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="text-lg font-bold text-white drop-shadow-lg">⚔️ 공격!</span>
        </div>
      )}
    </button>
  );
}

/**
 * 미션 리스트 (빈 상태 포함)
 */
interface MissionListProps {
  missions: BattleMission[];
  completedMissionIds: string[];
  onCompleteMission: (missionId: string) => void;
  disabled?: boolean;
}

export function MissionList({
  missions,
  completedMissionIds,
  onCompleteMission,
  disabled = false,
}: MissionListProps) {
  if (missions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 text-center">
        <div className="text-2xl mb-2">📋</div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          등록된 미션이 없습니다
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          설정에서 미션을 추가해보세요
        </p>
      </div>
    );
  }

  // 활성화된 미션만 필터링
  const activeMissions = missions.filter(m => m.enabled).sort((a, b) => a.order - b.order);

  if (activeMissions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 text-center">
        <div className="text-2xl mb-2">🔇</div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          모든 미션이 비활성화되어 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeMissions.map(mission => (
        <MissionCard
          key={mission.id}
          mission={mission}
          completed={completedMissionIds.includes(mission.id)}
          onComplete={onCompleteMission}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
