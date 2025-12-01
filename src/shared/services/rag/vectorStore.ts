/**
 * VectorStore - Orama 기반 벡터 데이터베이스 관리
 * 
 * @fileoverview
 * Role: RAG 시스템을 위한 인메모리 벡터 저장소 관리
 * 
 * Responsibilities:
 *   - Orama DB 초기화 및 스키마 정의
 *   - 문서 추가/삭제 (upsert 지원)
 *   - 키워드 및 벡터 기반 검색
 *   - IndexedDB 캐시에서 문서 복원
 *   - 캐시 통계 제공
 * 
 * Key Dependencies:
 *   - @orama/orama: 벡터 검색 엔진
 *   - vectorPersistence: IndexedDB 영구 저장소
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create, insert, search, remove, type Orama, type Results } from '@orama/orama';
import { vectorPersistence } from './vectorPersistence';

/**
 * RAG 시스템에서 사용하는 문서 타입
 * @property id - 문서 고유 식별자
 * @property type - 문서 유형 (task, journal, goal, insight)
 * @property content - 문서 내용
 * @property date - 날짜 (YYYY-MM-DD)
 * @property completed - 작업 완료 여부 (검색 필터용)
 * @property metadata - 추가 메타데이터
 * @property embedding - 벡터 임베딩
 */
export interface RAGDocument {
    id: string;
    type: 'task' | 'journal' | 'goal' | 'insight';
    content: string;
    date: string;
    completed?: boolean;  // 작업 완료 여부 (검색 필터용)
    metadata?: Record<string, any>;
    embedding?: number[];
}

/**
 * Orama 기반 벡터 데이터베이스 싱글턴 클래스
 * 벡터 임베딩과 키워드 기반 검색을 모두 지원
 */
export class VectorStore {
    private static instance: VectorStore;
    private oramaDb: Orama<any> | null = null;
    private initialized = false;
    private restoredFromCache = false;

    private constructor() { }

    /**
     * VectorStore 싱글턴 인스턴스 반환
     * @returns VectorStore 인스턴스
     */
    public static getInstance(): VectorStore {
        if (!VectorStore.instance) {
            VectorStore.instance = new VectorStore();
        }
        return VectorStore.instance;
    }

    /**
     * VectorStore 초기화 - Orama DB 생성 및 캐시 복원
     * @returns 초기화 완료 Promise
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        this.oramaDb = await create({
            schema: {
                id: 'string',
                type: 'string',
                content: 'string',
                date: 'string',
                completed: 'boolean',  // 작업 완료 여부
                metadata: 'string',
                embedding: 'vector[768]',
            },
        });

        this.initialized = true;

        // 캐시된 문서 복원
        await this.restoreFromCache();
    }

    /**
     * 캐시된 문서를 Orama DB로 복원
     */
    private async restoreFromCache(): Promise<void> {
        if (this.restoredFromCache) return;

        try {
            const cachedDocs = await vectorPersistence.loadAllDocuments();
            if (cachedDocs.length > 0) {
                for (const cachedDoc of cachedDocs) {
                    try {
                        const docToInsert = {
                            ...cachedDoc,
                            completed: cachedDoc.completed ?? false,
                            metadata: JSON.stringify(cachedDoc.metadata || {})
                        };
                        await insert(this.oramaDb!, docToInsert);
                    } catch (_insertError) {
                        // 개별 문서 복원 실패는 무시
                    }
                }
            }
        } catch (restoreError) {
            console.warn('⚠️ VectorStore: Failed to restore from cache', restoreError);
        }

        this.restoredFromCache = true;
    }

    /**
     * 문서가 변경되지 않았으면 인덱싱 스킵
     * @param id - 문서 ID
     * @param content - 문서 내용
     * @param completed - 완료 여부
     * @returns 문서가 변경되지 않았으면 true
     */
    public async isDocumentUnchanged(id: string, content: string, completed: boolean): Promise<boolean> {
        return vectorPersistence.isDocumentUnchanged(id, content, completed);
    }

