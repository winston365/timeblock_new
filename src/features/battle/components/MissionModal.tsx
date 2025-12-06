/**
 * @file MissionModal.tsx
 * @role 전투 미션 선택 모달 - 배틀 스타일 UI
 * @description
 *   - 긴장감 있는 배틀 UI
 *   - 20개 이상 미션 지원
 *   - 카드 게임 스타일
 *   - 쿨다운 타이머
 *   - 시간대별 미션 필터링
 * @dependencies useBattleStore, battleSoundService, 분리된 하위 컴포넌트들
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  useBattleStore,
  getBossById,
  isMissionAvailable,
} from '../stores/battleStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useDailyData, useModalEscapeClose, useNamedTimeouts } from '@/shared/hooks';
import { playAttackSound, playBossDefeatSound } from '../services/battleSoundService';
import type { BattleMission, BossDifficulty } from '@/shared/types/domain';
import { createNewTask } from '@/shared/utils/taskFactory';
import { getBlockIdFromHour } from '@/shared/utils/timeBlockUtils';

// 분리된 컴포넌트 import
import { BossPanel, MissionCardGrid } from './modal';

// 상수 import
import {
  DAMAGE_DISPLAY_DURATION_MS,
  BOSS_DEFEAT_SOUND_DELAY_MS,
  COOLDOWN_REFRESH_INTERVAL_MS,
  shouldShowMissionByTime,
} from '../constants/battleConstants';

interface MissionModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 전투 미션 선택 모달 - 배틀 스타일
 */
