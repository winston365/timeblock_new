/**
 * RAG 벡터 영구 저장 서비스
 * 
 * Dexie(IndexedDB)를 활용하여 벡터 데이터를 영구 저장하고,
 * 앱 재시작 시 Orama DB로 복원합니다.
 * 변경되지 않은 문서는 재인덱싱하지 않습니다.
 */

import { db, type RAGDocumentRecord } from '@/data/db/dexieClient';
import type { RAGDocument } from './vectorStore';

/**
 * 문자열의 간단한 해시 생성 (변경 감지용)
 */
function hashContent(content: string, completed: boolean): string {
    const str = `${content}:${completed}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

export class VectorPersistence {
    private static instance: VectorPersistence;

    private constructor() { }

    public static getInstance(): VectorPersistence {
        if (!VectorPersistence.instance) {
            VectorPersistence.instance = new VectorPersistence();
        }
        return VectorPersistence.instance;
    }

    /**
     * 문서가 이미 인덱싱되어 있고 변경되지 않았는지 확인
     */
    public async isDocumentUnchanged(id: string, content: string, completed: boolean): Promise<boolean> {
        try {
            const existing = await db.ragDocuments.get(id);
            if (!existing) return false;

            const newHash = hashContent(content, completed);
            return existing.contentHash === newHash;
        } catch (error) {
            console.warn('⚠️ VectorPersistence: Failed to check document', error);
            return false;
        }
    }

    /**
     * 문서를 영구 저장소에 저장
     */
    public async saveDocument(doc: RAGDocument): Promise<void> {
        if (!doc.embedding) {
            console.warn('⚠️ VectorPersistence: Document has no embedding, skipping save');
            return;
        }

        try {
            const record: RAGDocumentRecord = {
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

            await db.ragDocuments.put(record);
        } catch (error) {
            console.error('❌ VectorPersistence: Failed to save document', error);
        }
    }

    /**
     * 여러 문서를 일괄 저장
     */
    public async saveDocuments(docs: RAGDocument[]): Promise<void> {
        const records: RAGDocumentRecord[] = docs
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

        if (records.length > 0) {
            await db.ragDocuments.bulkPut(records);
        }
    }

    /**
     * 저장된 모든 문서 로드 (앱 시작 시 복원용)
     */
    public async loadAllDocuments(): Promise<RAGDocument[]> {
        try {
            const records = await db.ragDocuments.toArray();
            console.log(`📦 VectorPersistence: Loaded ${records.length} cached documents`);

            return records.map(record => ({
                id: record.id,
                type: record.type,
                content: record.content,
                date: record.date,
                completed: record.completed,
                metadata: JSON.parse(record.metadata),
                embedding: record.embedding,
            }));
        } catch (error) {
            console.error('❌ VectorPersistence: Failed to load documents', error);
            return [];
        }
    }

    /**
     * 특정 문서의 저장된 데이터 가져오기 (임베딩 포함)
     */
    public async getDocument(id: string): Promise<RAGDocument | null> {
        try {
            const record = await db.ragDocuments.get(id);
            if (!record) return null;

            return {
                id: record.id,
                type: record.type,
                content: record.content,
                date: record.date,
                completed: record.completed,
                metadata: JSON.parse(record.metadata),
                embedding: record.embedding,
            };
        } catch (error) {
            console.warn('⚠️ VectorPersistence: Failed to get document', error);
            return null;
        }
    }

    /**
     * 문서 삭제
     */
    public async deleteDocument(id: string): Promise<void> {
        try {
            await db.ragDocuments.delete(id);
        } catch (error) {
            console.warn('⚠️ VectorPersistence: Failed to delete document', error);
        }
    }

    /**
     * 모든 저장된 문서 삭제 (캐시 초기화)
     */
    public async clearAll(): Promise<void> {
        try {
            await db.ragDocuments.clear();
            console.log('🗑️ VectorPersistence: Cleared all cached documents');
        } catch (error) {
            console.error('❌ VectorPersistence: Failed to clear documents', error);
        }
    }

    /**
     * 저장된 문서 수 확인
     */
    public async getDocumentCount(): Promise<number> {
        try {
            return await db.ragDocuments.count();
        } catch (error) {
            return 0;
        }
    }

    /**
     * 오래된 문서 정리 (선택적, 30일 이상)
     */
    public async cleanupOldDocuments(daysToKeep: number = 60): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffStr = cutoffDate.toISOString().split('T')[0];

            const oldDocs = await db.ragDocuments
                .where('date')
                .below(cutoffStr)
                .toArray();

            if (oldDocs.length > 0) {
                const idsToDelete = oldDocs.map(d => d.id);
                await db.ragDocuments.bulkDelete(idsToDelete);
                console.log(`🧹 VectorPersistence: Cleaned up ${idsToDelete.length} old documents`);
            }

            return oldDocs.length;
        } catch (error) {
            console.error('❌ VectorPersistence: Failed to cleanup old documents', error);
            return 0;
        }
    }
}

export const vectorPersistence = VectorPersistence.getInstance();
