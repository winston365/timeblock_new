/**
 * useCanvasImage - IndexedDB 이미지 로딩 훅
 *
 * @role IndexedDB에 저장된 이미지를 비동기로 로드하여 UI에서 사용 가능한 URL 형태로 변환
 * @responsibilities
 *   - 이미지 ID로 IndexedDB에서 이미지 데이터 조회
 *   - Blob 데이터를 Object URL로 변환
 *   - 컴포넌트 언마운트 시 Object URL 해제 (메모리 누수 방지)
 *   - 로딩 상태 및 에러 상태 관리
 * @external_dependencies
 *   - react: useState, useEffect hooks
 *   - imageStorageService: IndexedDB 이미지 저장소 서비스
 */

import { useState, useEffect } from 'react';
import { imageStorageService } from '@/shared/services/imageStorageService';

/**
 * IndexedDB에서 이미지를 비동기로 로드하는 커스텀 훅
 *
 * @param {string | null} imageId - 조회할 이미지 ID (null이면 이미지 없음)
 * @returns {object} 이미지 로딩 상태 객체
 * @returns {string | null} imageSrc - 이미지 소스 URL (Blob URL 또는 Base64)
 * @returns {boolean} isLoading - 로딩 중 여부
 * @returns {Error | null} error - 로드 실패 시 에러 객체
 * @sideEffects
 *   - Blob URL 생성/해제
 *   - imageStorageService를 통한 IndexedDB 조회
 *
 * @example
 * ```tsx
 * const { imageSrc, isLoading, error } = useCanvasImage('image-123');
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 * return <img src={imageSrc} />;
 * ```
 */
export function useCanvasImage(imageId: string | null) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!imageId) {
            setImageSrc(null);
            return;
        }

        let objectUrl: string | null = null;
        let isMounted = true;

        const loadImage = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const imageData = await imageStorageService.get(imageId);

                if (!isMounted) return;

                if (imageData) {
                    if (imageData instanceof Blob) {
                        objectUrl = URL.createObjectURL(imageData);
                        setImageSrc(objectUrl);
                    } else {
                        // string (Base64)
                        setImageSrc(imageData);
                    }
                } else {
                    setImageSrc(null);
                }
            } catch (err) {
                if (isMounted) {
                    console.error(`Failed to load image ${imageId}:`, err);
                    setError(err as Error);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadImage();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [imageId]);

    return { imageSrc, isLoading, error };
}
