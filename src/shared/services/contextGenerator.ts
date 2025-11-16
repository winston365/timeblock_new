/**
 * Context Generator - AI 프롬프트용 현재 상황 컨텍스트 생성
 *
 * @role AI와 대화하기, 인사이트 패널 등 모든 AI 기능에서 사용하는
 *       통합 현재 상황 컨텍스트 생성 로직을 제공합니다.
 * @input DailyData, GameState, 과거 데이터, 시간 정보 등
 * @output 마크다운 형식의 현재 상황 컨텍스트 문자열
 * @external_dependencies
 *   - TIME_BLOCKS: 타임블록 정의
 *   - AFFECTION_XP_TARGET: 호감도 목표 XP
 */

import { TIME_BLOCKS } from '@/shared/types/domain';
import { AFFECTION_XP_TARGET } from '@/shared/lib/constants';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import type { DailyData, Task } from '@/shared/types/domain';

export interface CompletedTaskData {
  date: string;
  timeBlock: string;
  tasks: Array<{ text: string; xp: number }>;
}

export interface XPDataPoint {
  date: string;
  totalXP: number;
  dailyXP: number;
}

/**
 * 과거 10일간 완료한 작업 데이터 수집
 */
export async function collectCompletedTasksData(): Promise<CompletedTaskData[]> {
  const recentDays = await getRecentDailyData(10);

  const result: CompletedTaskData[] = [];

  for (const day of recentDays) {
    const completedTasks = day.tasks.filter(t => t.completed);

    // 시간대별로 그룹화
    for (const block of TIME_BLOCKS) {
      const blockTasks = completedTasks
        .filter(t => t.timeBlock === block.id)
        .map(t => ({
          text: t.text,
          xp: calculateTaskXP(t),
        }));

      if (blockTasks.length > 0) {
        result.push({
          date: day.date,
          timeBlock: block.label,
          tasks: blockTasks,
        });
      }
    }
  }

  return result;
}

/**
 * 간단한 XP 계산 (resistance 고려)
 */
function calculateTaskXP(task: Task): number {
  const multipliers: Record<string, number> = { low: 1.0, medium: 1.3, high: 1.6 };
  const baseXP = Math.ceil((task.baseDuration / 30) * 25);
  const resistance = task.resistance as keyof typeof multipliers;
  return Math.ceil(baseXP * (multipliers[resistance] ?? 1.0));
}

/**
 * 과거 10일간 XP 데이터 수집
 */
export async function collectXPData(gameState: any): Promise<XPDataPoint[]> {
  if (!gameState || !gameState.xpHistory) {
    return [];
  }

  return gameState.xpHistory.slice(-10).map((entry: any) => ({
    date: entry.date,
    totalXP: entry.totalXP,
    dailyXP: entry.dailyXP,
  }));
}

interface CurrentSituationData {
  // 과거 데이터
  completedTasksData: CompletedTaskData[];
  xpData: XPDataPoint[];

  // 오늘 데이터
  todayData: DailyData | null;

  // 현재 시간 정보
  currentTime: string;
  currentBlock: string;
  currentBlockId: string | null;
  minutesLeftInBlock: number;

  // 작업 정보
  inboxTasks: Task[];

  // 상태 정보
  currentEnergy: number;
  availableXP: number;
  dailyXP: number;
}

/**
 * 통합 현재 상황 컨텍스트 생성
 * - AI와 대화하기, 인사이트 패널 등 모든 AI 기능에서 공통으로 사용
 * - 가장 다양하고 많은 정보 포함
 *
 * @param data 현재 상황 데이터
 * @returns 마크다운 형식의 현재 상황 컨텍스트
 */
export function generateCurrentSituationContext(data: CurrentSituationData): string {
  const {
    completedTasksData,
    xpData,
    todayData,
    currentTime,
    currentBlock,
    currentBlockId,
    inboxTasks,
    currentEnergy,
    availableXP,
    dailyXP,
    minutesLeftInBlock,
  } = data;

  // 현재 타임블럭 미완료 작업
  const currentBlockTasks = todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlockId) ?? [];
  const completedToday = todayData?.tasks.filter(t => t.completed) ?? [];
  const remainingToday = todayData?.tasks.filter(t => !t.completed && t.timeBlock) ?? [];

  return `
## 📊 현재 상황 (통합 데이터)

### 🕐 시간 정보
- **현재 시간**: ${currentTime}
- **현재 블록**: ${currentBlock}
- **블록 남은 시간**: ${Math.floor(minutesLeftInBlock / 60)}시간 ${minutesLeftInBlock % 60}분
- **현재 에너지**: ${currentEnergy}

### 📈 XP 및 호감도
- **보유 XP**: ${availableXP} / ${AFFECTION_XP_TARGET} (호감도 ${Math.min(Math.round((availableXP / AFFECTION_XP_TARGET) * 100), 100)}%)
- **오늘 획득 XP**: ${dailyXP}

### ✅ 오늘 진행 상황
- **완료한 작업**: ${completedToday.length}개
- **남은 작업**: ${remainingToday.length}개
- **인박스 작업**: ${inboxTasks.length}개

${completedToday.length > 0 ? `
#### 오늘 완료한 작업
${TIME_BLOCKS.map(block => {
  const blockTasks = completedToday.filter(t => t.timeBlock === block.id);
  if (blockTasks.length === 0) return '';
  return `- ${block.label}: ${blockTasks.map(t => t.text).join(', ')}`;
}).filter(Boolean).join('\n')}
` : ''}

### 📋 현재 타임블록 미완료 작업
${currentBlockTasks.length > 0 ? currentBlockTasks.map(t =>
  `- ${t.text} (${t.baseDuration}분, ${t.resistance === 'low' ? '쉬움' : t.resistance === 'medium' ? '보통' : '어려움'})`
).join('\n') : '현재 블록에 미완료 작업 없음'}

### 📥 인박스 작업 (계획 필요)
${inboxTasks.length > 0 ? inboxTasks.map(t =>
  `- ${t.text} (${t.baseDuration}분, ${t.resistance === 'low' ? '쉬움' : t.resistance === 'medium' ? '보통' : '어려움'})`
).join('\n') : '인박스 작업 없음'}

### 📊 과거 10일 완료 작업 패턴
${completedTasksData.length > 0 ? completedTasksData.slice(-20).map(d =>
  `- ${d.date} ${d.timeBlock}: ${d.tasks.length}개 완료 (총 ${d.tasks.reduce((sum, t) => sum + t.xp, 0)} XP)`
).join('\n') : '아직 데이터 없음'}

### 📈 과거 10일 XP 획득 추이
${xpData.length > 0 ? xpData.map(d =>
  `- ${d.date}: ${d.dailyXP} XP`
).join('\n') : '아직 데이터 없음'}
`;
}
