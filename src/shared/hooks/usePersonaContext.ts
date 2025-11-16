/**
 * usePersonaContext - PersonaContext 생성 커스텀 훅
 *
 * @deprecated 성능 최적화를 위해 일반 함수 buildPersonaContext()로 대체됨
 * @see {@link buildPersonaContext} in @/shared/lib/personaUtils
 *
 * @role PersonaContext 데이터 수집 및 가공 로직을 중앙화하여 코드 중복 제거
 * @input 없음 (내부적으로 useDailyData, useGameState, useWaifuState, useEnergyState 사용)
 * @output PersonaContext 객체
 * @external_dependencies
 *   - useDailyData, useGameState, useWaifuState, useEnergyState: 상태 훅
 *   - getRecentDailyData: 최근 5일 데이터 로드
 *   - TIME_BLOCKS: 시간대 블록 상수
 *
 * @performance_issue
 *   ⚠️ 이 훅은 dailyData, gameState, waifuState, currentEnergy 변경 시마다 재실행되어,
 *   에너지 슬라이더 움직일 때마다 10일치 DB 조회와 패턴 분석을 수행합니다.
 *
 *   대신 buildPersonaContext() 함수를 사용하세요:
 *   - AI 채팅/인사이트 생성 시점에만 호출
 *   - 불필요한 재연산과 DB 조회 제거
 */

import { useEffect, useState } from 'react';
import { useDailyData, useGameState, useWaifuState, useEnergyState } from '@/shared/hooks';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { PersonaContext } from '@/shared/services/geminiApi';
import type { Task, TimeBlockState } from '@/shared/types/domain';

/**
 * PersonaContext 생성 커스텀 훅
 *
 * @returns {PersonaContext | null} PersonaContext 객체 (로딩 중이면 null)
 * @throws 없음
 * @sideEffects
 *   - 최근 5일 데이터 로드 (getRecentDailyData 호출)
 *
 * @example
 * ```tsx
 * const personaContext = usePersonaContext();
 * if (!personaContext) return <div>Loading...</div>;
 * const systemPrompt = generateWaifuPersona(personaContext);
 * ```
 */
export function usePersonaContext(): PersonaContext | null {
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { waifuState } = useWaifuState();
  const { currentEnergy } = useEnergyState();

  const [personaContext, setPersonaContext] = useState<PersonaContext | null>(null);

  useEffect(() => {
    const buildPersonaContext = async () => {
      try {
        // 작업 정보 계산
        const tasks: Task[] = dailyData?.tasks ?? [];
        const completedTasks = tasks.filter((t: Task) => t.completed);
        const inboxTasks = tasks.filter((t: Task) => !t.timeBlock && !t.completed);

        // 현재 시간 정보
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const msLeftToday = endOfDay.getTime() - now.getTime();
        const hoursLeftToday = Math.floor(msLeftToday / (1000 * 60 * 60));
        const minutesLeftToday = Math.floor((msLeftToday % (1000 * 60 * 60)) / (1000 * 60));

        // 현재 시간대 블록 찾기
        const currentBlock = TIME_BLOCKS.find(block => currentHour >= block.start && currentHour < block.end);
        const currentBlockId = currentBlock?.id ?? null;
        const currentBlockLabel = currentBlock?.label ?? '블록 외 시간';
        const currentBlockTasks = currentBlockId
          ? tasks.filter((t: Task) => t.timeBlock === currentBlockId).map((t: Task) => ({ text: t.text, completed: t.completed }))
          : [];

        // 잠금 블록 수 계산
        const timeBlockStates: Record<string, TimeBlockState> = dailyData?.timeBlockStates ?? {};
        const lockedBlocksCount = Object.values(timeBlockStates).filter((s: TimeBlockState) => s.isLocked).length;
        const totalBlocksCount = TIME_BLOCKS.length;

        // 최근 10일 데이터 로드 (더 풍부한 패턴 분석)
        const recentDays = await getRecentDailyData(10);

        // 최근 10일 시간대별 패턴 분석
        const recentBlockPatterns = TIME_BLOCKS.reduce((acc, block) => {
          acc[block.id] = recentDays.map(day => {
            const blockTasks = day.tasks.filter(t => t.timeBlock === block.id && t.completed);
            return {
              date: day.date,
              completedCount: blockTasks.length,
              tasks: blockTasks.map(t => t.text)
            };
          });
          return acc;
        }, {} as Record<string, Array<{ date: string; completedCount: number; tasks: string[] }>>);

        // 기분 계산 (호감도 기반)
        const affection = waifuState?.affection ?? 50;
        let mood = '중립적';
        if (affection < 20) mood = '냉담함';
        else if (affection < 40) mood = '약간 경계';
        else if (affection < 60) mood = '따뜻함';
        else if (affection < 80) mood = '다정함';
        else mood = '매우 애정 어림';

        // PersonaContext 생성
        const context: PersonaContext = {
          // 기본 정보
          affection,
          level: gameState?.level ?? 1,
          totalXP: gameState?.totalXP ?? 0,
          dailyXP: gameState?.dailyXP ?? 0,
          availableXP: gameState?.availableXP ?? 0,

          // 작업 정보
          tasksCompleted: completedTasks.length,
          totalTasks: tasks.length,
          inboxTasks: inboxTasks.map((t: Task) => ({
            text: t.text,
            resistance: t.resistance,
            baseDuration: t.baseDuration
          })),
          recentTasks: tasks.slice(-5).map((t: Task) => ({
            text: t.text,
            completed: t.completed,
            resistance: t.resistance
          })),

          // 시간 정보
          currentHour,
          currentMinute,
          hoursLeftToday,
          minutesLeftToday,

          // 타임블록 정보
          currentBlockId,
          currentBlockLabel,
          currentBlockTasks,
          lockedBlocksCount,
          totalBlocksCount,

          // 에너지 정보
          currentEnergy: currentEnergy ?? 0,
          energyRecordedAt: null,

          // XP 히스토리
          xpHistory: gameState?.xpHistory ?? [],

          // 타임블록 XP 히스토리
          timeBlockXPHistory: gameState?.timeBlockXPHistory ?? [],

          // 최근 5일 패턴
          recentBlockPatterns,

          // 기분
          mood,
        };

        setPersonaContext(context);
      } catch (error) {
        console.error('Failed to build PersonaContext:', error);
        setPersonaContext(null);
      }
    };

    buildPersonaContext();
  }, [dailyData, gameState, waifuState, currentEnergy]);

  return personaContext;
}
