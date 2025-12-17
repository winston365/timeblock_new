/**
 * imageRepository.ts
 *
 * @role 이미지 데이터 영속화 관리
 * @description IndexedDB images 테이블에 대한 CRUD 연산 제공
 */

import { db } from '../db/dexieClient';

/**
 * 이미지를 IndexedDB에 저장합니다.
 *
 * @param id - 이미지 고유 식별자
 * @param imageData - 이미지 데이터 (Blob 또는 Base64 문자열)
 * @returns 저장 완료 시 resolve되는 Promise
 * @throws 저장 실패 시 에러를 throw
 */
export async function saveImage(id: string, imageData: Blob | string): Promise<void> {
    await db.images.put({ id, data: imageData });
}

/**
 * IndexedDB에서 이미지를 조회합니다.
 *
 * @param id - 이미지 고유 식별자
 * @returns 이미지 데이터 (Blob 또는 Base64 문자열), 존재하지 않으면 undefined
 */
export async function getImage(id: string): Promise<Blob | string | undefined> {
    const imageRecord = await db.images.get(id);
    return imageRecord?.data;
}

/**
 * IndexedDB에서 이미지를 삭제합니다.
 *
 * @param id - 삭제할 이미지의 고유 식별자
 * @returns 삭제 완료 시 resolve되는 Promise
 */
export async function deleteImage(id: string): Promise<void> {
    await db.images.delete(id);
}

/**
 * 이미지의 존재 여부를 확인합니다.
 *
 * @param id - 확인할 이미지의 고유 식별자
 * @returns 이미지가 존재하면 true, 아니면 false
 */
export async function imageExists(id: string): Promise<boolean> {
    const count = await db.images.where('id').equals(id).count();
    return count > 0;
}
