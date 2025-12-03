/**
 * AutoTagService - RAG 기반 자동 맥락 추천
 * 
 * @role 새 작업 입력 시 과거 유사 작업의 패턴/맥락을 자동 분석하여 추천
 *       시간대, 소요시간, 난이도, 메모, 준비물 등을 요약 제공
 */

import { db } from '@/data/db/dexieClient';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import type { Task, Resistance, TimeBlockId } from '@/shared/types/domain';

export interface TagSuggestion {
    tag: string;
    count: number;
    source: 'history' | 'ai';
    relatedTasks: string[];
}

export interface AutoTagResult {
    suggestedTags: TagSuggestion[];
    similarTasks: Array<{
        text: string;
        memo: string;
        tags: string[];
        date: string;
        completed: boolean;
    }>;
}

/** 자동 맥락 분석 결과 */
export interface TaskContextSuggestion {
    /** 분석에 사용된 유사 작업 수 */
    matchCount: number;
    /** 주로 사용된 시간대 */
    preferredTimeBlock: {
        block: TimeBlockId;
        label: string;
        count: number;
    } | null;
    /** 평균 소요 시간 (분) */
    avgDuration: number;
    /** 자주 사용된 난이도 */
    commonResistance: {
        level: Resistance;
        label: string;
        count: number;
    } | null;
    /** 자주 등장하는 메모 키워드/문구 */
    commonMemoSnippets: string[];
    /** 자주 사용된 준비물 */
    commonPreparations: string[];
    /** 완료율 */
    completionRate: number;
    /** 유사 작업 제목 샘플 */
    sampleTasks: string[];
    /** 반복 작업 감지 (30일 내 동일/유사 작업 횟수) */
    repeatInfo: {
        isRepeat: boolean;
        count: number;
        lastDate: string | null;
    } | null;
    /** 과거 메모 전체 목록 (클릭하여 메모에 추가 용도) */
    fullMemos: Array<{
        memo: string;
        date: string;
    }>;
}

/**
 * 메모에서 해시태그 추출
 */
export function extractTagsFromMemo(memo: string): string[] {
    if (!memo) return [];
    const tagPattern = /#([가-힣a-zA-Z0-9_]+)/g;
    const matches = memo.match(tagPattern) || [];
    return matches.map(tag => tag.slice(1)); // # 제거
}

/**
 * 텍스트 유사도 계산 (간단한 키워드 매칭)
 */
function calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    let matches = 0;
    for (const word of set1) {
        if (set2.has(word)) matches++;
    }
    
    return matches / Math.max(set1.size, set2.size);
}

/**
 * 과거 작업에서 유사한 작업 찾기 및 태그 추출
 */
export async function suggestTagsForTask(taskText: string, limit: number = 5): Promise<AutoTagResult> {
    const recentData = await getRecentDailyData(60); // 최근 60일
    const completedInbox = await db.completedInbox.toArray();
    
    // 모든 작업 수집
    const allTasks: Array<Task & { date: string }> = [];
    
    for (const day of recentData) {
        for (const task of day.tasks || []) {
            allTasks.push({ ...task, date: day.date });
        }
    }
    
    for (const task of completedInbox) {
        if (task.completedAt) {
            allTasks.push({ ...task, date: task.completedAt.slice(0, 10) });
        }
    }
    
    // 유사도 계산 및 정렬
    const scoredTasks = allTasks
        .map(task => ({
            task,
            similarity: calculateSimilarity(taskText, task.text),
        }))
        .filter(item => item.similarity > 0.2) // 최소 유사도
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20); // 상위 20개
    
    // 태그 집계
    const tagCounts = new Map<string, { count: number; tasks: string[] }>();
    
    for (const { task } of scoredTasks) {
        const tags = extractTagsFromMemo(task.memo);
        for (const tag of tags) {
            const existing = tagCounts.get(tag) || { count: 0, tasks: [] };
            existing.count++;
            if (!existing.tasks.includes(task.text)) {
                existing.tasks.push(task.text);
            }
            tagCounts.set(tag, existing);
        }
    }
    
    // 태그 정렬 (사용 빈도 순)
    const suggestedTags: TagSuggestion[] = Array.from(tagCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([tag, data]) => ({
            tag,
            count: data.count,
            source: 'history' as const,
            relatedTasks: data.tasks.slice(0, 3),
        }));
    
    // 유사 작업 목록
    const similarTasks = scoredTasks.slice(0, 5).map(({ task }) => ({
        text: task.text,
        memo: task.memo,
        tags: extractTagsFromMemo(task.memo),
        date: task.date,
        completed: task.completed,
    }));
    
    return {
        suggestedTags,
        similarTasks,
    };
}

/**
 * 전체 태그 통계 (설정/분석용)
 */
