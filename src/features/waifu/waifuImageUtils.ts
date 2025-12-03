/**
 * @file waifuImageUtils.ts
 *
 * @description 호감도 값에 따라 적절한 와이푸 이미지를 선택하고 관리하는 유틸리티 모듈
 *
 * @role 와이푸 이미지 경로 및 호감도 관리 유틸리티
 *
 * @responsibilities
 *   - 호감도 값을 6단계 티어로 분류 (hostile ~ loving)
 *   - 호감도 티어별 랜덤 이미지 선택
 *   - 이미지 존재 여부 확인 및 캐시 관리
 *   - 폴백 이미지 경로 제공
 *   - 호감도별 색상/레이블 유틸리티
 *
 * @dependencies
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
 *   │   ├── 1.webp
 *   │   ├── 2.webp
 *   │   └── 3.webp
 *   ├── wary/
 *   │   ├── 1.webp
 *   │   └── 2.webp
 *   ...
 *
 * 또는 단일 파일:
 *   ├── hostile.webp
 *   ├── wary.webp
 *   ...
 */

// 각 호감도 구간별로 사용 가능한 이미지 파일 목록
const IMAGE_FILES: Record<string, string[]> = {
  hostile: [
    'hyeeun_angry.webp',
    'hyeeun_annoyed.webp',
    'hyeeun_disgusted.webp',
    'hyeeun_serious.webp',
  ],
  wary: [
    'hyeeun_bored.webp',
    'hyeeun_depressed.webp',
    'hyeeun_disappointed.webp',
    'hyeeun_sad.webp',
    'hyeeun_sleepy.webp',
    'hyeeun_thinking.webp',
    'hyeeun_tired.webp',
  ],
  indifferent: [
    'hyeeun_confused.webp',
    'hyeeun_curious.webp',
    'hyeeun_nervous.webp',
    'hyeeun_neutral.webp',
    'hyeeun_reading.webp',
    'hyeeun_relieved.webp',
    'hyeeun_smiling.webp',
    'hyeeun_smirking.webp',
    'hyeeun_smoking.webp',
  ],
  interested: [
    // interested 폴더가 없으므로 indifferent의 긍정적인 이미지들 사용
    'hyeeun_curious.webp',
    'hyeeun_smiling.webp',
    'hyeeun_smirking.webp',
    'hyeeun_relieved.webp',
  ],
  affectionate: [
    'hyeeun_admiring.webp',
    'hyeeun_blushing shyly.webp',
    'hyeeun_embarrassed.webp',
    'hyeeun_giggling.webp',
    'hyeeun_laughing.webp',
  ],
  loving: [
    'hyeeun_excited.webp',
    'hyeeun_happy tears.webp',
    'hyeeun_happy.webp',
    'hyeeun_hugging.webp',
    'hyeeun_joyful.webp',
    'hyeeun_kiss.webp',
    'hyeeun_princess carry.webp',
    'hyeeun_winking.webp',
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
export const DEFAULT_IMAGE = 'assets/waifu/poses/indifferent/hyeeun_neutral.webp';

/**
 * 호감도 값에 따라 적절한 구간을 반환합니다.
 *
 * @param affection - 호감도 (0-100)
 * @returns 호감도 구간 객체 (min, max, name, label, mood 포함)
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
 * @param excludeIndex - 제외할 인덱스 (이전 이미지 인덱스)
 * @returns 랜덤 이미지 인덱스 (0부터 시작)
 */
export function getRandomImageNumber(tierName: string, excludeIndex?: number): number {
  const count = IMAGE_COUNTS[tierName] || 1;

  if (count <= 1) return 0;

  let newIndex = Math.floor(Math.random() * count);

  // 이전과 같은 인덱스가 나오면 다시 뽑기 (최대 3번 시도)
  if (excludeIndex !== undefined) {
    let attempts = 0;
    while (newIndex === excludeIndex && attempts < 3) {
      newIndex = Math.floor(Math.random() * count);
      attempts++;
    }
    // 여전히 같으면 (excludeIndex + 1) % count 로 강제 변경
    if (newIndex === excludeIndex) {
      newIndex = (excludeIndex + 1) % count;
    }
  }

  return newIndex;
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
    return '1.webp'; // fallback
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

  // 폴더 구조: /assets/waifu/poses/hostile/hyeeun_angry.webp
  return `assets/waifu/poses/${folderName}/${fileName}`;


}

/**
 * 폴백으로 단일 파일 경로를 반환합니다.
 *
 * @param tierName - 호감도 구간 이름
 * @returns 단일 파일 이미지 경로
 */
export function getSingleFileImagePath(tierName: string): string {
  return `assets/waifu/poses/${tierName}.webp`;
}

// 이미지 존재 여부 캐시
const existenceCache = new Map<string, boolean>();

/**
 * 이미지가 로드 가능한지 확인합니다.
 * 캐시된 결과가 있으면 즉시 반환합니다.
 *
 * @param imagePath - 이미지 경로
 * @returns Promise<boolean> - 이미지 로드 가능 여부
 */
export async function checkImageExists(imagePath: string): Promise<boolean> {
  if (existenceCache.has(imagePath)) {
    return existenceCache.get(imagePath)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      existenceCache.set(imagePath, true);
      resolve(true);
    };
    img.onerror = () => {
      existenceCache.set(imagePath, false);
      resolve(false);
    };
    img.src = imagePath;
  });
}

/**
 * 이미지 존재 여부를 수동으로 캐시에 설정합니다.
 * (Preloader 등에서 사용)
 * @param imagePath - 이미지 경로
 * @param exists - 존재 여부
 */
export function markImageAsExisting(imagePath: string, exists: boolean) {
  existenceCache.set(imagePath, exists);
}

/**
 * 모든 와이푸 이미지 경로 목록을 반환합니다.
 * (Preloader 최적화용)
 * @returns 모든 이미지 경로 배열
 */
export function getAllWaifuImagePaths(): string[] {
  const paths: string[] = [];
  
  Object.entries(IMAGE_FILES).forEach(([tierName, files]) => {
    // interested는 indifferent 폴더 사용하므로 중복 제외
    if (tierName === 'interested') return;
    
    files.forEach(fileName => {
      paths.push(`assets/waifu/poses/${tierName}/${fileName}`);
    });
  });

  return paths;
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
