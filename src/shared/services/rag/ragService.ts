/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * @role 벡터 기반 문서 검색 및 AI 컨텍스트 생성 서비스
 * @responsibilities
 *   - 문서 인덱싱 (임베딩 생성 및 저장)
 *   - 시맨틱 검색 (쿼리 기반 유사 문서 검색)
 *   - AI 호출을 위한 컨텍스트 문자열 생성
 *   - 인덱싱 및 캐시 통계 관리
 * @dependencies
 *   - vectorStore: 벡터 저장소 (IndexedDB 기반)
 *   - embeddingService: Gemini Embedding API 호출
 */

import { vectorStore, type RAGDocument } from './vectorStore';
import { embeddingService, TaskType } from './embeddingService';

/**
 * RAG 서비스 클래스 (싱글톤 패턴)
 * 문서 인덱싱, 시맨틱 검색, 컨텍스트 생성을 담당합니다.
 */
export class RAGService {
    private static instance: RAGService;
    private indexingStats = { skipped: 0, indexed: 0 };

    private constructor() { }

    /**
     * RAGService 싱글톤 인스턴스를 반환합니다.
     *
     * @returns {RAGService} RAGService 인스턴스
     */
    public static getInstance(): RAGService {
        if (!RAGService.instance) {
            RAGService.instance = new RAGService();
        }
        return RAGService.instance;
    }

    /**
     * RAG 서비스를 초기화합니다.
     * 벡터 저장소를 초기화하고 캐시를 복원합니다.
     *
     * @returns {Promise<void>}
     */
    public async initialize(): Promise<void> {
        await vectorStore.initialize();
    }

    /**
     * 문서를 인덱싱합니다 (임베딩 생성 및 벡터 저장소에 저장).
     * 변경되지 않은 문서는 스킵하고, 캐시된 임베딩이 있으면 재사용합니다.
     *
     * @param {Omit<RAGDocument, 'embedding'>} doc - 인덱싱할 문서 (임베딩 제외)
     * @returns {Promise<void>}
     */
    public async indexDocument(doc: Omit<RAGDocument, 'embedding'>): Promise<void> {
        // 변경되지 않은 문서는 스킵
        const unchanged = await vectorStore.isDocumentUnchanged(doc.id, doc.content, doc.completed ?? false);
        if (unchanged) {
            this.indexingStats.skipped++;
            return;
        }

        // 캐시된 임베딩이 있으면 재사용 (완료 상태만 변경된 경우)
        let embedding = await vectorStore.getCachedEmbedding(doc.id);
        
        if (!embedding) {
            // 캐시된 임베딩이 없으면 새로 생성
            embedding = await embeddingService.getEmbedding(doc.content, TaskType.RETRIEVAL_DOCUMENT);
        }

        const docWithEmbedding: RAGDocument = {
            ...doc,
            embedding
        };

        await vectorStore.addDocument(docWithEmbedding);
        this.indexingStats.indexed++;
    }

    /**
     * 쿼리와 유사한 문서를 검색합니다.
     * 쿼리에서 날짜 및 완료 상태 필터를 자동 추출합니다.
     *
     * @param {string} query - 검색 쿼리
     * @param {number} [limit=5] - 최대 결과 수
     * @returns {Promise<RAGDocument[]>} 검색된 문서 배열
     */
    public async search(query: string, limit: number = 5): Promise<RAGDocument[]> {
        // Generate embedding for the query
        // Use RETRIEVAL_QUERY task type
        const queryEmbedding = await embeddingService.getEmbedding(query, TaskType.RETRIEVAL_QUERY);

        // Extract date from query (simple regex for "MM월 DD일")
        let dateFilter: string | undefined;
        const dateMatch = query.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (dateMatch) {
            const month = dateMatch[1].padStart(2, '0');
            const day = dateMatch[2].padStart(2, '0');
            const year = new Date().getFullYear();
            dateFilter = `${year}-${month}-${day}`;
        }

        // Extract completed status from query ("완료", "끝낸", "마친" 등)
        let completedFilter: boolean | undefined;
        if (/완료|끝낸|마친|했던|수행한|처리한/.test(query)) {
            completedFilter = true;
        } else if (/미완료|안한|못한|남은|pending/.test(query)) {
            completedFilter = false;
        }

        // Search with filters
        let searchResults = await vectorStore.search(query, limit, undefined, queryEmbedding, dateFilter, completedFilter);

        // If no results with date filter, try without date filter but keep completed filter
        if (searchResults.hits.length === 0 && dateFilter) {
            searchResults = await vectorStore.search(query, limit * 2, undefined, queryEmbedding, undefined, completedFilter);
            
            // Then filter results by date in post-processing
            if (dateFilter) {
                searchResults.hits = searchResults.hits.filter(hit => {
                    const matchedDoc = hit.document as RAGDocument;
                    return matchedDoc.date === dateFilter;
                });
            }
        }

        return searchResults.hits.map(hit => hit.document as RAGDocument);
    }