export async function getAllTagStats(): Promise<Map<string, number>> {
    const recentData = await getRecentDailyData(90);
    const completedInbox = await db.completedInbox.toArray();
    
    const tagCounts = new Map<string, number>();
    
    const processTask = (task: Task) => {
        const tags = extractTagsFromMemo(task.memo);
        for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
    };
    
    for (const day of recentData) {
        for (const task of day.tasks || []) {
            processTask(task);
        }
    }
    
    for (const task of completedInbox) {
        processTask(task);
    }
    
    return tagCounts;
}

/**
 * 태그 자동완성을 위한 태그 목록
 */
export async function getTagAutocomplete(prefix: string): Promise<string[]> {
    const allStats = await getAllTagStats();
    
    const matching = Array.from(allStats.entries())
        .filter(([tag]) => tag.toLowerCase().startsWith(prefix.toLowerCase()))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
    
    return matching;
}

/**
 * AI 기반 태그 추천 (Gemini 사용)
 */
export async function suggestTagsWithAI(
    taskText: string,
    existingTags: string[],
    apiKey: string
): Promise<string[]> {
    if (!apiKey) return [];
    
    try {
        const { callGeminiAPI } = await import('@/shared/services/ai/geminiApi');
        const { trackTokenUsage } = await import('@/shared/utils/tokenUtils');
        
        const prompt = `
작업 제목: "${taskText}"
기존에 사용된 태그들: ${existingTags.length > 0 ? existingTags.join(', ') : '없음'}

위 작업에 어울리는 태그를 3개 추천해주세요.
- 태그는 한글 또는 영어로 1~2단어
- 기존 태그 중 관련있는 것이 있다면 우선 사용
- 카테고리(예: 업무, 공부, 운동)와 속성(예: 중요, 긴급, 루틴) 혼합

JSON 배열로만 응답하세요:
["태그1", "태그2", "태그3"]
`;
        
        const { text, tokenUsage } = await callGeminiAPI(prompt, [], apiKey);
        
        // 토큰 사용량 기록
        trackTokenUsage(tokenUsage);
        
        // JSON 파싱
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed.filter(t => typeof t === 'string').slice(0, 5);
            }
        }
    } catch (error) {
        console.error('AI 태그 추천 실패:', error);
    }
    
    return [];
}

// ============================================================
// 자동 맥락 추천 (Auto Context Suggestion)
// ============================================================

type NonNullTimeBlockId = Exclude<TimeBlockId, null>;

const TIME_BLOCK_LABELS: Record<NonNullTimeBlockId, string> = {
    '5-8': '이른 아침 (5-8시)',
    '8-11': '오전 (8-11시)',
    '11-14': '점심 (11-14시)',
    '14-17': '오후 (14-17시)',
    '17-19': '저녁 (17-19시)',
    '19-24': '밤 (19-24시)',
};

const RESISTANCE_LABELS: Record<Resistance, string> = {
    'low': '쉬움',
    'medium': '보통',
    'high': '어려움',
};

/**
 * 과거 유사 작업에서 맥락 정보를 자동 추출
 */
