/**
 * HybridRAGService - 하이브리드 RAG 서비스
 * 
 * @fileoverview
 * Role: 구조화된 쿼리와 벡터 검색을 결합한 하이브리드 RAG 검색 엔진
 * 
 * Responsibilities:
 *   - 쿼리를 파싱하여 구조화된 조건 추출
 *   - 구조화된 조건이 있으면 DirectQuery 우선 실행
 *   - 의미 기반 검색이 필요하면 벡터 검색 보조 사용
 *   - 검색 결과를 컨텍스트 문자열로 포맷팅
 * 
 * Key Dependencies:
 *   - queryParser: 자연어 쿼리 파싱
 *   - directQueryService: DB 직접 쿼리 실행
 *   - ragService: 벡터 기반 의미 검색
 * 
 * @benefits
 *   - 정확한 날짜/상태 쿼리: DB 직접 조회 (100% 정확)
 *   - 비용 절감: 불필요한 임베딩 API 호출 제거
 *   - 빠른 응답: 인메모리 벡터 검색 대신 IndexedDB 쿼리
 *   - 신뢰성: 앱 재시작해도 데이터 유지 (IndexedDB)
 */

import { parseQuery, type ParsedQuery } from './queryParser';
import { executeDirectQuery, executeStatsQuery, formatTasksAsContext, type QueryResult } from './directQueryService';
import { ragService } from './ragService';

/**
 * 하이브리드 RAG 검색 결과
 * @property context - 검색된 컨텍스트 문자열
 * @property queryType - 쿼리 유형 (날짜, 상태, 의미 검색 등)
 * @property source - 결과 소스 (직접 쿼리, 벡터 검색, 하이브리드)
 * @property stats - 선택적 통계 정보
 */
export interface HybridRAGResult {
    context: string;
    queryType: ParsedQuery['queryType'];
    source: 'direct_query' | 'vector_search' | 'hybrid';
    stats?: {
        totalTasks: number;
        completedTasks: number;
    };
}

class HybridRAGService {
    private static instance: HybridRAGService;

    private constructor() {}

    public static getInstance(): HybridRAGService {
        if (!HybridRAGService.instance) {
            HybridRAGService.instance = new HybridRAGService();
        }
        return HybridRAGService.instance;
    }

    /**
     * 쿼리를 분석하고 최적의 검색 방법으로 컨텍스트 생성
     * @param query - 사용자의 자연어 쿼리
     * @returns 검색된 컨텍스트 문자열
     */
    public async generateContext(query: string): Promise<string> {
        // 1. 쿼리 파싱
        const parsed = parseQuery(query);

        // 2. 쿼리 유형에 따른 처리
        let result: HybridRAGResult;

        switch (parsed.queryType) {
            case 'date_specific':
            case 'status_query':
                // 구조화된 쿼리 → 직접 DB 조회
                result = await this.executeStructuredQuery(parsed);
                break;

            case 'stats_query': {
                // 통계 쿼리 → 통계 생성
                const statsContext = await executeStatsQuery(parsed);
                result = {
                    context: statsContext,
                    queryType: 'stats_query',
                    source: 'direct_query',
                };
                break;
            }

            case 'semantic_search':
            default:
                // 의미 기반 검색 → 하이브리드 (직접 쿼리 + 벡터 검색)
                result = await this.executeHybridSearch(parsed, query);
                break;
        }

        return result.context;
    }

    /**
     * 구조화된 쿼리 실행 (날짜, 상태 기반)
     * @param parsed - 파싱된 쿼리 객체
     * @returns 하이브리드 RAG 결과
     */
    private async executeStructuredQuery(parsed: ParsedQuery): Promise<HybridRAGResult> {
        const queryResult = await executeDirectQuery(parsed);

        if (queryResult.tasks.length === 0) {
            // 결과가 없으면 안내 메시지
            const dateInfo = parsed.dateFilter || 
                (parsed.dateRange ? `${parsed.dateRange.start} ~ ${parsed.dateRange.end}` : '');
            const statusInfo = parsed.completedFilter === true ? '완료된 ' : 
                              parsed.completedFilter === false ? '미완료 ' : '';

            return {
                context: `ℹ️ ${dateInfo}에 ${statusInfo}작업이 없습니다.`,
                queryType: parsed.queryType,
                source: 'direct_query',
                stats: { totalTasks: 0, completedTasks: 0 },
            };
        }

        const context = formatTasksAsContext(queryResult.tasks, 30);

        return {
            context: `[📋 조회된 작업 기록]\n${context}`,
            queryType: parsed.queryType,
            source: 'direct_query',
            stats: {
                totalTasks: queryResult.summary.totalCount,
                completedTasks: queryResult.summary.completedCount,
            },
        };
    }

