/**
 * waifuImageUtils
 *
 * @role 호감도 값에 따라 적절한 와이푸 이미지를 선택하고 관리하는 유틸리티 모듈
 * @input 없음 (유틸리티 함수들만 export)
 * @output 호감도별 이미지 경로, 색상, 레이블 등을 반환하는 함수들
 * @external_dependencies
 *   - Image API: 이미지 로드 가능 여부 확인
 *   - /assets/waifu/poses/: 호감도별 이미지 파일 경로
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

// 각 호감도 구간별로 사용 가능한 이미지 파일 목록
const IMAGE_FILES: Record<string, string[]> = {
  hostile: [
    'hyeeun_angry.png',
    'hyeeun_annoyed.png',
    'hyeeun_disgusted.png',
    'hyeeun_serious.png',
  ],
  wary: [
    'hyeeun_bored.png',
    'hyeeun_depressed.png',
    'hyeeun_disappointed.png',
    'hyeeun_sad.png',
    'hyeeun_sleepy.png',
    'hyeeun_thinking.png',
    'hyeeun_tired.png',
  ],
  indifferent: [
    'hyeeun_confused.png',
    'hyeeun_curious.png',
    'hyeeun_nervous.png',
    'hyeeun_neutral.png',
    'hyeeun_reading.png',
    'hyeeun_relieved.png',
    'hyeeun_smiling.png',
    'hyeeun_smirking.png',
    'hyeeun_smoking.png',
  ],
  interested: [
    // interested 폴더가 없으므로 indifferent의 긍정적인 이미지들 사용
    'hyeeun_curious.png',
    'hyeeun_smiling.png',
    'hyeeun_smirking.png',
    'hyeeun_relieved.png',
  ],
  affectionate: [
    'hyeeun_admiring.png',
    'hyeeun_blushing shyly.png',
    'hyeeun_embarrassed.png',
    'hyeeun_giggling.png',
    'hyeeun_laughing.png',
  ],
  loving: [
    'hyeeun_excited.png',
    'hyeeun_happy tears.png',
    'hyeeun_happy.png',
    'hyeeun_hugging.png',
    'hyeeun_joyful.png',
    'hyeeun_kiss.png',
    'hyeeun_princess carry.png',
    'hyeeun_winking.png',
  ],
};

// 각 호감도 구간별로 사용 가능한 이미지 개수
const IMAGE_COUNTS: Record<string, number> = {
  hostile: IMAGE_FILES.hostile.length,
  wary: IMAGE_FILES.wary.length,
  indifferent: IMAGE_FILES.indifferent.length,
  interested: IMAGE_FILES.interested.length,
  affectionate: IMAGE_FILES.affectionate.length,
  loving: IMAGE_FILES.loving.length,
};

/**
 * 기본 이미지 (호감도 이미지가 없을 때 사용)
 */
export const DEFAULT_IMAGE = 'assets/waifu/default.png';

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
 * 호감도 구간 내에서 랜덤 이미지 인덱스를 생성합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @returns 랜덤 이미지 인덱스 (0부터 시작)
 */
export function getRandomImageNumber(tierName: string): number {
  const count = IMAGE_COUNTS[tierName] || 1;
  return Math.floor(Math.random() * count);
}

/**
 * 호감도 구간과 인덱스로 이미지 파일명을 반환합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @param imageIndex - 이미지 인덱스 (0부터 시작)
 * @returns 이미지 파일명
 */
export function getImageFileName(tierName: string, imageIndex: number): string {
  const files = IMAGE_FILES[tierName];
  if (!files || files.length === 0) {
    return '1.png'; // fallback
  }
  return files[imageIndex % files.length];
}

/**
 * 호감도에 따른 이미지 경로를 반환합니다.
 * 폴더 구조를 우선 확인하고, 없으면 단일 파일 확인
 *
 * @param affection - 호감도 (0-100)
 * @param imageIndex - 이미지 인덱스 (선택적, 기본값은 랜덤)
 * @returns 이미지 경로
 */
export function getWaifuImagePath(affection: number, imageIndex?: number): string {
  const tier = getAffectionTier(affection);
  const imgIndex = imageIndex ?? getRandomImageNumber(tier.name);
  const fileName = getImageFileName(tier.name, imgIndex);

  // interested 폴더가 없으므로 indifferent 폴더의 이미지 사용
  const folderName = tier.name === 'interested' ? 'indifferent' : tier.name;

  // 폴더 구조: /assets/waifu/poses/hostile/hyeeun_angry.png
  return `assets/waifu/poses/${folderName}/${fileName}`;


}

/**
 * 폴백으로 단일 파일 경로를 반환합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @returns 단일 파일 이미지 경로
 */
export function getSingleFileImagePath(tierName: string): string {
  return `assets/waifu/poses/${tierName}.png`;
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
