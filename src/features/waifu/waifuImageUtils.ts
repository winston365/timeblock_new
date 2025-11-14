/**
 * waifuImageUtils - 와이푸 이미지 관리 유틸리티
 * 호감도에 따라 적절한 이미지를 반환합니다.
 */

/**
 * 호감도 구간별 이미지 매핑
 * 호감도 0-100을 6단계로 구분
 */
export const AFFECTION_TIERS = {
  VERY_LOW: { min: 0, max: 10, name: 'very_low', label: '매우 불만' },
  LOW: { min: 11, max: 30, name: 'low', label: '불만' },
  MEDIUM: { min: 31, max: 50, name: 'medium', label: '보통' },
  GOOD: { min: 51, max: 70, name: 'good', label: '좋음' },
  VERY_GOOD: { min: 71, max: 85, name: 'very_good', label: '매우 좋음' },
  MAX: { min: 86, max: 100, name: 'max', label: '최고' },
} as const;

/**
 * 호감도 구간별 포즈 이름
 * public/assets/waifu/poses/ 폴더에 있는 이미지 파일명과 매칭됩니다.
 *
 * 파일명 규칙:
 * - {tier_name}.png 또는 {tier_name}.jpg
 * - 예: very_low.png, low.png, medium.png, good.png, very_good.png, max.png
 */
export const POSE_IMAGES = {
  very_low: '/assets/waifu/poses/very_low.png',
  low: '/assets/waifu/poses/low.png',
  medium: '/assets/waifu/poses/medium.png',
  good: '/assets/waifu/poses/good.png',
  very_good: '/assets/waifu/poses/very_good.png',
  max: '/assets/waifu/poses/max.png',
} as const;

/**
 * 기본 이미지 (호감도 이미지가 없을 때 사용)
 */
export const DEFAULT_IMAGE = '/assets/waifu/default.png';

/**
 * 호감도 값에 따라 적절한 구간을 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 호감도 구간 객체
 */
export function getAffectionTier(affection: number) {
  if (affection <= AFFECTION_TIERS.VERY_LOW.max) return AFFECTION_TIERS.VERY_LOW;
  if (affection <= AFFECTION_TIERS.LOW.max) return AFFECTION_TIERS.LOW;
  if (affection <= AFFECTION_TIERS.MEDIUM.max) return AFFECTION_TIERS.MEDIUM;
  if (affection <= AFFECTION_TIERS.GOOD.max) return AFFECTION_TIERS.GOOD;
  if (affection <= AFFECTION_TIERS.VERY_GOOD.max) return AFFECTION_TIERS.VERY_GOOD;
  return AFFECTION_TIERS.MAX;
}

/**
 * 호감도에 따른 이미지 경로를 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 이미지 경로
 */
export function getWaifuImagePath(affection: number): string {
  const tier = getAffectionTier(affection);
  return POSE_IMAGES[tier.name as keyof typeof POSE_IMAGES] || DEFAULT_IMAGE;
}

/**
 * 이미지가 로드 가능한지 확인합니다.
 *
 * @param imagePath - 이미지 경로
 * @returns Promise<boolean> - 이미지 로드 가능 여부
 */
export async function checkImageExists(imagePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = imagePath;
  });
}

/**
 * 호감도에 따른 이미지 경로를 반환하며, 이미지가 없으면 기본 이미지를 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns Promise<string> - 이미지 경로
 */
export async function getWaifuImagePathWithFallback(affection: number): Promise<string> {
  const primaryPath = getWaifuImagePath(affection);

  // 이미지가 존재하는지 확인
  const exists = await checkImageExists(primaryPath);

  if (exists) {
    return primaryPath;
  }

  // 기본 이미지 확인
  const defaultExists = await checkImageExists(DEFAULT_IMAGE);

  if (defaultExists) {
    return DEFAULT_IMAGE;
  }

  // 모든 이미지가 없으면 빈 문자열 반환 (플레이스홀더 표시)
  return '';
}

/**
 * 호감도 구간별 색상을 반환합니다.
 * CSS 변수나 직접 색상 사용 가능
 *
 * @param affection - 호감도 (0-100)
 * @returns 색상 값 (hex)
 */
export function getAffectionColor(affection: number): string {
  if (affection <= 10) return '#ef4444'; // Red
  if (affection <= 30) return '#f97316'; // Orange
  if (affection <= 50) return '#f59e0b'; // Amber
  if (affection <= 70) return '#10b981'; // Green
  if (affection <= 85) return '#3b82f6'; // Blue
  return '#ec4899'; // Pink
}

/**
 * 호감도 구간 레이블을 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 구간 레이블 (예: "매우 좋음")
 */
export function getAffectionLabel(affection: number): string {
  const tier = getAffectionTier(affection);
  return tier.label;
}