    /**
     * 쿼리를 기반으로 AI 호출용 컨텍스트 문자열을 생성합니다.
     * 검색된 문서를 날짜별로 그룹화하여 포맷팅합니다.
     *
     * @param {string} query - 검색 쿼리
     * @returns {Promise<string>} 포맷팅된 컨텍스트 문자열 (결과 없으면 빈 문자열)
     */
    public async generateContext(query: string): Promise<string> {
        const retrievedDocs = await this.search(query, 20);

        if (retrievedDocs.length === 0) return '';

        // 날짜별로 그룹화하여 더 명확한 컨텍스트 생성
        const docsByDate: Record<string, RAGDocument[]> = {};
        retrievedDocs.forEach(ragDoc => {
            if (!docsByDate[ragDoc.date]) docsByDate[ragDoc.date] = [];
            docsByDate[ragDoc.date].push(ragDoc);
        });

        const contextParts: string[] = [];
        
        // 날짜순 정렬 (최신 순)
        const sortedDates = Object.keys(docsByDate).sort().reverse();
        
        for (const date of sortedDates) {
            const docsForDate = docsByDate[date];
            const completedDocs = docsForDate.filter(ragDoc => ragDoc.completed);
            const pendingDocs = docsForDate.filter(ragDoc => !ragDoc.completed);
            
            contextParts.push(`\n📅 ${date}:`);
            
            if (completedDocs.length > 0) {
                contextParts.push(`  ✅ 완료된 작업 (${completedDocs.length}개):`);
                completedDocs.forEach(completedDoc => {
                    contextParts.push(`    - ${completedDoc.content.trim()}`);
                });
            }
            
            if (pendingDocs.length > 0) {
                contextParts.push(`  ⏳ 미완료 작업 (${pendingDocs.length}개):`);
                pendingDocs.forEach(pendingDoc => {
                    contextParts.push(`    - ${pendingDoc.content.trim()}`);
                });
            }
        }

        return contextParts.join('\n');
    }

    /**
     * 디버깅용: 벡터 저장소의 모든 문서를 반환합니다.
     *
     * @returns {Promise<any[]>} 모든 저장된 문서 배열
     */
    public async debugGetAllDocs(): Promise<any[]> {
        return await vectorStore.getAllDocs();
    }

    /**
     * 인덱싱 통계를 반환합니다.
     *
     * @returns {{ skipped: number; indexed: number }} 스킵된 문서 수와 인덱싱된 문서 수
     */
    public getIndexingStats(): { skipped: number; indexed: number } {
        const stats = { ...this.indexingStats };
        return stats;
    }

    /**
     * 인덱싱 통계를 초기화합니다.
     *
     * @returns {void}
     */
    public resetIndexingStats(): void {
        this.indexingStats = { skipped: 0, indexed: 0 };
    }

    /**
     * 캐시 통계를 반환합니다.
     *
     * @returns {Promise<{ count: number; restoredFromCache: boolean }>} 캐시된 문서 수와 캐시 복원 여부
     */
    public async getCacheStats(): Promise<{ count: number; restoredFromCache: boolean }> {
        return vectorStore.getCacheStats();
    }
}

export const ragService = RAGService.getInstance();
