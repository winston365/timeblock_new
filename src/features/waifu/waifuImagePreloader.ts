/**
 * waifuImagePreloader
 *
 * @role 와이푸 이미지를 사전 로드하여 런타임 UX 향상
 * @input 없음 (IMAGE_FILES from waifuImageUtils)
 * @output Promise<void> - 모든 이미지 프리로드 완료
 * @external_dependencies
 *   - waifuImageUtils: IMAGE_FILES 상수
 */

import { getWaifuImagePath, getAffectionTier, AFFECTION_TIERS } from './waifuImageUtils';

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

    // 각 호감도 티어별로 이미지 프리로드
    const tiers = Object.values(AFFECTION_TIERS);

    for (const tier of tiers) {
        // 각 티어의 중간값으로 호감도 설정 (해당 티어의 이미지를 가져오기 위함)
        const affection = (tier.min + tier.max) / 2;

        // 각 티어당 최소 4개 이미지 프리로드 (대부분 티어가 4개 이상 보유)
        for (let i = 0; i < 8; i++) {
            const imagePath = getWaifuImagePath(affection, i);

            const promise = new Promise<void>((resolve) => {
                const img = new Image();

                img.onload = () => {
                    successCount++;
                    resolve();
                };

                img.onerror = () => {
                    // 이미지 로드 실패는 조용히 처리 (일부 인덱스는 존재하지 않을 수 있음)
                    failCount++;
                    resolve();
                };

                img.src = imagePath;
            });

            imagePromises.push(promise);
        }
    }

    // 모든 이미지 로드 완료 대기
    await Promise.all(imagePromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[Waifu Preloader] Preload complete! Success: ${successCount}, Failed: ${failCount}, Duration: ${duration}ms`);
}