    /**
     * 문서 추가 (upsert 지원)
     * @param doc - 추가할 RAG 문서
     * @returns Orama 내부 ID
     */
    public async addDocument(doc: RAGDocument): Promise<string> {
        if (!this.oramaDb) await this.initialize();

        // Upsert: Search for existing document by our custom 'id' field
        const searchResult = await search(this.oramaDb!, {
            term: doc.id,
            properties: ['id'],
            exact: true,
            limit: 1
        });

        if (searchResult.count > 0 && searchResult.hits.length > 0) {
            // Found existing document, remove it using its INTERNAL ID
            const internalId = searchResult.hits[0].id;
            try {
                await remove(this.oramaDb!, internalId);
            } catch (removeError) {
                console.warn('⚠️ VectorStore: Failed to remove existing document during upsert', removeError);
            }
        }

        const docToInsert = {
            ...doc,
            completed: doc.completed ?? false,  // boolean 필드 기본값 보장
            metadata: JSON.stringify(doc.metadata || {})
        };

        // Insert new document (Orama generates a new internal ID)
        const insertResult = await insert(this.oramaDb!, docToInsert);

        // 영구 저장소에도 저장
        if (doc.embedding) {
            await vectorPersistence.saveDocument(doc);
        }

        return insertResult;
    }

    /**
     * 여러 문서 일괄 추가
     * @param docs - 추가할 RAG 문서 배열
     * @returns Orama 내부 ID 배열
     */
    public async addDocuments(docs: RAGDocument[]): Promise<string[]> {
        if (!this.oramaDb) await this.initialize();

        // For batch, we process one by one to handle upserts correctly
        return await Promise.all(docs.map(doc => this.addDocument(doc)));
    }

    /**
     * 문서 검색 (키워드 및 벡터 검색 지원)
     * @param query - 검색 쿼리 문자열
     * @param limit - 최대 결과 수 (기본 5)
     * @param type - 문서 유형 필터
     * @param vector - 벡터 임베딩 (벡터 검색용)
     * @param date - 날짜 필터
     * @param completed - 완료 상태 필터
     * @returns Orama 검색 결과
     */
    public async search(query: string, limit: number = 5, type?: string, vector?: number[], date?: string, completed?: boolean): Promise<Results<any>> {
        if (!this.oramaDb) await this.initialize();

        const searchParams: any = {
            term: query,
            limit,
            threshold: 0.2,
        };

        if (vector) {
            searchParams.mode = 'vector';
            searchParams.vector = {
                value: vector,
                property: 'embedding'
            };
            searchParams.similarity = 0.3; // 날짜 필터와 함께 사용시 더 유연하게 검색
        }

        const whereClause: any = {};
        if (type) whereClause.type = type;
        if (date) whereClause.date = date;
        if (completed !== undefined) whereClause.completed = completed;

        if (Object.keys(whereClause).length > 0) {
            searchParams.where = whereClause;
        }

        try {
            return await search(this.oramaDb!, searchParams);
        } catch (searchError) {
            console.warn('⚠️ VectorStore: Vector search failed, falling back to keyword search', searchError);
            // Fallback to keyword search if vector search fails (e.g. schema mismatch)
            delete searchParams.mode;
            delete searchParams.vector;
            delete searchParams.similarity;
            return await search(this.oramaDb!, searchParams);
        }
    }

    /**
     * 모든 문서 삭제 및 초기화
     * @returns 초기화 완료 Promise
     */
    public async clear(): Promise<void> {
        this.initialized = false;
        this.restoredFromCache = false;
        await vectorPersistence.clearAll(); // 영구 저장소도 초기화
        await this.initialize();
    }

    /**
     * 캐시된 문서에서 임베딩 가져오기 (재인덱싱 방지용)
     * @param id - 문서 ID
     * @returns 임베딩 배열 또는 null
     */
    public async getCachedEmbedding(id: string): Promise<number[] | null> {
        const doc = await vectorPersistence.getDocument(id);
        return doc?.embedding || null;
    }

    /**
     * 캐시 통계 조회
     * @returns 캐시 문서 수 및 복원 상태
     */
    public async getCacheStats(): Promise<{ count: number; restoredFromCache: boolean }> {
        const count = await vectorPersistence.getDocumentCount();
        return { count, restoredFromCache: this.restoredFromCache };
    }

    /**
     * 모든 문서 반환 (디버깅용)
     * @returns 모든 문서 배열
     */
    public async getAllDocs(): Promise<any[]> {
        if (!this.oramaDb) return [];
        const searchResult = await search(this.oramaDb, {
            term: '',
            limit: 1000, // Arbitrary large limit for debugging
        });
        return searchResult.hits.map(hit => hit.document);
    }

    /**
     * 초기화 상태 확인
     * @returns 초기화 여부
     */
    public isInitialized(): boolean {
        return this.initialized;
    }
}

export const vectorStore = VectorStore.getInstance();
