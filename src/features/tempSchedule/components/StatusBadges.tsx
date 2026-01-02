/**
 * 임시 스케줄 상태 배지
 *
 * @role 작업의 상태/의미를 색상 외 시각적으로 표시
 * @responsibilities
 *   - 반복, 즐겨찾기, 아카이브, 소요시간 등 배지 표시
 *   - 색상 외 아이콘+텍스트로 접근성 보장
 *   - 일관된 스타일링
 * @dependencies TempScheduleBadge 타입
 */

import { memo } from 'react';
import { Repeat, Star, Archive, Clock, Flame, Play } from 'lucide-react';
import type { TempScheduleBadge, TempScheduleBadgeType } from '@/shared/types/tempSchedule';

// ============================================================================
// Types
// ============================================================================

export interface StatusBadgeProps {
  /** 배지 정보 */
  badge: TempScheduleBadge;
  /** 텍스트 표시 여부 (기본: true) */
  showLabel?: boolean;
  /** 크기 */
  size?: 'xs' | 'sm' | 'md';
}

export interface StatusBadgesProps {
  /** 배지 배열 */
  badges: TempScheduleBadge[];
  /** 최대 표시 개수 (기본: 3) */
  maxVisible?: number;
  /** 텍스트 표시 여부 */
  showLabels?: boolean;
  /** 크기 */
  size?: 'xs' | 'sm' | 'md';
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const BADGE_ICONS: Record<TempScheduleBadgeType, React.ComponentType<{ size: number; className?: string }>> = {
  recurring: Repeat,
  favorite: Star,
  archived: Archive,
  duration: Clock,
  imminent: Flame,
  inProgress: Play,
};

// ============================================================================
// Single Badge Component
// ============================================================================

/**
 * 단일 상태 배지
 */
const StatusBadgeComponent = memo(function StatusBadge({
  badge,
  showLabel = true,
  size = 'sm',
}: StatusBadgeProps) {
  const IconComponent = BADGE_ICONS[badge.type];
  
  const sizeClasses = {
    xs: 'text-[9px] px-1 py-0.5 gap-0.5',
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
  };

  const iconSizes = {
    xs: 8,
    sm: 10,
    md: 12,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${badge.colorClass}`}
      title={badge.label}
      role="status"
      aria-label={badge.label}
    >
      {IconComponent && <IconComponent size={iconSizes[size]} className="flex-shrink-0" />}
      {showLabel && <span className="truncate">{badge.label}</span>}
    </span>
  );
});

export const StatusBadge = StatusBadgeComponent;

// ============================================================================
// Multiple Badges Component
// ============================================================================

/**
 * 복수 상태 배지 그룹
 * @description 여러 배지를 일관되게 표시
 */
const StatusBadgesComponent = memo(function StatusBadges({
  badges,
  maxVisible = 3,
  showLabels = true,
  size = 'sm',
  className = '',
}: StatusBadgesProps) {
  if (badges.length === 0) return null;

  const visibleBadges = badges.slice(0, maxVisible);
  const hiddenCount = badges.length - maxVisible;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visibleBadges.map((badge, index) => (
        <StatusBadge
          key={`${badge.type}-${index}`}
          badge={badge}
          showLabel={showLabels}
          size={size}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className={`inline-flex items-center rounded-full font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] ${
            size === 'xs' ? 'text-[9px] px-1 py-0.5' : size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
          }`}
          title={`+${hiddenCount}개 더`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
});

export const StatusBadges = StatusBadgesComponent;

// ============================================================================
// Compact Badge (아이콘만)
// ============================================================================

export interface CompactBadgesProps {
  /** 반복 여부 */
  isRecurring?: boolean;
  /** 즐겨찾기 여부 */
  isFavorite?: boolean;
  /** 아카이브 여부 */
  isArchived?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 컴팩트 배지 (아이콘만 표시)
 * @description 좁은 공간에서 사용하는 아이콘 전용 배지
 */
const CompactBadgesComponent = memo(function CompactBadges({
  isRecurring,
  isFavorite,
  isArchived,
  className = '',
}: CompactBadgesProps) {
  const hasAny = isRecurring || isFavorite || isArchived;
  if (!hasAny) return null;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {isFavorite && (
        <Star
          size={10}
          className="text-amber-400 fill-amber-400"
          aria-label="즐겨찾기"
        />
      )}
      {isRecurring && (
        <Repeat
          size={10}
          className="text-purple-400"
          aria-label="반복"
        />
      )}
      {isArchived && (
        <Archive
          size={10}
          className="text-gray-400"
          aria-label="보관됨"
        />
      )}
    </div>
  );
});

export const CompactBadges = CompactBadgesComponent;

// ============================================================================
// Individual Badge Components (Convenience Components)
// ============================================================================

export interface IndividualBadgeProps {
  /** 컴팩트 모드 (아이콘만) */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 반복 배지
 */
export const RecurringBadge = memo(function RecurringBadge({
  compact = false,
  className = '',
}: IndividualBadgeProps) {
  if (compact) {
    return (
      <Repeat
        size={10}
        className={`text-purple-400 ${className}`}
        aria-label="반복"
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 font-medium ${className}`}
      role="status"
      aria-label="반복"
    >
      <Repeat size={10} />
      <span>반복</span>
    </span>
  );
});

/**
 * 즐겨찾기 배지
 */
export const FavoriteBadge = memo(function FavoriteBadge({
  compact = false,
  className = '',
}: IndividualBadgeProps) {
  if (compact) {
    return (
      <Star
        size={10}
        className={`text-amber-400 fill-amber-400 ${className}`}
        aria-label="즐겨찾기"
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 font-medium ${className}`}
      role="status"
      aria-label="즐겨찾기"
    >
      <Star size={10} className="fill-amber-400" />
      <span>즐겨찾기</span>
    </span>
  );
});

/**
 * 아카이브 배지
 */
export const ArchivedBadge = memo(function ArchivedBadge({
  compact = false,
  className = '',
}: IndividualBadgeProps) {
  if (compact) {
    return (
      <Archive
        size={10}
        className={`text-gray-400 ${className}`}
        aria-label="보관됨"
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full text-[9px] px-1.5 py-0.5 bg-gray-500/20 text-gray-400 font-medium ${className}`}
      role="status"
      aria-label="보관됨"
    >
      <Archive size={10} />
      <span>보관됨</span>
    </span>
  );
});

/**
 * 소요시간 배지 Props
 */
export interface DurationBadgeProps extends IndividualBadgeProps {
  /** 소요시간 (분) */
  durationMinutes: number;
}

/**
 * 소요시간 배지
 */
export const DurationBadge = memo(function DurationBadge({
  durationMinutes,
  compact = false,
  className = '',
}: DurationBadgeProps) {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  const label = formatDuration(durationMinutes);

  if (compact) {
    return (
      <Clock
        size={10}
        className={`text-blue-400 ${className}`}
        aria-label={label}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 font-medium ${className}`}
      role="status"
      aria-label={label}
    >
      <Clock size={10} />
      <span>{label}</span>
    </span>
  );
});

export default StatusBadges;
