/**
 * waifuImageUtils - 와이푸 이미지 관리 유틸리티
 * 호감도에 따라 적절한 이미지를 반환합니다.
 * 4번 클릭 또는 10분마다 같은 호감도 범위 내에서 랜덤 이미지로 변경됩니다.
 */

/**
 * 호감도 구간별 이미지 매핑
 * 호감도 0-100을 6단계로 구분
 */
export const AFFECTION_TIERS = {
  HOSTILE: { min: 0, max: 20, name: 'hostile', label: '혐오, 적대', mood: '😡' },
  WARY: { min: 20, max: 40, name: 'wary', label: '경계, 혐오감 완화', mood: '😠' },
  INDIFFERENT: { min: 40, max: 55, name: 'indifferent', label: '무관심, 냉담', mood: '😐' },
  INTERESTED: { min: 55, max: 70, name: 'interested', label: '관심, 경계 풀림', mood: '🙂' },
  AFFECTIONATE: { min: 70, max: 85, name: 'affectionate', label: '호감, 친근', mood: '😊' },
  LOVING: { min: 85, max: 100, name: 'loving', label: '애정, 헌신', mood: '🥰' },
} as const;

/**
 * 호감도 구간별 포즈 이미지 폴더
 * public/assets/waifu/poses/ 폴더에 있는 이미지 파일명과 매칭됩니다.
 *
 * 폴더 구조 예시:
 * poses/
 *   ├── hostile/
 *   │   ├── 1.png
 *   │   ├── 2.png
 *   │   └── 3.png
 *   ├── wary/
 *   │   ├── 1.png
 *   │   └── 2.png
 *   ...
 *
 * 또는 단일 파일:
 *   ├── hostile.png
 *   ├── wary.png
 *   ...
 */

// 각 호감도 구간별로 사용 가능한 이미지 개수 (확장 가능)
const IMAGE_COUNTS: Record<string, number> = {
  hostile: 3,      // hostile 폴더에 1.png, 2.png, 3.png
  wary: 3,
  indifferent: 3,
  interested: 3,
  affectionate: 3,
  loving: 3,
};

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
  if (affection < AFFECTION_TIERS.WARY.min) return AFFECTION_TIERS.HOSTILE;
  if (affection < AFFECTION_TIERS.INDIFFERENT.min) return AFFECTION_TIERS.WARY;
  if (affection < AFFECTION_TIERS.INTERESTED.min) return AFFECTION_TIERS.INDIFFERENT;
  if (affection < AFFECTION_TIERS.AFFECTIONATE.min) return AFFECTION_TIERS.INTERESTED;
  if (affection < AFFECTION_TIERS.LOVING.min) return AFFECTION_TIERS.AFFECTIONATE;
  return AFFECTION_TIERS.LOVING;
}

/**
 * 호감도 구간 내에서 랜덤 이미지 번호를 생성합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @returns 랜덤 이미지 번호 (1부터 시작)
 */
export function getRandomImageNumber(tierName: string): number {
  const count = IMAGE_COUNTS[tierName] || 1;
  return Math.floor(Math.random() * count) + 1;
}

/**
 * 호감도에 따른 이미지 경로를 반환합니다.
 * 폴더 구조를 우선 확인하고, 없으면 단일 파일 확인
 *
 * @param affection - 호감도 (0-100)
 * @param imageNumber - 이미지 번호 (선택적, 기본값은 랜덤)
 * @returns 이미지 경로
 */
export function getWaifuImagePath(affection: number, imageNumber?: number): string {
  const tier = getAffectionTier(affection);
  const imgNum = imageNumber ?? getRandomImageNumber(tier.name);

  // 폴더 구조: /assets/waifu/poses/hostile/1.png
  return `/assets/waifu/poses/${tier.name}/${imgNum}.png`;
}

/**
 * 폴백으로 단일 파일 경로를 반환합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @returns 단일 파일 이미지 경로
 */
export function getSingleFileImagePath(tierName: string): string {
  return `/assets/waifu/poses/${tierName}.png`;
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
 * @param imageNumber - 이미지 번호 (선택적)
 * @returns Promise<string> - 이미지 경로
 */
export async function getWaifuImagePathWithFallback(
  affection: number,
  imageNumber?: number
): Promise<string> {
  const tier = getAffectionTier(affection);

  // 1. 폴더 구조 시도
  const primaryPath = getWaifuImagePath(affection, imageNumber);
  const exists = await checkImageExists(primaryPath);

  if (exists) {
    return primaryPath;
  }

  // 2. 단일 파일 시도
  const singleFilePath = getSingleFileImagePath(tier.name);
  const singleFileExists = await checkImageExists(singleFilePath);

  if (singleFileExists) {
    return singleFilePath;
  }

  // 3. 기본 이미지 확인
  const defaultExists = await checkImageExists(DEFAULT_IMAGE);

  if (defaultExists) {
    return DEFAULT_IMAGE;
  }

  // 4. 모든 이미지가 없으면 빈 문자열 반환 (플레이스홀더 표시)
  return '';
}

/**
 * 호감도 구간별 색상을 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 색상 값 (hex)
 */
export function getAffectionColor(affection: number): string {
  if (affection < 20) return '#ef4444'; // Red
  if (affection < 40) return '#f97316'; // Orange
  if (affection < 55) return '#f59e0b'; // Amber
  if (affection < 70) return '#10b981'; // Green
  if (affection < 85) return '#3b82f6'; // Blue
  return '#ec4899'; // Pink
}

/**
 * 호감도 구간 레이블을 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 구간 레이블 (예: "호감, 친근")
 */
export function getAffectionLabel(affection: number): string {
  const tier = getAffectionTier(affection);
  return tier.label;
}
