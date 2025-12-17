/**
 * RAGSyncHandler - RAG 인덱싱 동기화 핸들러
 * 
 * @fileoverview
 * Role: Dexie DB 변경 이벤트를 감지하여 RAG 인덱스 자동 동기화
 * 
 * Responsibilities:
 *   - DailyData 변경 감시 (Task, Journal)
 *   - GlobalInbox/CompletedInbox 변경 감시
 *   - 변경된 문서 자동 인덱싱
 *   - 초기 인덱싱 실행 (최근 30일)
 * 
 * Key Dependencies:
 *   - dexieClient: DB 훅 등록 (이 파일은 infra이므로 직접 접근 허용)
 *   - ragService: 문서 인덱싱
 *   - dailyDataRepository: 일일 데이터 조회
 *   - inboxRepository: Inbox 작업 조회
 * 
 * @note 이 파일은 Dexie Hook에 직접 접근이 필요하므로 src/data/db/infra에 위치합니다.
 */
import { db } from '../dexieClient';
import { ragService } from '@/shared/services/rag/ragService';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { loadInboxTasks } from '@/data/repositories/inboxRepository';
import type { Task, DailyData } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';

/**
 * RAG 인덱싱 동기화 핸들러 싱글턴 클래스
 * Dexie DB 훅을 통해 데이터 변경을 감지하고 자동 인덱싱
 */
export class RAGSyncHandler {
    private static instance: RAGSyncHandler;
    private initialized = false;

    private constructor() { }

    /**
     * RAGSyncHandler 싱글턴 인스턴스 반환
     * @returns RAGSyncHandler 인스턴스
     */
    public static getInstance(): RAGSyncHandler {
        if (!RAGSyncHandler.instance) {
            RAGSyncHandler.instance = new RAGSyncHandler();
        }
        return RAGSyncHandler.instance;
    }

    /**
     * DB 훅 초기화 및 초기 인덱싱 시작
     * @returns 초기화 완료 Promise
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        // 1. Listen to DailyData changes (Tasks, Journals)
        db.dailyData.hook('creating', (primKey, dailyDataRecord, transaction) => {
            transaction.on('complete', () => {
                this.indexDailyData(dailyDataRecord as DailyData, primKey as string);
            });
        });

        db.dailyData.hook('updating', (modifications, primKey, existingRecord, transaction) => {
            const updatedData = { ...existingRecord, ...modifications } as DailyData;
            transaction.on('complete', () => {
                this.indexDailyData(updatedData, primKey as string);
            });
        });

        // 2. Listen to Global Inbox changes
        db.globalInbox.hook('creating', (primKey, taskRecord, transaction) => {
            transaction.on('complete', () => {
                this.indexTask(taskRecord as Task, 'inbox');
            });
        });

        db.globalInbox.hook('updating', (modifications, primKey, existingTask, transaction) => {
            const updatedTask = { ...existingTask, ...modifications } as Task;
            transaction.on('complete', () => {
                this.indexTask(updatedTask, 'inbox');
            });
        });

        // 3. Listen to Completed Inbox changes
        db.completedInbox.hook('creating', (primKey, completedTaskRecord, transaction) => {
            transaction.on('complete', () => {
                this.indexTask(completedTaskRecord as Task, 'completed_inbox');
            });
        });

        // Initial Indexing (Background)
        this.runInitialIndexing();
    }

    /**
     * DailyData 인덱싱 (타스크 및 저널)
     * @param dailyData - 일일 데이터
     * @param date - 날짜 (YYYY-MM-DD)
     */
    private async indexDailyData(dailyData: DailyData, date: string) {
        // Index Tasks
        if (dailyData.tasks) {
            for (const task of dailyData.tasks) {
                await this.indexTask(task, date);
            }
        }
        // Index Journal (if exists) - Assuming there's a journal field or similar
        // For now, let's assume tasks are the main thing.
    }

    /**
     * 개별 타스크 인덱싱
     * @param task - 인덱싱할 타스크
     * @param dateOrType - 날짜 문자열 또는 타입 ('inbox', 'completed_inbox')
     */
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
            taskDate = getLocalDate();
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

    /**
     * 초기 인덱싱 실행 (최근 30일 데이터)
     */
    private async runInitialIndexing() {
        // 캐시 상태 확인
        const cacheStats = await ragService.getCacheStats();

        // 인덱싱 통계 초기화
        ragService.resetIndexingStats();

        // 1. Index recent daily data (e.g., last 30 days)
        const recentDailyData = await getRecentDailyData(30);
        for (const dayData of recentDailyData) {
            await this.indexDailyData(dayData, dayData.date);
        }

        // 2. Index Inbox
        const inboxTasks = await loadInboxTasks();
        for (const inboxTask of inboxTasks) {
            await this.indexTask(inboxTask, 'inbox');
        }

        // 3. Index Completed Inbox
        const completedInboxTasks = await db.completedInbox.toArray();
        for (const completedTask of completedInboxTasks) {
            await this.indexTask(completedTask, 'completed_inbox');
        }

        // 인덱싱 결과 로깅 (캐시 상태 정보 포함)
        const indexingStats = ragService.getIndexingStats();
        if (indexingStats.indexed > 0 || cacheStats.count === 0) {
            // 새로 인덱싱된 문서가 있거나 캐시가 비어있을 때만 로깅
        }
    }
}

export const ragSyncHandler = RAGSyncHandler.getInstance();
