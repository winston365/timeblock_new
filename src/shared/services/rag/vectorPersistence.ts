/**
 * VectorPersistence - RAG 벡터 영구 저장 서비스
 * 
 * @fileoverview
 * Role: RAG 문서와 벡터 임베딩을 IndexedDB에 영구 저장
 * 
 * Responsibilities:
 *   - Dexie(IndexedDB)를 활용한 벡터 데이터 영구 저장
 *   - 앱 재시작 시 Orama DB로 복원
 *   - 콘텐츠 해시 기반 변경 감지 (재인덱싱 방지)
 *   - 오래된 문서 정리
 * 
 * Key Dependencies:
 *   - dexieClient: IndexedDB 접근
 *   - RAGDocument: 문서 타입 정의
 */

import { db, type RAGDocumentRecord } from '@/data/db/dexieClient';
import type { RAGDocument } from './vectorStore';
import { getLocalDate } from '@/shared/lib/utils';

/**
 * 문자열의 간단한 해시 생성 (변경 감지용)
 * @param content - 문서 내용
 * @param completed - 완료 여부
 * @returns 32비트 해시 문자열 (base36)
 */
function hashContent(content: string, completed: boolean): string {
    const hashInput = `${content}:${completed}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
        const charCode = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + charCode;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

/**
 * RAG 벡터 영구 저장소 싱글턴 클래스
 * IndexedDB를 사용하여 문서와 임베딩을 영구 저장
 */
export class VectorPersistence {
    private static instance: VectorPersistence;

    private constructor() { }

    /**
     * VectorPersistence 싱글턴 인스턴스 반환
     * @returns VectorPersistence 인스턴스
     */
    public static getInstance(): VectorPersistence {
        if (!VectorPersistence.instance) {
            VectorPersistence.instance = new VectorPersistence();
        }
        return VectorPersistence.instance;
    }

    /**
     * 문서가 이미 인덱싱되어 있고 변경되지 않았는지 확인
     * @param id - 문서 ID
     * @param content - 문서 내용
     * @param completed - 완료 여부
     * @returns 문서가 변경되지 않았으면 true
     */
    public async isDocumentUnchanged(id: string, content: string, completed: boolean): Promise<boolean> {
        try {
            const existingDoc = await db.ragDocuments.get(id);
            if (!existingDoc) return false;

            const newHash = hashContent(content, completed);
            return existingDoc.contentHash === newHash;
        } catch (checkError) {
            console.warn('⚠️ VectorPersistence: Failed to check document', checkError);
            return false;
        }
    }

    /**
     * 문서를 영구 저장소에 저장
     * @param doc - 저장할 RAG 문서 (임베딩 필수)
     */
    public async saveDocument(doc: RAGDocument): Promise<void> {
        if (!doc.embedding) {
            console.warn('⚠️ VectorPersistence: Document has no embedding, skipping save');
            return;
        }

        try {
            const documentRecord: RAGDocumentRecord = {
                id: doc.id,
                type: doc.type,
                content: doc.content,
                date: doc.date,
                completed: doc.completed ?? false,
                metadata: JSON.stringify(doc.metadata || {}),
                embedding: doc.embedding,
                contentHash: hashContent(doc.content, doc.completed ?? false),
                indexedAt: Date.now(),
            };

            await db.ragDocuments.put(documentRecord);
        } catch (saveError) {
            console.error('❌ VectorPersistence: Failed to save document', saveError);
        }
    }

    /**
     * 여러 문서를 일괄 저장
     * @param docs - 저장할 RAG 문서 배열
     */
    public async saveDocuments(docs: RAGDocument[]): Promise<void> {
        const documentRecords: RAGDocumentRecord[] = docs
            .filter(doc => doc.embedding)
            .map(doc => ({
                id: doc.id,
                type: doc.type,
                content: doc.content,
                date: doc.date,
                completed: doc.completed ?? false,
                metadata: JSON.stringify(doc.metadata || {}),
                embedding: doc.embedding!,
                contentHash: hashContent(doc.content, doc.completed ?? false),
                indexedAt: Date.now(),
            }));

        if (documentRecords.length > 0) {
            await db.ragDocuments.bulkPut(documentRecords);
        }
    }

    /**
     * 저장된 모든 문서 로드 (앱 시작 시 복원용)
     * @returns RAG 문서 배열
     */
    public async loadAllDocuments(): Promise<RAGDocument[]> {
        try {
            const storedRecords = await db.ragDocuments.toArray();

            return storedRecords.map(storedRecord => ({
                id: storedRecord.id,
                type: storedRecord.type,
                content: storedRecord.content,
                date: storedRecord.date,
                completed: storedRecord.completed,
                metadata: JSON.parse(storedRecord.metadata),
                embedding: storedRecord.embedding,
            }));
        } catch (loadError) {
            console.error('❌ VectorPersistence: Failed to load documents', loadError);
            return [];
        }
    }

    /**
     * 특정 문서의 저장된 데이터 가져오기 (임베딩 포함)
     * @param id - 문서 ID
     * @returns RAG 문서 또는 null
     */
    public async getDocument(id: string): Promise<RAGDocument | null> {
        try {
            const storedRecord = await db.ragDocuments.get(id);
            if (!storedRecord) return null;

            return {
                id: storedRecord.id,
                type: storedRecord.type,
                content: storedRecord.content,
                date: storedRecord.date,
                completed: storedRecord.completed,
                metadata: JSON.parse(storedRecord.metadata),
                embedding: storedRecord.embedding,
            };
        } catch (getError) {
            console.warn('⚠️ VectorPersistence: Failed to get document', getError);
            return null;
        }
    }

    /**
     * 문서 삭제
     * @param id - 삭제할 문서 ID
     */
    public async deleteDocument(id: string): Promise<void> {
        try {
            await db.ragDocuments.delete(id);
        } catch (deleteError) {
            console.warn('⚠️ VectorPersistence: Failed to delete document', deleteError);
        }
    }

    /**
     * 모든 저장된 문서 삭제 (캐시 초기화)
     */
    public async clearAll(): Promise<void> {
        try {
            await db.ragDocuments.clear();
        } catch (clearError) {
            console.error('❌ VectorPersistence: Failed to clear documents', clearError);
        }
    }

    /**
     * 저장된 문서 수 확인
     * @returns 문서 수
     */
    public async getDocumentCount(): Promise<number> {
        try {
            return await db.ragDocuments.count();
        } catch (error) {
            return 0;
        }
    }

    /**
     * 오래된 문서 정리 (선택적, 기본 60일 이상)
     * @param daysToKeep - 유지할 일수 (기본: 60)
     * @returns 삭제된 문서 수
     */
    public async cleanupOldDocuments(daysToKeep: number = 60): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffDateStr = getLocalDate(cutoffDate);

            const oldDocuments = await db.ragDocuments
                .where('date')
                .below(cutoffDateStr)
                .toArray();

            if (oldDocuments.length > 0) {
                const idsToDelete = oldDocuments.map(oldDoc => oldDoc.id);
                await db.ragDocuments.bulkDelete(idsToDelete);
            }

            return oldDocuments.length;
        } catch (cleanupError) {
            console.error('❌ VectorPersistence: Failed to cleanup old documents', cleanupError);
            return 0;
        }
    }
}

export const vectorPersistence = VectorPersistence.getInstance();
