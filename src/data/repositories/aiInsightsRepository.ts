/**
 * aiInsightsRepository.ts
 *
 * @role AI 생성 인사이트 영구 저장 (Dexie 'aiInsights' 테이블 사용)
 * @description AI가 생성한 통계 인사이트를 날짜별로 캐싱합니다.
 */

import { db } from '../db/dexieClient';

export interface AIInsightRecord {
    date: string;        // YYYY-MM-DD
    content: string;     // 인사이트 내용
    generatedAt: number; // 생성 시각
}

/**
 * AI 인사이트 조회
 * @param date 날짜 (YYYY-MM-DD)
 * @returns 인사이트 레코드 또는 undefined
 */
export async function getAIInsight(date: string): Promise<AIInsightRecord | undefined> {
    try {
        return await db.aiInsights.get(date);
    } catch (error) {
        console.error(`Failed to get AI insight for date "${date}":`, error);
        return undefined;
    }
}

/**
 * AI 인사이트 저장
 * @param date 날짜 (YYYY-MM-DD)
 * @param content 인사이트 내용
 */
export async function saveAIInsight(date: string, content: string): Promise<void> {
    try {
        await db.aiInsights.put({
            date,
            content,
            generatedAt: Date.now(),
        });
    } catch (error) {
        console.error(`Failed to save AI insight for date "${date}":`, error);
    }
}

/**
 * AI 인사이트 삭제
 * @param date 날짜 (YYYY-MM-DD)
 */
export async function deleteAIInsight(date: string): Promise<void> {
    try {
        await db.aiInsights.delete(date);
    } catch (error) {
        console.error(`Failed to delete AI insight for date "${date}":`, error);
    }
}
