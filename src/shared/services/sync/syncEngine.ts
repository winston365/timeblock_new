/**
 * SyncEngine Re-export
 * 
 * @note SyncEngine은 Dexie Hook에 직접 접근이 필요하므로 src/data/db/infra/에 위치합니다.
 *       기존 import 경로 호환성을 위해 re-export합니다.
 */

export { SyncEngine, syncEngine } from '@/data/db/infra/syncEngine';