export function MissionModal({ open, onClose }: MissionModalProps) {
  const {
    missions,
    settings,
    dailyState,
    completeMission,
    spawnBossByDifficulty,
    getCurrentBoss,
    getRemainingBossCount,
    getTotalRemainingBossCount,
  } = useBattleStore();

  const addXP = useGameStateStore((state) => state.addXP);
  const { addTask: addDailyTask, refresh, dailyData } = useDailyData();
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [, forceUpdate] = useState(0); // 타이머 갱신용

  // 타이머 관리 (useNamedTimeouts 훅 사용으로 중복 제거)
  const timers = useNamedTimeouts();

  // 쿨다운 타이머 갱신 (1분마다)
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, COOLDOWN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open]);

  // 미션 사용 시각 맵 (useMemo로 래핑하여 매 렌더마다 새 객체 생성 방지)
  const missionUsedAt = useMemo(
    () => dailyState?.missionUsedAt ?? {},
    [dailyState?.missionUsedAt],
  );

  // 미션 정렬 함수
  const sortMissions = useCallback((list: BattleMission[]) => {
    // 1순위: 데미지 낮은 순, 2순위: order
    return [...list].sort((a, b) => {
      if (a.damage === b.damage) return a.order - b.order;
      return a.damage - b.damage;
    });
  }, []);

  // 사용된 미션 ID 세트 (하루 1회 제한용)
  const completedMissionIds = useMemo(
    () => dailyState?.completedMissionIds ?? [],
    [dailyState?.completedMissionIds],
  );

  // 활성 미션 (시간대 필터링 + 사용 가능한 것 앞으로)
  const enabledMissionsList = useMemo(() => {
    const now = new Date();

    // 1. 활성화된 미션만
    // 2. 현재 시간대에 표시되어야 하는 미션만
    const enabled = missions.filter(
      (m) => m.enabled && shouldShowMissionByTime(m.timeSlots, now),
    );

    // 사용 가능 여부로 분리
    const available = sortMissions(
      enabled.filter((m) =>
        isMissionAvailable(m, completedMissionIds, missionUsedAt),
      ),
    );
    const unavailable = sortMissions(
      enabled.filter(
        (m) => !isMissionAvailable(m, completedMissionIds, missionUsedAt),
      ),
    );

    return [...available, ...unavailable];
  }, [missions, completedMissionIds, missionUsedAt, sortMissions]);

  // 사용 가능한 미션 수
  const availableMissionsCount = useMemo(
    () =>
      enabledMissionsList.filter((m) =>
        isMissionAvailable(m, completedMissionIds, missionUsedAt),
      ).length,
    [enabledMissionsList, completedMissionIds, missionUsedAt],
  );

  // 현재 보스
  const currentBossProgress = dailyState ? getCurrentBoss() : null;
  const currentBoss = useMemo(
    () => (currentBossProgress ? getBossById(currentBossProgress.bossId) : null),
    [currentBossProgress],
  );
  const isCurrentBossDefeated = currentBossProgress?.defeatedAt !== undefined;

  // 남은 보스 수
  const remainingCounts = useMemo(
    () => ({
      easy: getRemainingBossCount('easy'),
      normal: getRemainingBossCount('normal'),
      hard: getRemainingBossCount('hard'),
      epic: getRemainingBossCount('epic'),
    }),
    [getRemainingBossCount],
  );

  const totalRemaining = getTotalRemainingBossCount();

  useModalEscapeClose(open, onClose);

  // 미션 완료 핸들러
  const handleCompleteMission = useCallback(
    async (missionId: string) => {
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return;

      // 효과음 재생
      if (settings.battleSoundEffects) {
        playAttackSound();
      }

      // 데미지 표시
      setLastDamage(mission.damage);
      timers.set('damage', () => setLastDamage(null), DAMAGE_DISPLAY_DURATION_MS);

      const result = await completeMission(missionId);

      // 보스 처치 시
      if (result.bossDefeated) {
        if (settings.battleSoundEffects) {
          timers.set('sound', () => playBossDefeatSound(), BOSS_DEFEAT_SOUND_DELAY_MS);
        }
        toast.success(`🎉 보스 처치! +${result.xpEarned} XP`, { duration: 2500 });
      }

      // XP 보상 지급
      if (result.xpEarned > 0) {
        addXP(result.xpEarned, 'boss_defeat');
      }
    },
    [completeMission, addXP, missions, settings.battleSoundEffects, timers],
  );

  // 현재 시간대(hour bar)에 추가 핸들러
  const handleAddMissionToSchedule = useCallback(
    async (mission: BattleMission) => {
      const now = new Date();
      const currentHour = now.getHours();
      const blockId = getBlockIdFromHour(currentHour);

      if (!blockId) {
        toast.error('현재 시간대에 배치할 타임블록이 없어요.');
        return;
      }

      const task = createNewTask(`미션 ${mission.text}`, {
        baseDuration: 15,
        timeBlock: blockId,
        hourSlot: currentHour,
      });

      const tryAdd = async () => {
        await addDailyTask(task);
        toast.success(`${currentHour}:00 시간대에 미션을 추가했어요 (15분)`, {
          duration: 1800,
        });
      };

      try {
        if (!dailyData) {
          await refresh();
        }
        await tryAdd();
      } catch (error) {
        console.error('Failed to add mission task to schedule:', error);
        toast.error('현재 시간대에 추가하지 못했어요');
      }
    },
    [addDailyTask, dailyData, refresh],
  );

  // 난이도 선택 핸들러
  const handleSelectDifficulty = useCallback(
    async (difficulty: BossDifficulty) => {
      await spawnBossByDifficulty(difficulty);
      toast.success(`${difficulty.toUpperCase()} 보스 등장!`, { duration: 1500 });
    },
    [spawnBossByDifficulty],
  );

  if (!open) return null;

  const noBoss = !currentBoss || isCurrentBossDefeated;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      {/* 배경 오버레이 - 배틀 분위기 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-red-950/30 to-black/90 backdrop-blur-md" />

      {/* 메인 컨테이너 - 좌우 배치 */}
      <div className="relative w-full max-w-6xl mx-6 max-h-[92vh] flex gap-6">
        {/* 왼쪽 - 보스 영역 */}
        <div className="shrink-0 w-64 flex flex-col">
          <BossPanel
            currentBoss={currentBoss}
            currentBossProgress={currentBossProgress}
            isCurrentBossDefeated={isCurrentBossDefeated}
            dailyState={dailyState}
            lastDamage={lastDamage}
            remainingCounts={remainingCounts}
            totalRemaining={totalRemaining}
            onSelectDifficulty={handleSelectDifficulty}
          />
        </div>

        {/* 오른쪽 - 미션 카드 영역 */}
        <MissionCardGrid
          missions={enabledMissionsList}
          completedMissionIds={completedMissionIds}
          missionUsedAt={missionUsedAt}
          availableMissionsCount={availableMissionsCount}
          onCompleteMission={handleCompleteMission}
          onAddMissionToSchedule={handleAddMissionToSchedule}
          disabled={noBoss}
          onClose={onClose}
          currentBossHp={currentBossProgress?.currentHP}
        />
      </div>
    </div>
  );
}
