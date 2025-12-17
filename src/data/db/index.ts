/**
 * Database Module Entry Point
 *
 * @role 데이터베이스 초기화 및 유틸리티 함수의 공개 API 제공
 * @description dexieClient의 초기화 관련 함수만 외부에 노출합니다.
 *              db 인스턴스 및 직접 테이블 접근은 repositories를 통해서만 가능합니다.
 * 
 * @note 이 파일은 초기화 함수만 export합니다.
 *       db 인스턴스는 repositories 또는 infra 레이어에서만 접근 가능합니다.
 */

export { initializeDatabase } from './dexieClient';

/**
 * RAGDocumentRecord 타입도 외부에서 필요로 하므로 re-export
 */
export type { RAGDocumentRecord } from './dexieClient';
