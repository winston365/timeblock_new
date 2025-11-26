import { vectorStore, type RAGDocument } from './vectorStore';
import { embeddingService, TaskType } from './embeddingService';

export class RAGService {
    private static instance: RAGService;

    private constructor() { }

    public static getInstance(): RAGService {
        if (!RAGService.instance) {
            RAGService.instance = new RAGService();
        }
        return RAGService.instance;
    }

    public async initialize(): Promise<void> {
        await vectorStore.initialize();
    }

    public async indexDocument(doc: Omit<RAGDocument, 'embedding'>): Promise<void> {
        // Generate embedding for the document content
        // Use RETRIEVAL_DOCUMENT task type
        const embedding = await embeddingService.getEmbedding(doc.content, TaskType.RETRIEVAL_DOCUMENT);

        const docWithEmbedding: RAGDocument = {
            ...doc,
            embedding
        };

        await vectorStore.addDocument(docWithEmbedding);
    }

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
            console.log(`🔍 RAG: Detected date in query: ${dateFilter}`);
        }

        // Extract completed status from query ("완료", "끝낸", "마친" 등)
        let completedFilter: boolean | undefined;
        if (/완료|끝낸|마친|했던|수행한|처리한/.test(query)) {
            completedFilter = true;
            console.log(`🔍 RAG: Detected completed filter in query`);
        } else if (/미완료|안한|못한|남은|pending/.test(query)) {
            completedFilter = false;
            console.log(`🔍 RAG: Detected pending filter in query`);
        }

        // Search with filters
        let results = await vectorStore.search(query, limit, undefined, queryEmbedding, dateFilter, completedFilter);

        // If no results with date filter, try without date filter but keep completed filter
        if (results.hits.length === 0 && dateFilter) {
            console.log(`🔍 RAG: No results with date filter, trying without date filter...`);
            results = await vectorStore.search(query, limit * 2, undefined, queryEmbedding, undefined, completedFilter);
            
            // Then filter results by date in post-processing
            if (dateFilter) {
                results.hits = results.hits.filter(hit => {
                    const doc = hit.document as RAGDocument;
                    return doc.date === dateFilter;
                });
            }
        }

        return results.hits.map(hit => hit.document as RAGDocument);
    }

    public async generateContext(query: string): Promise<string> {
        console.log(`🔍 RAG: Generating context for query: "${query}"`);
        const docs = await this.search(query, 20);
        console.log(`🔍 RAG: Found ${docs.length} documents`);

        if (docs.length === 0) return '';

        // 날짜별로 그룹화하여 더 명확한 컨텍스트 생성
        const docsByDate: Record<string, RAGDocument[]> = {};
        docs.forEach(doc => {
            if (!docsByDate[doc.date]) docsByDate[doc.date] = [];
            docsByDate[doc.date].push(doc);
        });

        const contextParts: string[] = [];
        
        // 날짜순 정렬 (최신 순)
        const sortedDates = Object.keys(docsByDate).sort().reverse();
        
        for (const date of sortedDates) {
            const dateDocs = docsByDate[date];
            const completedDocs = dateDocs.filter(d => d.completed);
            const pendingDocs = dateDocs.filter(d => !d.completed);
            
            contextParts.push(`\n📅 ${date}:`);
            
            if (completedDocs.length > 0) {
                contextParts.push(`  ✅ 완료된 작업 (${completedDocs.length}개):`);
                completedDocs.forEach(doc => {
                    contextParts.push(`    - ${doc.content.trim()}`);
                });
            }
            
            if (pendingDocs.length > 0) {
                contextParts.push(`  ⏳ 미완료 작업 (${pendingDocs.length}개):`);
                pendingDocs.forEach(doc => {
                    contextParts.push(`    - ${doc.content.trim()}`);
                });
            }
        }

        return contextParts.join('\n');
    }

    public async debugGetAllDocs(): Promise<any[]> {
        return await vectorStore.getAllDocs();
    }
}

export const ragService = RAGService.getInstance();