    /**
     * 하이브리드 검색 (직접 쿼리 + 벡터 검색 결합)
     * @param parsed - 파싱된 쿼리 객체
     * @param originalQuery - 원본 쿼리 문자열 (벡터 검색용)
     * @returns 하이브리드 RAG 결과
     */
    private async executeHybridSearch(parsed: ParsedQuery, originalQuery: string): Promise<HybridRAGResult> {
        // 1. 먼저 직접 쿼리 시도 (키워드 매칭)
        const directResult = await executeDirectQuery(parsed);

        if (directResult.tasks.length >= 5) {
            // 충분한 결과가 있으면 직접 쿼리만 사용
            const context = formatTasksAsContext(directResult.tasks, 20);
            return {
                context: `[📋 관련 작업 기록]\n${context}`,
                queryType: parsed.queryType,
                source: 'direct_query',
                stats: {
                    totalTasks: directResult.summary.totalCount,
                    completedTasks: directResult.summary.completedCount,
                },
            };
        }

        // 2. 직접 쿼리 결과가 부족하면 벡터 검색 보조
        try {
            const vectorContext = await ragService.generateContext(originalQuery);

            if (directResult.tasks.length > 0 && vectorContext) {
                // 하이브리드: 두 결과 결합
                const directContext = formatTasksAsContext(directResult.tasks, 10);
                return {
                    context: `[📋 관련 작업 기록]\n${directContext}\n\n[🔍 추가 관련 정보]\n${vectorContext}`,
                    queryType: parsed.queryType,
                    source: 'hybrid',
                    stats: {
                        totalTasks: directResult.summary.totalCount,
                        completedTasks: directResult.summary.completedCount,
                    },
                };
            } else if (vectorContext) {
                // 벡터 검색 결과만
                return {
                    context: vectorContext,
                    queryType: parsed.queryType,
                    source: 'vector_search',
                };
            } else if (directResult.tasks.length > 0) {
                // 직접 쿼리 결과만
                const context = formatTasksAsContext(directResult.tasks, 20);
                return {
                    context: `[📋 관련 작업 기록]\n${context}`,
                    queryType: parsed.queryType,
                    source: 'direct_query',
                    stats: {
                        totalTasks: directResult.summary.totalCount,
                        completedTasks: directResult.summary.completedCount,
                    },
                };
            }
        } catch (error) {
            console.warn('⚠️ HybridRAG: Vector search failed, using direct query only', error);
            if (directResult.tasks.length > 0) {
                const context = formatTasksAsContext(directResult.tasks, 20);
                return {
                    context: `[📋 관련 작업 기록]\n${context}`,
                    queryType: parsed.queryType,
                    source: 'direct_query',
                    stats: {
                        totalTasks: directResult.summary.totalCount,
                        completedTasks: directResult.summary.completedCount,
                    },
                };
            }
        }

        // 결과 없음
        return {
            context: '',
            queryType: parsed.queryType,
            source: 'direct_query',
        };
    }

    /**
     * 쿼리 파싱 결과 반환 (디버깅용)
     * @param query - 자연어 쿼리 문자열
     * @returns 파싱된 쿼리 객체
     */
    public parseQuery(query: string): ParsedQuery {
        return parseQuery(query);
    }

    /**
     * 직접 쿼리 실행 (디버깅용)
     * @param parsed - 파싱된 쿼리 객체
     * @returns 쿼리 결과
     */
    public async executeDirectQuery(parsed: ParsedQuery): Promise<QueryResult> {
        return executeDirectQuery(parsed);
    }
}

export const hybridRAGService = HybridRAGService.getInstance();
