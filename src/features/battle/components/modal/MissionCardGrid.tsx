/**
 * MissionCardGrid - 미션 카드 그리드 컴포넌트
 *
 * @role MissionModal 오른쪽의 미션 카드 그리드 영역
 * @description
 *   - 추천 미션 섹션 (상단 고정, 데미지 효율 상위 3개)
 *   - 미션 카드 그리드 레이아웃
 *   - 빈 상태 처리
 *   - 헤더 (사용 가능 미션 수)
 */

import { useMemo } from 'react';
import type { BattleMission } from '@/shared/types/domain';
import { BattleMissionCard } from './BattleMissionCard';
import { getMissionCooldownRemaining, isMissionAvailable } from '../../stores/battleStore';

/** 추천 미션 최대 개수 */
const RECOMMENDED_MISSIONS_COUNT = 3;

interface MissionCardGridProps {
  /** 표시할 미션 목록 */
  missions: BattleMission[];
  /** 완료된 미션 ID 목록 */
  completedMissionIds: string[];
  /** 미션별 사용 시각 맵 */
  missionUsedAt: Record<string, string>;
  /** 사용 가능한 미션 수 */
  availableMissionsCount: number;
  /** 미션 완료 핸들러 */
  onCompleteMission: (missionId: string) => void;
  /** 스케줄에 추가 핸들러 */
  onAddMissionToSchedule: (mission: BattleMission) => void;
  /** 보스 없음 등으로 비활성화 */
  disabled: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 현재 보스 HP */
  currentBossHp?: number;
}

/**
 * 미션 카드 그리드 컴포넌트
 */
export function MissionCardGrid({
  missions,
  completedMissionIds,
  missionUsedAt,
  availableMissionsCount,
  onCompleteMission,
  onAddMissionToSchedule,
  disabled,
  onClose,
  currentBossHp,
}: MissionCardGridProps) {
  // 추천 미션 계산 (사용 가능 + 데미지 높은 순 상위 3개)
  const { recommendedMissions, otherMissions, recommendedIds } = useMemo(() => {
    // 사용 가능한 미션만 필터링
    const availableMissions = missions.filter((m) =>
      isMissionAvailable(m, completedMissionIds, missionUsedAt)
    );

    // 데미지 높은 순 정렬 후 상위 N개 선택
    const sorted = [...availableMissions].sort((a, b) => b.damage - a.damage);
    const recommended = sorted.slice(0, RECOMMENDED_MISSIONS_COUNT);
    const recommendedIdSet = new Set(recommended.map((m) => m.id));

    // 나머지 미션 (추천에 포함되지 않은 것들)
    const others = missions.filter((m) => !recommendedIdSet.has(m.id));

    return {
      recommendedMissions: recommended,
      otherMissions: others,
      recommendedIds: recommendedIdSet,
    };
  }, [missions, completedMissionIds, missionUsedAt]);

  const renderMissionCard = (mission: BattleMission, index: number, isRecommended: boolean = false) => {
    const cooldownRemaining = getMissionCooldownRemaining(mission, missionUsedAt);
    const isOnCooldown = cooldownRemaining > 0;
    const isUsed =
      cooldownRemaining === -1 && completedMissionIds.includes(mission.id);

    return (
      <BattleMissionCard
        key={mission.id}
        mission={mission}
        isUsed={isUsed}
        isOnCooldown={isOnCooldown}
        cooldownRemaining={cooldownRemaining}
        onComplete={onCompleteMission}
        onAddToSchedule={onAddMissionToSchedule}
        disabled={disabled}
        index={index}
        currentBossHp={currentBossHp}
        isRecommended={isRecommended}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 bg-slate-900/80 rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col">
      {/* 미션 헤더 */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <span className="font-bold text-white">미션 카드</span>
          <span className="text-xs text-gray-400 ml-2">
            사용 가능:{' '}
            <span className="text-red-400 font-bold">
              {availableMissionsCount}
            </span>
            /{missions.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition text-xl"
        >
          ✕
        </button>
      </div>

      {/* 미션 그리드 */}
      <div className="flex-1 overflow-y-auto p-5">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-5xl opacity-50">📋</span>
            <p className="text-gray-400">등록된 미션이 없습니다</p>
            <p className="text-xs text-gray-500">
              설정 → 전투에서 미션을 추가하세요
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 추천 미션 섹션 */}
            {recommendedMissions.length > 0 && !disabled && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-400">⭐</span>
                  <span className="text-sm font-bold text-amber-300">추천 미션</span>
                  <span className="text-[10px] text-amber-400/60">데미지 효율 TOP {recommendedMissions.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {recommendedMissions.map((mission, index) =>
                    renderMissionCard(mission, index, true)
                  )}
                </div>
              </div>
            )}

            {/* 전체 미션 섹션 */}
            {otherMissions.length > 0 && (
              <div>
                {recommendedMissions.length > 0 && !disabled && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-slate-400">📋</span>
                    <span className="text-sm font-bold text-slate-300">전체 미션</span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {otherMissions.map((mission, index) =>
                    renderMissionCard(mission, index + recommendedMissions.length, recommendedIds.has(mission.id))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="shrink-0 px-5 py-3 border-t border-slate-700/50 bg-slate-800/50">
        <p className="text-[10px] text-gray-500 text-center">
          💡 ⏱️ = 쿨다운 중 • ✅ = 오늘 완료 • ⭐ = 추천 미션 • ESC로 닫기
        </p>
      </div>
    </div>
  );
}
