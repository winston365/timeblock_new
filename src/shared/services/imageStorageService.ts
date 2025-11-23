/**
 * Image Storage Service
 *
 * @role IndexedDB(Dexie)를 사용하여 이미지를 저장하고 조회하는 서비스
 * @input 이미지 ID, 이미지 데이터 (Blob | string)
 * @output Promise<void> | Promise<Blob | string | undefined>
 */

import { db } from '@/data/db/dexieClient';

export const imageStorageService = {
    /**
     * 이미지 저장
     * @param id 이미지 ID
     * @param data 이미지 데이터 (Blob 또는 Base64 문자열)
     */
    async save(id: string, data: Blob | string): Promise<void> {
        try {
            await db.images.put({ id, data });
        } catch (error) {
            console.error('Failed to save image to IndexedDB:', error);
            throw error;
        }
    },

    /**
     * 이미지 조회
     * @param id 이미지 ID
     * @returns 이미지 데이터 (Blob 또는 Base64 문자열)
     */
    async get(id: string): Promise<Blob | string | undefined> {
        try {
            const record = await db.images.get(id);
            return record?.data;
        } catch (error) {
            console.error('Failed to get image from IndexedDB:', error);
            return undefined;
        }
    },

    /**
     * 이미지 삭제
     * @param id 이미지 ID
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
     * 이미지 존재 여부 확인
     * @param id 이미지 ID
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
