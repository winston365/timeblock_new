import { useState, useEffect } from 'react';
import { imageStorageService } from '@/shared/services/imageStorageService';

/**
 * IndexedDB에서 이미지를 비동기로 로드하는 커스텀 훅
 * @param imageId 이미지 ID
 * @returns 이미지 소스 URL (Blob URL 또는 Base64)
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
                const data = await imageStorageService.get(imageId);

                if (!isMounted) return;

                if (data) {
                    if (data instanceof Blob) {
                        objectUrl = URL.createObjectURL(data);
                        setImageSrc(objectUrl);
                    } else {
                        // string (Base64)
                        setImageSrc(data);
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
