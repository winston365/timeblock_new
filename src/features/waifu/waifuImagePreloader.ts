/**
 * waifuImagePreloader
 *
 * @role 와이푸 이미지를 사전 로드하여 런타임 UX 향상
 * @input 없음 (IMAGE_FILES from waifuImageUtils)
 * @output Promise<void> - 모든 이미지 프리로드 완료
 * @external_dependencies
 *   - waifuImageUtils: IMAGE_FILES 상수
 */

import { getAllWaifuImagePaths, markImageAsExisting } from './waifuImageUtils';

/**
 * 모든 와이푸 이미지를 사전 로드합니다.
 * 
 * @returns Promise<void> - 모든 이미지 로드 완료 시 resolve
 * @throws 없음 (개별 이미지 로드 실패는 로그만 남기고 계속 진행)
 * @sideEffects
 *   - 브라우저 캐시에 이미지 프리로드
 *   - 콘솔에 로드 진행 상황 로깅
 */
export async function preloadWaifuImages(): Promise<void> {
    console.log('[Waifu Preloader] Starting image preload...');

    const startTime = Date.now();
    const imagePromises: Promise<void>[] = [];
    let successCount = 0;
    let failCount = 0;

    // 모든 유효한 이미지 경로 가져오기 (중복 제거됨)
    const allPaths = getAllWaifuImagePaths();

    for (const imagePath of allPaths) {
        const promise = new Promise<void>((resolve) => {
            const img = new Image();

            img.onload = () => {
                successCount++;
                markImageAsExisting(imagePath, true);
                resolve();
            };

            img.onerror = () => {
                failCount++;
                markImageAsExisting(imagePath, false);
                resolve();
            };

            img.src = imagePath;
        });

        imagePromises.push(promise);
    }

    // 모든 이미지 로드 완료 대기
    await Promise.all(imagePromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[Waifu Preloader] Preload complete! Success: ${successCount}, Failed: ${failCount}, Duration: ${duration}ms`);
}
