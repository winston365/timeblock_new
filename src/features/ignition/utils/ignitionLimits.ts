/**
 * @file ignitionLimits.ts
 * @role 점화 사용 가능 여부 확인 및 제한 로직 유틸리티
 * @input GameState, 점화 설정값
 * @output 점화 가능 여부, 쿨다운 상태, XP 요구사항
 * @dependencies GameState 타입, SETTING_DEFAULTS, IGNITION_DEFAULTS
 */

import type { GameState } from '@/shared/types/domain';
import { SETTING_DEFAULTS, IGNITION_DEFAULTS } from '@/shared/constants/defaults';

export interface IgnitionCheckResult {
    canIgnite: boolean;
    reason?: 'cooldown' | 'no_free_spins' | 'insufficient_xp';
    cooldownRemaining?: number; // 초
    freeSpinsRemaining?: number;
    requiresXP?: number;
}

export interface IgnitionConfig {
    cooldownMinutes?: number;
    xpCost?: number;
}

/**
 * 점화 사용 가능 여부 확인
 *
 * @param gameState - 현재 게임 상태
 * @param isBonus - 비활동 보너스 여부 (true면 제한 무시)
 * @param config - 쿨다운/XP 비용 설정
 * @returns 점화 가능 여부 및 상세 정보 (쿨다운, 무료 횟수, XP 요구사항)
 */
export function checkIgnitionAvailability(
    gameState: GameState | null,
    isBonus: boolean = false,
    config: IgnitionConfig = {}
): IgnitionCheckResult {
    const cooldownSeconds = (config.cooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes) * 60;
    const xpCost = config.xpCost ?? IGNITION_DEFAULTS.xpCost;

    if (!gameState) {
        return { canIgnite: false, reason: 'insufficient_xp', requiresXP: xpCost };
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // 날짜 변경 여부 확인 (무료 횟수 리셋용)
    const isNewDay = gameState.lastIgnitionResetDate !== today;

    // 쿨다운 체크 - isBonus에 따라 다른 타임스탬프 사용
    // 날짜가 바뀌어도 쿨다운은 여전히 적용됨!
    const lastTime = isBonus ? gameState.lastBonusIgnitionTime : gameState.lastIgnitionTime;

    if (lastTime) {
        const elapsed = (now - lastTime) / 1000;
        if (elapsed < cooldownSeconds) {
            const freeRemaining = isNewDay 
                ? gameState.dailyFreeIgnitions 
                : (gameState.dailyFreeIgnitions - gameState.usedIgnitions);
            return {
                canIgnite: false,
                reason: 'cooldown',
                cooldownRemaining: Math.ceil(cooldownSeconds - elapsed),
                freeSpinsRemaining: freeRemaining,
            };
        }
    }

    // 보너스는 무료 횟수 및 XP 체크 무시
    if (isBonus) {
        return { canIgnite: true };
    }

    // 무료 횟수 체크 (날짜 변경 시 리셋)
    const usedIgnitions = isNewDay ? 0 : gameState.usedIgnitions;
    const freeRemaining = gameState.dailyFreeIgnitions - usedIgnitions;
    
    if (freeRemaining > 0) {
        return {
            canIgnite: true,
            freeSpinsRemaining: freeRemaining,
        };
    }

    // XP 구매 필요
    return {
        canIgnite: gameState.availableXP >= xpCost,
        reason: gameState.availableXP < xpCost ? 'insufficient_xp' : undefined,
        requiresXP: xpCost,
        freeSpinsRemaining: 0,
    };
}

/**
 * 시간을 MM:SS 형식으로 포맷
 *
 * @param seconds - 초 단위 시간
 * @returns MM:SS 형식 문자열
 */
export function formatCooldownTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
