/**
 * @file waifuImagePreloader.ts
 *
 * @description 와이푸 이미지를 사전 로드하여 런타임 UX 향상
 *
 * @role 와이푸 이미지 프리로더 - 백그라운드 캐싱
 *
 * @responsibilities
 *   - 모든 호감도 티어별 이미지 사전 로드
 *   - 이미지 존재 여부 캐시 등록 (waifuImageUtils)
 *   - 로드 성공/실패 통계 추적
 *
 * @dependencies
 *   - waifuImageUtils: getAllWaifuImagePaths, markImageAsExisting
 */

import { getAllWaifuImagePaths, markImageAsExisting } from './waifuImageUtils';

/**
 * 모든 와이푸 이미지를 사전 로드합니다.
 * 
 * @returns Promise<void> - 모든 이미지 로드 완료 시 resolve
 * @throws 없음 (개별 이미지 로드 실패는 무시하고 계속 진행)
 * @sideEffects
 *   - 브라우저 캐시에 이미지 프리로드
 *   - waifuImageUtils 캐시에 이미지 존재 여부 등록
 */
export async function preloadWaifuImages(): Promise<void> {
    const imagePromises: Promise<void>[] = [];

    // 모든 유효한 이미지 경로 가져오기 (중복 제거됨)
    const allPaths = getAllWaifuImagePaths();

    for (const imagePath of allPaths) {
        const promise = new Promise<void>((resolve) => {
            const img = new Image();

            img.onload = () => {
                markImageAsExisting(imagePath, true);
                resolve();
            };

            img.onerror = () => {
                markImageAsExisting(imagePath, false);
                resolve();
            };

            img.src = imagePath;
        });

        imagePromises.push(promise);
    }

    // 모든 이미지 로드 완료 대기
    await Promise.all(imagePromises);
}
