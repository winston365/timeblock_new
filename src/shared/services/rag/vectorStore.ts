import { create, insert, search, remove, type Orama, type Results } from '@orama/orama';

export interface RAGDocument {
    id: string;
    type: 'task' | 'journal' | 'goal' | 'insight';
    content: string;
    date: string;
    completed?: boolean;  // 작업 완료 여부 (검색 필터용)
    metadata?: Record<string, any>;
    embedding?: number[];
}

export class VectorStore {
    private static instance: VectorStore;
    private db: Orama<any> | null = null;
    private initialized = false;

    private constructor() { }

    public static getInstance(): VectorStore {
        if (!VectorStore.instance) {
            VectorStore.instance = new VectorStore();
        }
        return VectorStore.instance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        this.db = await create({
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
        console.log('✅ VectorStore: Initialized Orama DB with Vector Schema');
    }

    public async addDocument(doc: RAGDocument): Promise<string> {
        if (!this.db) await this.initialize();

        // Upsert: Search for existing document by our custom 'id' field
        const searchResult = await search(this.db!, {
            term: doc.id,
            properties: ['id'],
            exact: true,
            limit: 1
        });

        if (searchResult.count > 0 && searchResult.hits.length > 0) {
            // Found existing document, remove it using its INTERNAL ID
            const internalId = searchResult.hits[0].id;
            try {
                await remove(this.db!, internalId);
            } catch (e) {
                console.warn('⚠️ VectorStore: Failed to remove existing document during upsert', e);
            }
        }

        const docToInsert = {
            ...doc,
            completed: doc.completed ?? false,  // boolean 필드 기본값 보장
            metadata: JSON.stringify(doc.metadata || {})
        };

        // Insert new document (Orama generates a new internal ID)
        return await insert(this.db!, docToInsert);
    }

    public async addDocuments(docs: RAGDocument[]): Promise<string[]> {
        if (!this.db) await this.initialize();

        // For batch, we process one by one to handle upserts correctly
        return await Promise.all(docs.map(doc => this.addDocument(doc)));
    }

    public async search(query: string, limit: number = 5, type?: string, vector?: number[], date?: string, completed?: boolean): Promise<Results<any>> {
        if (!this.db) await this.initialize();

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

        const where: any = {};
        if (type) where.type = type;
        if (date) where.date = date;
        if (completed !== undefined) where.completed = completed;

        if (Object.keys(where).length > 0) {
            searchParams.where = where;
        }

        try {
            return await search(this.db!, searchParams);
        } catch (error) {
            console.warn('⚠️ VectorStore: Vector search failed, falling back to keyword search', error);
            // Fallback to keyword search if vector search fails (e.g. schema mismatch)
            delete searchParams.mode;
            delete searchParams.vector;
            delete searchParams.similarity;
            return await search(this.db!, searchParams);
        }
    }

    public async clear(): Promise<void> {
        this.initialized = false;
        await this.initialize();
    }

    public async getAllDocs(): Promise<any[]> {
        if (!this.db) return [];
        const result = await search(this.db, {
            term: '',
            limit: 1000, // Arbitrary large limit for debugging
        });
        return result.hits.map(hit => hit.document);
    }

    public isInitialized(): boolean {
        return this.initialized;
    }
}

export const vectorStore = VectorStore.getInstance();
