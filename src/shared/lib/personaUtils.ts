/**
 * personaUtils - PersonaContext 빌드 유틸리티
 *
 * @role PersonaContext 생성 로직을 유틸리티 함수로 제공 (훅 제거로 불필요한 재연산 방지)
 * @input DailyData, GameState, WaifuState, currentEnergy
 * @output PersonaContext 객체
 * @external_dependencies
  dailyData: DailyData | null;
  gameState: GameState | null;
  waifuState: WaifuState | null;
  currentEnergy: number;
}

/**
 * PersonaContext 객체를 생성합니다.
 *
 * 기존 usePersonaContext 훅을 일반 함수로 변경하여 성능 최적화:
 * - 상태 변경 시마다 재실행되는 문제 해결
 * - DB 조회(getRecentDailyData)를 필요한 시점에만 수행
 * - AI 채팅/인사이트 생성 시점에만 호출
 *
 * @param {BuildPersonaContextParams} params - dailyData, gameState, waifuState, currentEnergy
 * @returns {Promise<PersonaContext>} PersonaContext 객체
 * @throws {Error} PersonaContext 빌드 실패 시
 * @sideEffects
 *   - getRecentDailyData(10) 호출 (DB 조회)
 *
 * @example
 * ```tsx
 * const personaContext = await buildPersonaContext({
 *   dailyData,
 *   gameState,
 *   waifuState,

/**
 * PersonaContext 객체를 생성합니다.
 *
 * 기존 usePersonaContext 훅을 일반 함수로 변경하여 성능 최적화:
 * - 상태 변경 시마다 재실행되는 문제 해결
 * - DB 조회(getRecentDailyData)를 필요한 시점에만 수행
 * - AI 채팅/인사이트 생성 시점에만 호출
 *
 * @param {BuildPersonaContextParams} params - dailyData, gameState, waifuState, currentEnergy
 * @returns {Promise<PersonaContext>} PersonaContext 객체
 * @throws {Error} PersonaContext 빌드 실패 시
 * @sideEffects
 *   - getRecentDailyData(10) 호출 (DB 조회)
 *
 * @example
 * ```tsx
 * const personaContext = await buildPersonaContext({
 *   dailyData,
 *   gameState,
 *   waifuState,
 *   currentEnergy
 * });
 * const systemPrompt = generateWaifuPersona(personaContext);
 * ```
 */
import { loadInboxTasks } from '@/data/repositories/inboxRepository';
import type { PersonaContext } from '@/shared/services/ai/geminiApi';
import type { DailyData, GameState, Task, TimeBlockState, WaifuState } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { db } from '@/data/db/dexieClient';

export interface BuildPersonaContextParams {
  dailyData: DailyData | null;
  gameState: GameState | null;
  waifuState: WaifuState | null;
  currentEnergy: number;
}

export async function buildPersonaContext(
  params: BuildPersonaContextParams
): Promise<PersonaContext> {
  const { dailyData, gameState, waifuState, currentEnergy } = params;

  // 작업 정보 계산
  const tasks: Task[] = dailyData?.tasks ?? [];
  const completedTasks = tasks.filter((t: Task) => t.completed);

  // ✅ 실제 Global Inbox에서 데이터 가져오기 (UI와 동일한 데이터 소스)
  const inboxTasksRaw = await loadInboxTasks();
  const inboxTasks = inboxTasksRaw
    // timeBlock이 null 또는 누락(undefined)인 미완료 항목만 포함해 UI와 동일하게 집계
    .filter((t: Task) => !t.completed && (t.timeBlock === null || t.timeBlock === undefined))
    .map((t: Task) => ({
      text: t.text,
      resistance: t.resistance,
      baseDuration: t.baseDuration,
      memo: t.memo || ''
    }));

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

  // ✅ 오늘의 모든 블록별 상세 할일 정보 수집 (시간대바별 구분)
  const allBlockTasks: Record<string, any[]> = {};
  TIME_BLOCKS.forEach(block => {
    const blockTasks = tasks.filter((t: Task) => t.timeBlock === block.id);
    allBlockTasks[block.id] = blockTasks.map((t: Task) => ({
      text: t.text,
      memo: t.memo || '',
      resistance: t.resistance,
      baseDuration: t.baseDuration,
      adjustedDuration: t.adjustedDuration,
      hourSlot: t.hourSlot,
      completed: t.completed,
      actualDuration: t.actualDuration || 0,
      preparation1: t.preparation1,
      preparation2: t.preparation2,
      preparation3: t.preparation3,
      timerUsed: t.timerUsed,
      completedAt: t.completedAt,
    }));
  });

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

  // 최근 10일 모든 작업(인박스/타임블록, 완료/미완료) 상세 로그
  const tenDayDates = new Set(recentDays.map(day => day.date));

  // dailyData 기준 작업 묶음
  const tasksByDate: Record<string, Task[]> = {};
  recentDays.forEach(day => {
    tasksByDate[day.date] = Array.isArray(day.tasks) ? day.tasks : [];
  });

  // completedInbox에서 완료일자 기준으로 편입 (10일 범위 내)
  const completedInboxTasks = await db.completedInbox.toArray();
  completedInboxTasks.forEach(task => {
    const date = task.completedAt ? task.completedAt.slice(0, 10) : null;
    if (date && tenDayDates.has(date)) {
      if (!tasksByDate[date]) tasksByDate[date] = [];
      tasksByDate[date].push(task);
    }
  });

  const recentTaskLog = Array.from(tenDayDates)
    .sort()
    .map(date => ({
      date,
      tasks: (tasksByDate[date] || []).map((t: Task) => ({
        text: t.text,
        completed: t.completed,
        timeBlock: t.timeBlock ?? null,
        memo: t.memo || '',
      }))
    }));

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
    inboxTasks, // ✅ 실제 Global Inbox 데이터 사용
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

    // ✅ 오늘의 모든 블록별 상세 할일 정보
    allBlockTasks,

    // 에너지 정보
    currentEnergy: currentEnergy ?? 0,
    energyRecordedAt: null,

    // XP 히스토리
    xpHistory: gameState?.xpHistory ?? [],

    // 타임블록 XP 히스토리
    timeBlockXPHistory: gameState?.timeBlockXPHistory ?? [],

    // 최근 10일 패턴
    recentBlockPatterns,

    // 최근 10일 작업 상세 로그 (인박스/타임블록, 완료/미완료)
    recentTaskLog,

    // 기분
    mood,
  };

  return context;
}
