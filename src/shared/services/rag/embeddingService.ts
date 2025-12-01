/**
 * EmbeddingService - Gemini 임베딩 API 서비스
 * 
 * @fileoverview
 * Role: 텍스트를 벡터 임베딩으로 변환하는 서비스
 * 
 * Responsibilities:
 *   - Gemini text-embedding-004 모델을 사용한 임베딩 생성
 *   - 임베딩 결과 캐싱으로 API 호출 최소화
 *   - 토큰 사용량 추적 및 디바운싱
 *   - L2 정규화를 통한 벡터 품질 보장
 * 
 * Key Dependencies:
 *   - @google/generative-ai: Gemini API 클라이언트
 *   - settingsStore: API 키 관리
 *   - chatHistoryRepository: 토큰 사용량 저장
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

/**
 * 임베딩 작업 유형
 * RETRIEVAL_DOCUMENT: 문서 인덱싱용 임베딩
 * RETRIEVAL_QUERY: 검색 쿼리용 임베딩
 */
export enum TaskType {
    RETRIEVAL_DOCUMENT = 'RETRIEVAL_DOCUMENT',
    RETRIEVAL_QUERY = 'RETRIEVAL_QUERY',
}

/**
 * Gemini 임베딩 API를 사용하는 싱글턴 서비스
 * 텍스트를 768차원 벡터로 변환하고 결과를 캐싱
 */
export class EmbeddingService {
    private static instance: EmbeddingService;
    private genAI: GoogleGenerativeAI | null = null;
    private embeddingCache: Map<string, number[]> = new Map();
    private pendingTokens = 0;
    private flushTimeout: NodeJS.Timeout | null = null;

    private constructor() { }

    /**
     * EmbeddingService 싱글턴 인스턴스 반환
     * @returns EmbeddingService 인스턴스
     */
    public static getInstance(): EmbeddingService {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }

    /**
     * Gemini API 클라이언트 반환 (지연 초기화)
     * @returns GoogleGenerativeAI 인스턴스
     * @throws API 키가 없으면 에러
     */
    private getClient(): GoogleGenerativeAI {
        if (!this.genAI) {
            const userSettings = useSettingsStore.getState().settings;
            const apiKey = userSettings ? userSettings.geminiApiKey : null;
            if (!apiKey) {
                throw new Error('Gemini API Key is missing');
            }
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
        return this.genAI;
    }

    /**
     * 누적된 토큰 사용량을 DB에 저장
     */
    private flushTokenUsage() {
        if (this.pendingTokens > 0) {
            const tokensToFlush = this.pendingTokens;
            this.pendingTokens = 0;

            // Fire and forget token usage update
            addTokenUsage(0, 0, tokensToFlush).catch(flushError => console.error('Failed to track embedding tokens', flushError));
        }
        this.flushTimeout = null;
    }

    /**
     * 토큰 사용량을 큐에 추가 (디바운싱용)
     * @param tokens - 추가할 토큰 수
     */
    private queueTokenUsage(tokens: number) {
        this.pendingTokens += tokens;

        if (!this.flushTimeout) {
            // Debounce for 2 seconds to aggregate rapid updates during indexing
            this.flushTimeout = setTimeout(() => this.flushTokenUsage(), 2000);
        }
    }

    /**
     * 텍스트의 벡터 임베딩 생성
     * @param text - 임베딩할 텍스트
     * @param taskType - 임베딩 작업 유형 (기본: RETRIEVAL_DOCUMENT)
     * @returns 768차원 벡터 배열 (실패 시 빈 배열)
     */
    public async getEmbedding(text: string, taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[]> {
        if (!text || text.trim().length === 0) return [];

        // Cache key should include taskType because embedding might differ
        const cacheKey = `${taskType}:${text}`;

        // Check cache
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey) || [];
        }

        try {
            const client = this.getClient();
            const model = client.getGenerativeModel({ model: 'text-embedding-004' });

            const result = await model.embedContent({
                content: { role: 'user', parts: [{ text }] },
                taskType: taskType as any,
                outputDimensionality: 768, // Explicitly request 768 dimensions
            } as any); // Cast to any to support outputDimensionality if types are outdated

            const embedding = result.embedding.values;

            // Normalize embedding if needed (Gemini docs recommend normalization for reduced dimensions)
            // L2 Normalization: vector / ||vector||
            const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            let normalizedEmbedding = embedding;
            if (norm > 0) {
                normalizedEmbedding = embedding.map(val => val / norm);
            }

            // Track token usage (Estimate: 1 token ~ 4 chars)
            const estimatedTokens = Math.ceil(text.length / 4);

            // Queue token usage update instead of immediate call
            this.queueTokenUsage(estimatedTokens);

            // Cache result (limit cache size to prevent memory leaks)
            if (this.embeddingCache.size > 1000) {
                const firstKey = this.embeddingCache.keys().next().value;
                if (firstKey) this.embeddingCache.delete(firstKey);
            }
            this.embeddingCache.set(cacheKey, normalizedEmbedding);

            return normalizedEmbedding;
        } catch (embeddingError) {
            console.error('❌ EmbeddingService: Failed to generate embedding', embeddingError);
            return [];
        }
    }

    /**
     * 여러 텍스트의 벡터 임베딩 일괄 생성
     * @param texts - 임베딩할 텍스트 배열
     * @param taskType - 임베딩 작업 유형 (기본: RETRIEVAL_DOCUMENT)
     * @returns 벡터 배열의 배열
     */
    public async getEmbeddings(texts: string[], taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[][]> {
        // Gemini API supports batch embedding, but for simplicity and cache usage, we loop
        return await Promise.all(texts.map(text => this.getEmbedding(text, taskType)));
    }
}

export const embeddingService = EmbeddingService.getInstance();
