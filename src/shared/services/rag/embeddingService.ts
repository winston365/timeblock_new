import { GoogleGenerativeAI } from '@google/generative-ai';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

export enum TaskType {
    RETRIEVAL_DOCUMENT = 'RETRIEVAL_DOCUMENT',
    RETRIEVAL_QUERY = 'RETRIEVAL_QUERY',
}

export class EmbeddingService {
    private static instance: EmbeddingService;
    private genAI: GoogleGenerativeAI | null = null;
    private cache: Map<string, number[]> = new Map();
    private pendingTokens = 0;
    private flushTimeout: NodeJS.Timeout | null = null;

    private constructor() { }

    public static getInstance(): EmbeddingService {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }

    private getClient(): GoogleGenerativeAI {
        if (!this.genAI) {
            const settings = useSettingsStore.getState().settings;
            const apiKey = settings ? settings.geminiApiKey : null;
            if (!apiKey) {
                throw new Error('Gemini API Key is missing');
            }
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
        return this.genAI;
    }

    private flushTokenUsage() {
        if (this.pendingTokens > 0) {
            const tokensToFlush = this.pendingTokens;
            this.pendingTokens = 0;

            // Fire and forget token usage update
            addTokenUsage(0, 0, tokensToFlush).catch(err => console.error('Failed to track embedding tokens', err));
        }
        this.flushTimeout = null;
    }

    private queueTokenUsage(tokens: number) {
        this.pendingTokens += tokens;

        if (!this.flushTimeout) {
            // Debounce for 2 seconds to aggregate rapid updates during indexing
            this.flushTimeout = setTimeout(() => this.flushTokenUsage(), 2000);
        }
    }

    public async getEmbedding(text: string, taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[]> {
        if (!text || text.trim().length === 0) return [];

        // Cache key should include taskType because embedding might differ
        const cacheKey = `${taskType}:${text}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) || [];
        }

        try {
            const client = this.getClient();
            const model = client.getGenerativeModel({ model: 'text-embedding-004' });

            const result = await model.embedContent({
                content: { role: 'user', parts: [{ text }] },
                taskType: taskType as any,
                outputDimensionality: 768, // Explicitly request 768 dimensions
            } as any); // Cast to any to support outputDimensionality if types are outdated

            let embedding = result.embedding.values;

            // Normalize embedding if needed (Gemini docs recommend normalization for reduced dimensions)
            // L2 Normalization: vector / ||vector||
            const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (norm > 0) {
                embedding = embedding.map(val => val / norm);
            }

            // Track token usage (Estimate: 1 token ~ 4 chars)
            const estimatedTokens = Math.ceil(text.length / 4);

            // Queue token usage update instead of immediate call
            this.queueTokenUsage(estimatedTokens);

            // Cache result (limit cache size to prevent memory leaks)
            if (this.cache.size > 1000) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey) this.cache.delete(firstKey);
            }
            this.cache.set(cacheKey, embedding);

            return embedding;
        } catch (error) {
            console.error('❌ EmbeddingService: Failed to generate embedding', error);
            return [];
        }
    }

    public async getEmbeddings(texts: string[], taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[][]> {
        // Gemini API supports batch embedding, but for simplicity and cache usage, we loop
        return await Promise.all(texts.map(text => this.getEmbedding(text, taskType)));
    }
}

export const embeddingService = EmbeddingService.getInstance();
