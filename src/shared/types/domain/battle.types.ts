/**
 * Battle domain types.
 *
 * @role 보스 전투 시스템 관련 타입 정의
 */

/**
 * 보스 난이도
 */
export type BossDifficulty = 'easy' | 'normal' | 'hard' | 'epic';

/**
 * 보스 정의 (에셋 메타데이터)
 */
export interface Boss {
  id: string;
  name: string;
  image: string;
  difficulty: BossDifficulty;
  defeatQuote: string;
  quotes?: string[];
  defeatQuotes?: string[];
  imagePosition?: string;
  imageScale?: number;
}

/**
 * 전투 미션 (설정에서 영구 등록, Firebase 동기화)
 */
export interface BattleMission {
  id: string;
  text: string;
  damage: number;
  order: number;
  enabled: boolean;
  cooldownMinutes: number;
  tier?: number;
  timeSlots?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 일일 보스 진행 상태
 */
export interface DailyBossProgress {
  bossId: string;
  maxHP: number;
  currentHP: number;
  completedMissions: string[];
  defeatedAt?: string;
}

/**
 * 작업 완료 시간 기반 데미지 규칙
 * - 임계값 정책: 완료 시간이 minimumDuration 이상일 때 damage 적용
 * - 여러 규칙 중 가장 큰 minimumDuration(<= 완료시간)의 damage를 사용
 */
export interface BattleTaskCompletionDamageRule {
  minimumDuration: number;
  damage: number;
}

/**
 * 오늘의 전투 상태 (매일 초기화, Dexie에 저장)
 */
export interface DailyBattleState {
  date: string;
  currentBossIndex: number;
  bosses: DailyBossProgress[];
  totalDefeated: number;
  remainingBosses: Record<BossDifficulty, string[]>;
  defeatedBossIds: string[];
  completedMissionIds: string[];
  missionUsedAt: Record<string, string>;
  processedTaskCompletionIds?: string[];
  overkillDamage?: number;
  sequentialPhase?: number;
}

/**
 * 전투 설정
 */
export interface BattleSettings {
  dailyBossCount?: number;
  bossBaseHP?: number;
  bossDefeatXP?: number;
  missions: BattleMission[];
  defaultMissionDamage: number;
  taskCompletionDamageRules: BattleTaskCompletionDamageRule[];
  bossDifficultyXP: Record<BossDifficulty, number>;
  showBattleInSidebar: boolean;
  showBossImage: boolean;
  battleSoundEffects: boolean;
}

/**
 * 보스 이미지 커스텀 설정 (보스별 위치/스케일)
 */
export interface BossImageSettings {
  [bossId: string]: {
    imagePosition: string;
    imageScale: number;
  };
}

/**
 * 날짜별 보스 처치 통계 (도감 통계용)
 */
export interface DailyBattleStats {
  date: string;
  defeatedCount: number;
  defeatedBossIds: string[];
  byDifficulty: Record<BossDifficulty, number>;
}
