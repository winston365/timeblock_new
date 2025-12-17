/**
 * ragDocumentRepository.ts
 *
 * @role RAG 문서 및 벡터 임베딩 영속화 관리
 * @description IndexedDB ragDocuments 테이블에 대한 CRUD 연산 제공
 */

import { db, type RAGDocumentRecord } from '../db/dexieClient';

/**
 * RAG 문서 저장
 */
export async function saveRagDocument(doc: RAGDocumentRecord): Promise<void> {
    await db.ragDocuments.put(doc);
}

/**
 * RAG 문서 일괄 저장
 */
export async function saveRagDocuments(docs: RAGDocumentRecord[]): Promise<void> {
    if (docs.length > 0) {
        await db.ragDocuments.bulkPut(docs);
    }
}

/**
 * RAG 문서 조회 (ID로)
 */
export async function getRagDocument(id: string): Promise<RAGDocumentRecord | undefined> {
    return await db.ragDocuments.get(id);
}

/**
 * 모든 RAG 문서 조회
 */
export async function getAllRagDocuments(): Promise<RAGDocumentRecord[]> {
    return await db.ragDocuments.toArray();
}

/**
 * 특정 날짜 이전의 RAG 문서 조회
 */
export async function getRagDocumentsBefore(cutoffDate: string): Promise<RAGDocumentRecord[]> {
    return await db.ragDocuments.where('date').below(cutoffDate).toArray();
}

/**
 * RAG 문서 삭제 (ID로)
 */
export async function deleteRagDocument(id: string): Promise<void> {
    await db.ragDocuments.delete(id);
}

/**
 * 여러 RAG 문서 삭제 (ID 배열로)
 */
export async function deleteRagDocuments(ids: string[]): Promise<void> {
    await db.ragDocuments.bulkDelete(ids);
}

/**
 * 모든 RAG 문서 삭제
 */
export async function clearAllRagDocuments(): Promise<void> {
    await db.ragDocuments.clear();
}
