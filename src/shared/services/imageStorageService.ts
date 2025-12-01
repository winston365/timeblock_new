/**
 * Image Storage Service
 *
 * @fileoverview IndexedDB(Dexie)를 사용하여 이미지를 저장하고 조회하는 서비스 모듈
 *
 * @role 이미지 데이터의 로컬 영속화 관리
 * @responsibilities
 *   - 이미지 저장 (Blob 또는 Base64 문자열)
 *   - 이미지 조회
 *   - 이미지 삭제
 *   - 이미지 존재 여부 확인
 *
 * @dependencies
 *   - dexieClient: IndexedDB 접근을 위한 Dexie 인스턴스 (images 테이블)
 */

import { db } from '@/data/db/dexieClient';

export const imageStorageService = {
    /**
     * 이미지를 IndexedDB에 저장합니다.
     *
     * @param id - 이미지 고유 식별자
     * @param imageData - 이미지 데이터 (Blob 또는 Base64 문자열)
     * @returns 저장 완료 시 resolve되는 Promise
     * @throws 저장 실패 시 에러를 throw
     */
    async save(id: string, imageData: Blob | string): Promise<void> {
        try {
            await db.images.put({ id, data: imageData });
        } catch (error) {
            console.error('Failed to save image to IndexedDB:', error);
            throw error;
        }
    },

    /**
     * IndexedDB에서 이미지를 조회합니다.
     *
     * @param id - 이미지 고유 식별자
     * @returns 이미지 데이터 (Blob 또는 Base64 문자열), 존재하지 않으면 undefined
     */
    async get(id: string): Promise<Blob | string | undefined> {
        try {
            const imageRecord = await db.images.get(id);
            return imageRecord?.data;
        } catch (error) {
            console.error('Failed to get image from IndexedDB:', error);
            return undefined;
        }
    },

    /**
     * IndexedDB에서 이미지를 삭제합니다.
     *
     * @param id - 삭제할 이미지의 고유 식별자
     * @returns 삭제 완료 시 resolve되는 Promise
     * @throws 삭제 실패 시 에러를 throw
     */
    async delete(id: string): Promise<void> {
        try {
            await db.images.delete(id);
        } catch (error) {
            console.error('Failed to delete image from IndexedDB:', error);
            throw error;
        }
    },

    /**
     * 이미지의 존재 여부를 확인합니다.
     *
     * @param id - 확인할 이미지의 고유 식별자
     * @returns 이미지가 존재하면 true, 아니면 false
     */
    async exists(id: string): Promise<boolean> {
        try {
            const count = await db.images.where('id').equals(id).count();
            return count > 0;
        } catch (error) {
            console.error('Failed to check image existence:', error);
            return false;
        }
    }
};