export async function suggestTaskContext(taskText: string): Promise<TaskContextSuggestion> {
    const recentData = await getRecentDailyData(90); // 최근 90일
    const completedInbox = await db.completedInbox.toArray();
    
    // 모든 작업 수집 (timeBlock 포함)
    interface TaskWithMeta extends Task {
        date: string;
        timeBlock: TimeBlockId;
    }
    
    const allTasks: TaskWithMeta[] = [];
    
    for (const day of recentData) {
        for (const task of day.tasks || []) {
            allTasks.push({ 
                ...task, 
                date: day.date,
                timeBlock: task.timeBlock || '8-11',
            });
        }
    }
    
    for (const task of completedInbox) {
        if (task.completedAt) {
            allTasks.push({ 
                ...task, 
                date: task.completedAt.slice(0, 10),
                timeBlock: task.timeBlock || '8-11',
            });
        }
    }
    
    // 유사도 계산
    const similarTasks = allTasks
        .map(task => ({
            task,
            similarity: calculateSimilarity(taskText, task.text),
        }))
        .filter(item => item.similarity > 0.15) // 넉넉한 임계값
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 30) // 상위 30개
        .map(item => item.task);
    
    if (similarTasks.length === 0) {
        return {
            matchCount: 0,
            preferredTimeBlock: null,
            avgDuration: 0,
            commonResistance: null,
            commonMemoSnippets: [],
            commonPreparations: [],
            completionRate: 0,
            sampleTasks: [],
            repeatInfo: null,
            fullMemos: [],
        };
    }
    
    // 1. 시간대 분석
    const timeBlockCounts = new Map<NonNullTimeBlockId, number>();
    for (const task of similarTasks) {
        const block = task.timeBlock;
        if (block) {
            timeBlockCounts.set(block, (timeBlockCounts.get(block) || 0) + 1);
        }
    }
    const topTimeBlock = Array.from(timeBlockCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
    
    // 2. 평균 소요 시간
    const durations = similarTasks
        .map(t => t.baseDuration || t.adjustedDuration || 0)
        .filter(d => d > 0);
    const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    
    // 3. 난이도 분석
    const resistanceCounts = new Map<Resistance, number>();
    for (const task of similarTasks) {
        if (task.resistance) {
            resistanceCounts.set(task.resistance, (resistanceCounts.get(task.resistance) || 0) + 1);
        }
    }
    const topResistance = Array.from(resistanceCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
    
    // 4. 메모에서 주요 키워드/문구 추출
    const memoSnippets: string[] = [];
    const fullMemos: Array<{ memo: string; date: string }> = [];
    for (const task of similarTasks) {
        if (task.memo && task.memo.trim()) {
            // fullMemos: 전체 메모 저장 (클릭 시 메모에 추가용)
            fullMemos.push({
                memo: task.memo.trim(),
                date: task.date,
            });
            // 짧은 메모는 전체, 긴 메모는 첫 줄만
            const snippet = task.memo.length > 30 
                ? task.memo.split('\n')[0].slice(0, 30) + '...'
                : task.memo.trim();
            if (snippet && !memoSnippets.includes(snippet)) {
                memoSnippets.push(snippet);
            }
        }
    }
    
    // 5. 준비물 수집
    const preparations: string[] = [];
    for (const task of similarTasks) {
        for (const prep of [task.preparation1, task.preparation2, task.preparation3]) {
            if (prep && prep.trim() && !preparations.includes(prep.trim())) {
                preparations.push(prep.trim());
            }
        }
    }
    
    // 6. 완료율 계산
    const completedCount = similarTasks.filter(t => t.completed).length;
    const completionRate = Math.round((completedCount / similarTasks.length) * 100);
    
    // 7. 샘플 작업 제목
    const sampleTasks = similarTasks
        .slice(0, 3)
        .map(t => t.text.length > 25 ? t.text.slice(0, 25) + '...' : t.text);
    
    // 8. 반복 작업 감지 (높은 유사도 작업만)
    const highSimilarityTasks = allTasks
        .filter(task => calculateSimilarity(taskText, task.text) > 0.5)
        .sort((a, b) => b.date.localeCompare(a.date));
    
    const repeatInfo = highSimilarityTasks.length >= 3 ? {
        isRepeat: true,
        count: highSimilarityTasks.length,
        lastDate: highSimilarityTasks[0]?.date || null,
    } : null;
    
    return {
        matchCount: similarTasks.length,
        preferredTimeBlock: topTimeBlock ? {
            block: topTimeBlock[0],
            label: TIME_BLOCK_LABELS[topTimeBlock[0]] || topTimeBlock[0],
            count: topTimeBlock[1],
        } : null,
        avgDuration,
        commonResistance: topResistance ? {
            level: topResistance[0],
            label: RESISTANCE_LABELS[topResistance[0]],
            count: topResistance[1],
        } : null,
        commonMemoSnippets: memoSnippets.slice(0, 3),
        commonPreparations: preparations.slice(0, 4),
        completionRate,
        sampleTasks,
        repeatInfo,
        fullMemos: fullMemos.slice(0, 5), // 최대 5개
    };
}

/**
 * 맥락 추천 결과를 사람이 읽기 쉬운 텍스트로 포맷
 */
export function formatContextSuggestion(ctx: TaskContextSuggestion): string {
    if (ctx.matchCount === 0) {
        return '유사한 과거 작업을 찾지 못했습니다.';
    }
    
    const lines: string[] = [];
    
    if (ctx.preferredTimeBlock) {
        lines.push(`⏰ 주로 ${ctx.preferredTimeBlock.label}에 진행 (${ctx.preferredTimeBlock.count}회)`);
    }
    
    if (ctx.avgDuration > 0) {
        lines.push(`⏱️ 평균 ${ctx.avgDuration}분 소요`);
    }
    
    if (ctx.commonResistance) {
        lines.push(`💪 난이도 ${ctx.commonResistance.label} (${ctx.commonResistance.count}회)`);
    }
    
    if (ctx.completionRate > 0) {
        const emoji = ctx.completionRate >= 80 ? '✅' : ctx.completionRate >= 50 ? '📊' : '⚠️';
        lines.push(`${emoji} 완료율 ${ctx.completionRate}%`);
    }
    
    if (ctx.commonPreparations.length > 0) {
        lines.push(`🎒 준비물: ${ctx.commonPreparations.join(', ')}`);
    }
    
    if (ctx.commonMemoSnippets.length > 0) {
        lines.push(`📝 메모: "${ctx.commonMemoSnippets[0]}"`);
    }
    
    return lines.join('\n');
}
