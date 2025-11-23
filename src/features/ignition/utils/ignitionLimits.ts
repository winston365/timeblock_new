/**
 * 점화 제한 체크 유틸리티
 * 
 * @role 점화 사용 가능 여부 확인 및 제한 로직
 */

import type { GameState } from '@/shared/types/domain';

export interface IgnitionCheckResult {
    canIgnite: boolean;
    reason?: 'cooldown' | 'no_free_spins' | 'insufficient_xp';
    cooldownRemaining?: number; // 초
    freeSpinsRemaining?: number;
    requiresXP?: number;
}

/**
 * 점화 사용 가능 여부 확인
 * 
 * @param gameState 현재 게임 상태
 * @param isBonus 비활동 보너스 여부 (true면 제한 무시)
 * @returns 점화 가능 여부 및 상세 정보
 */
export function checkIgnitionAvailability(
    gameState: GameState | null,
    isBonus: boolean = false
): IgnitionCheckResult {
    if (!gameState) {
        return { canIgnite: false, reason: 'insufficient_xp' };
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // 날짜 변경 시 리셋 (자정)
    if (gameState.lastIgnitionResetDate !== today) {
        return {
            canIgnite: true,
            freeSpinsRemaining: gameState.dailyFreeIgnitions,
        };
    }

    // 쿨다운 체크 (15분 = 900초) - 보너스도 적용
    if (gameState.lastIgnitionTime) {
        const elapsed = (now - gameState.lastIgnitionTime) / 1000;
        if (elapsed < 900) {
            return {
                canIgnite: false,
                reason: 'cooldown',
                cooldownRemaining: Math.ceil(900 - elapsed),
                freeSpinsRemaining: gameState.dailyFreeIgnitions - gameState.usedIgnitions,
            };
        }
    }

    // 보너스는 무료 횟수 및 XP 체크 무시
    if (isBonus) {
        return { canIgnite: true };
    }

    // 무료 횟수 체크
    const freeRemaining = gameState.dailyFreeIgnitions - gameState.usedIgnitions;
    if (freeRemaining > 0) {
        return {
            canIgnite: true,
            freeSpinsRemaining: freeRemaining,
        };
    }

    // XP 구매 필요
    const xpCost = 50;
    return {
        canIgnite: gameState.availableXP >= xpCost,
        reason: gameState.availableXP < xpCost ? 'insufficient_xp' : undefined,
        requiresXP: xpCost,
        freeSpinsRemaining: 0,
    };
}

/**
 * 시간을 MM:SS 형식으로 포맷
 */
export function formatCooldownTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
