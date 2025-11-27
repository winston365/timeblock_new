import { db } from '@/data/db/dexieClient';
import { ragService } from './ragService';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { loadInboxTasks } from '@/data/repositories/inboxRepository';
import type { Task, DailyData } from '@/shared/types/domain';

export class RAGSyncHandler {
    private static instance: RAGSyncHandler;
    private initialized = false;

    private constructor() { }

    public static getInstance(): RAGSyncHandler {
        if (!RAGSyncHandler.instance) {
            RAGSyncHandler.instance = new RAGSyncHandler();
        }
        return RAGSyncHandler.instance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        console.log('🔄 RAGSyncHandler: Initializing hooks...');

        // 1. Listen to DailyData changes (Tasks, Journals)
        db.dailyData.hook('creating', (primKey, obj, transaction) => {
            transaction.on('complete', () => {
                this.indexDailyData(obj as DailyData, primKey as string);
            });
        });

        db.dailyData.hook('updating', (modifications, primKey, obj, transaction) => {
            const updated = { ...obj, ...modifications } as DailyData;
            transaction.on('complete', () => {
                this.indexDailyData(updated, primKey as string);
            });
        });

        // 2. Listen to Global Inbox changes
        db.globalInbox.hook('creating', (primKey, obj, transaction) => {
            transaction.on('complete', () => {
                this.indexTask(obj as Task, 'inbox');
            });
        });

        db.globalInbox.hook('updating', (modifications, primKey, obj, transaction) => {
            const updated = { ...obj, ...modifications } as Task;
            transaction.on('complete', () => {
                this.indexTask(updated, 'inbox');
            });
        });

        // 3. Listen to Completed Inbox changes
        db.completedInbox.hook('creating', (primKey, obj, transaction) => {
            transaction.on('complete', () => {
                this.indexTask(obj as Task, 'completed_inbox');
            });
        });

        // Initial Indexing (Background)
        this.runInitialIndexing();
    }

    private async indexDailyData(data: DailyData, date: string) {
        // Index Tasks
        if (data.tasks) {
            for (const task of data.tasks) {
                await this.indexTask(task, date);
            }
        }
        // Index Journal (if exists) - Assuming there's a journal field or similar
        // For now, let's assume tasks are the main thing.
    }

    private async indexTask(task: Task, dateOrType: string) {
        if (!task.text) return;

        // 날짜 결정 로직:
        // 1. 완료된 작업: completedAt에서 날짜 추출
        // 2. dailyData 작업: dateOrType이 YYYY-MM-DD 형식으로 전달됨
        // 3. inbox 작업: 현재 날짜 사용 (작업이 언제든 수행 가능)
        let taskDate: string;
        
        if (task.completedAt) {
            // completedAt이 있으면 완료된 날짜 사용 (ISO 8601 형식에서 날짜 부분 추출)
            taskDate = task.completedAt.slice(0, 10);
        } else if (dateOrType === 'inbox' || dateOrType === 'completed_inbox') {
            // inbox나 completed_inbox 타입이지만 completedAt이 없는 경우
            taskDate = new Date().toISOString().split('T')[0];
        } else {
            // dailyData에서 온 작업 (dateOrType이 날짜 문자열)
            taskDate = dateOrType;
        }

        await ragService.indexDocument({
            id: task.id,
            type: 'task',
            content: `${task.text} ${task.memo || ''}`,
            date: taskDate,
            completed: task.completed ?? false,  // 최상위 레벨에 completed 필드 추가
            metadata: {
                completed: task.completed,
                timeBlock: task.timeBlock,
                completedAt: task.completedAt,
            }
        });
    }

    private async runInitialIndexing() {
        console.log('🔍 RAG: Starting initial indexing...');

        // 캐시 상태 확인
        const cacheStats = await ragService.getCacheStats();
        console.log(`📦 RAG: Cache has ${cacheStats.count} documents, restored: ${cacheStats.restoredFromCache}`);

        // 인덱싱 통계 초기화
        ragService.resetIndexingStats();

        // 1. Index recent daily data (e.g., last 30 days)
        const recentData = await getRecentDailyData(30);
        console.log(`🔍 RAG: Found ${recentData.length} days of recent data`);
        let taskCount = 0;
        for (const day of recentData) {
            if (day.tasks) taskCount += day.tasks.length;
            await this.indexDailyData(day, day.date);
        }
        console.log(`🔍 RAG: Processed ${taskCount} tasks from daily data`);

        // 2. Index Inbox
        const inboxTasks = await loadInboxTasks();
        console.log(`🔍 RAG: Processing ${inboxTasks.length} inbox tasks`);
        for (const task of inboxTasks) {
            await this.indexTask(task, 'inbox');
        }

        // 3. Index Completed Inbox
        const completedInboxTasks = await db.completedInbox.toArray();
        console.log(`🔍 RAG: Processing ${completedInboxTasks.length} completed inbox tasks`);
        for (const task of completedInboxTasks) {
            await this.indexTask(task, 'completed_inbox');
        }

        // 인덱싱 결과 출력
        const stats = ragService.getIndexingStats();
        console.log(`✅ RAG: Initial indexing complete. New: ${stats.indexed}, Skipped (unchanged): ${stats.skipped}`);
    }
}

export const ragSyncHandler = RAGSyncHandler.getInstance();
