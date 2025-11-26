import { vectorStore } from '../src/shared/services/rag/vectorStore';
import { embeddingService } from '../src/shared/services/rag/embeddingService';
import { ragService } from '../src/shared/services/rag/ragService';

async function verifyRAG() {
    console.log('🚀 Starting RAG Verification...');

    try {
        // 1. Test VectorStore Initialization
        console.log('\n1️⃣ Testing VectorStore Initialization...');
        await vectorStore.initialize();
        console.log('✅ VectorStore Initialized');

        // 2. Test Embedding Generation (Mocking API key if needed, or assuming env)
        // Note: This might fail if run outside of app context without API key in store.
        // For this script, we might need to mock the store or just skip if no key.
        console.log('\n2️⃣ Testing Embedding Service...');
        // We can't easily test this without mocking the store or having a key.
        // Let's assume it works if the file compiles, or we can try to mock it.
        console.log('⚠️ Skipping actual API call in script (requires store setup)');

        // 3. Test Indexing
        console.log('\n3️⃣ Testing Indexing...');
        const testDoc = {
            id: 'test-1',
            type: 'task' as const,
            content: 'Buy milk and eggs',
            date: '2023-10-27',
            metadata: { completed: false }
        };
        await ragService.indexDocument(testDoc);
        console.log('✅ Document Indexed');

        // 4. Test Search
        console.log('\n4️⃣ Testing Search...');
        const results = await ragService.search('milk');
        console.log('Results:', results);

        if (results.length > 0 && results[0].content.includes('milk')) {
            console.log('✅ Search Successful');
        } else {
            console.error('❌ Search Failed');
        }

        // 5. Test Context Generation
        console.log('\n5️⃣ Testing Context Generation...');
        const context = await ragService.generateContext('eggs');
        console.log('Context:', context);

        if (context.includes('Buy milk and eggs')) {
            console.log('✅ Context Generation Successful');
        } else {
            console.error('❌ Context Generation Failed');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    }
}

verifyRAG();
