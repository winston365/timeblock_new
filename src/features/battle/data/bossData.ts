/**
 * 보스 메타데이터
 *
 * @role 23마리 보스의 이름, 이미지, 난이도, 처치 대사 정의
 * @description 에셋 파일은 public/assets/bosses/ 에 위치
 */

import type { Boss } from '@/shared/types/domain';

/**
 * 전체 보스 목록 (23마리)
 */
export const BOSSES: Boss[] = [
  {
    id: 'boss_01',
    name: '릭 아디슨',
    image: 'boss_01.png',
    difficulty: 'hard',
    defeatQuote: '크윽... 이번엔 졌지만 다음엔 반드시...',
  },
  {
    id: 'boss_02',
    name: '악마 페리스',
    image: 'boss_02.png',
    difficulty: 'normal',
    defeatQuote: '나의 검이... 부러지다니...',
  },
  {
    id: 'boss_03',
    name: '마소우 시즈카',
    image: 'boss_03.png',
    difficulty: 'easy',
    defeatQuote: '뿌잉... 녹아버린다...',
  },
  {
    id: 'boss_04',
    name: '바위 골렘',
    image: 'boss_04.png',
    difficulty: 'normal',
    defeatQuote: '...돌...로...돌아간다...',
    imagePosition: 'center right',
    imageScale: 1,
  },
  {
    id: 'boss_05',
    name: '노스',
    image: 'boss_05.png',
    difficulty: 'hard',
    defeatQuote: '후훗... 다음엔 내 저주를 피하지 못할 거야...',
  },
  {
    id: 'boss_06',
    name: '하니킹',
    image: 'boss_06.png',
    difficulty: 'easy',
    defeatQuote: '아우우... 무리에게 돌아가야겠군...',
  },
  {
    id: 'boss_07',
    name: '미네르바',
    image: 'boss_07.png',
    difficulty: 'normal',
    defeatQuote: '뼈만 남았지만... 왕의 위엄은 영원하다...',
  },
  {
    id: 'boss_08',
    name: '코린',
    image: 'boss_08.png',
    difficulty: 'normal',
    defeatQuote: '우가가... 배고파서 힘이 안 났어...',
  },
  {
    id: 'boss_09',
    name: '마인 레드아이',
    image: 'boss_09.png',
    difficulty: 'hard',
    defeatQuote: '해가 뜨기 전에... 반드시 돌아올 것이다...',
  },
  {
    id: 'boss_10',
    name: '노스',
    image: 'boss_10.png',
    difficulty: 'epic',
    defeatQuote: '재에서... 다시 태어나리라...',
  },
  {
    id: 'boss_11',
    name: 'Mineva Margaret',
    image: 'boss_11.png',
    difficulty: 'epic',
    defeatQuote: '머리 하나가 잘려도... 둘이 돋아나지...',
  },
  {
    id: 'boss_12',
    name: '리틀 프린세스',
    image: 'boss_12.png',
    difficulty: 'epic',
    defeatQuote: '지옥의 문은... 아직 열려있다...',
  },
  {
    id: 'boss_13',
    name: '도쿠간류 마사무네',
    image: 'boss_13.png',
    difficulty: 'hard',
    defeatQuote: '영원한 겨울이... 녹아내린다...',
    imagePosition: 'center',
    imageScale: 1,
  },
  {
    id: 'boss_14',
    name: '자비엘',
    image: 'boss_14.png',
    difficulty: 'normal',
    defeatQuote: '내 자식들이... 복수할 것이다...',
  },
  {
    id: 'boss_15',
    name: '아이젤',
    image: 'boss_15.webp',
    difficulty: 'hard',
    defeatQuote: '천 년의 잠에서... 다시 깨어나리...',
    imagePosition: 'center',
    imageScale: 1,
  },
  {
    id: 'boss_16',
    name: '파스텔 카라',
    image: 'boss_16.png',
    difficulty: 'epic',
    defeatQuote: '죽음은... 나에게 끝이 아니다...',
  },
  {
    id: 'boss_17',
    name: '마스조웨',
    image: 'boss_17.png',
    difficulty: 'normal',
    defeatQuote: '내 눈이... 안 보여...',
    imagePosition: 'center right',
    imageScale: 1,
  },
  {
    id: 'boss_18',
    name: '여신 ALICE',
    image: 'boss_18.png',
    difficulty: 'hard',
    defeatQuote: '멍멍멍... (세 머리가 동시에)',
  },
  {
    id: 'boss_19',
    name: '카라',
    image: 'boss_19.png',
    difficulty: 'epic',
    defeatQuote: '바다의 심연으로... 돌아간다...',
  },
  {
    id: 'boss_20',
    name: '여신 엘리스',
    image: 'boss_20.png',
    difficulty: 'epic',
    defeatQuote: '신들조차 두려워한 나를... 대단하군...',
  },
  {
    id: 'boss_21',
    name: '폭풍의 정령',
    image: 'boss_21.png',
    difficulty: 'hard',
    defeatQuote: '바람이... 멈췄다...',
  },
  {
    id: 'boss_22',
    name: '가르티아',
    image: 'boss_22.png',
    difficulty: 'normal',
    defeatQuote: '어둠 속으로... 사라진다...',
    imagePosition: 'center 130%',
    imageScale: 1,
  },
  {
    id: 'boss_23',
    name: '천상의 수호자',
    image: 'boss_23.png',
    difficulty: 'epic',
    defeatQuote: '나의 임무는... 여기까지다...',
  },
];

/**
 * 보스 ID로 보스 찾기
 */
export function getBossById(bossId: string): Boss | undefined {
  return BOSSES.find(boss => boss.id === bossId);
}

/**
 * 랜덤 보스 선택 (최근 사용된 보스 제외)
 * @param count 선택할 보스 수
 * @param excludeIds 제외할 보스 ID 목록
 */
export function selectRandomBosses(count: number, excludeIds: string[] = []): Boss[] {
  const availableBosses = BOSSES.filter(boss => !excludeIds.includes(boss.id));

  // 사용 가능한 보스가 요청 수보다 적으면 전체에서 선택
  const pool = availableBosses.length >= count ? availableBosses : BOSSES;

  // Fisher-Yates 셔플
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/**
 * 난이도별 보스 필터링
 */
export function getBossesByDifficulty(difficulty: Boss['difficulty']): Boss[] {
  return BOSSES.filter(boss => boss.difficulty === difficulty);
}
