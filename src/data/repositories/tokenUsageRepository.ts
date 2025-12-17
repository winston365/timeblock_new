/**
 * tokenUsageRepository.ts
 *
 * @role 일일 토큰 사용량 영속화 관리
 * @description IndexedDB dailyTokenUsage 테이블에 대한 CRUD 연산 제공
 */

import { db } from '../db/dexieClient';
import type { DailyTokenUsage } from '@/shared/types/domain';

/**
 * 토큰 사용량 값 정제 (NaN 방지)
 */
function sanitizeTokenUsage(usage: DailyTokenUsage): DailyTokenUsage {
    const safe = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
    const prompt = safe(usage.promptTokens);
    const candidates = safe(usage.candidatesTokens);
    const embedding = safe(usage.embeddingTokens);
    const total = safe(usage.totalTokens) || prompt + candidates + embedding;
    const messageCount = safe(usage.messageCount);
    return {
        ...usage,
        promptTokens: prompt,
        candidatesTokens: candidates,
        embeddingTokens: embedding,
        totalTokens: total,
        messageCount,
    };
}

/**
 * 모든 토큰 사용량 조회
 */
export async function getAllTokenUsage(): Promise<DailyTokenUsage[]> {
    const rows = await db.dailyTokenUsage.toArray();
    return rows as DailyTokenUsage[];
}

/**
 * 토큰 사용량 저장 (정제 포함)
 */
export async function saveTokenUsage(usage: DailyTokenUsage): Promise<void> {
    const sanitized = sanitizeTokenUsage(usage);
    await db.dailyTokenUsage.put(sanitized);
}

/**
 * NaN 값이 있는 토큰 사용량 복구
 */
export async function repairAllTokenUsage(): Promise<void> {
    try {
        const rows = await db.dailyTokenUsage.toArray();
        const repairs = rows.map(async (row) => {
            const sanitized = sanitizeTokenUsage(row as DailyTokenUsage);
            if (
                sanitized.promptTokens !== row.promptTokens ||
                sanitized.candidatesTokens !== row.candidatesTokens ||
                sanitized.embeddingTokens !== row.embeddingTokens ||
                sanitized.totalTokens !== row.totalTokens ||
                sanitized.messageCount !== row.messageCount
            ) {
                await db.dailyTokenUsage.put(sanitized);
            }
        });
        await Promise.all(repairs);
    } catch (error) {
        console.error('Failed to repair token usage records:', error);
    }
}

export { sanitizeTokenUsage };
