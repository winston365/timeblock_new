/**
 * 보스 메타데이터
 *
 * @role 31마리 보스의 이름, 이미지, 난이도, 처치 대사 정의
 * @description 에셋 파일은 public/assets/bosses/ 에 위치
 */

import type { Boss } from '@/shared/types/domain';

/**
 * 전체 보스 목록 (31마리)
 */
export const BOSSES: Boss[] = [
  {
    id: 'boss_01',
    name: '릭 아디슨',
    image: 'boss_01.webp',
    difficulty: 'hard',
    defeatQuote: '「私の力が……及ばなかったか……」',
    quotes: [
      '「全力で参ります！」',
      '「手加減はできませんよ。」',
      '「これもリーザスのため、悪く思わないでください。」',
    ],
    defeatQuotes: [
      '「私の力が……及ばなかったか……」',
      '「申し訳ありません……ランス様……」',
    ],
  },
  {
    id: 'boss_02',
    name: '악마 페리스',
    image: 'boss_02.webp',
    difficulty: 'easy',
    defeatQuote: '「なんで私がこんな目にぃぃ！」',
    quotes: [
      '「はぁ…やればいいんでしょ、やれば！」',
      '「死んじゃえ！ 死んじゃえ！」',
      '「なんで私がこんなこと…」',
    ],
    defeatQuotes: [
      '「なんで私がこんな目にぃぃ！」',
      '「もう嫌！ 魔界に帰るから！」',
    ],
  },
  {
    id: 'boss_03',
    name: '마소우 시즈카',
    image: 'boss_03.webp',
    difficulty: 'normal',
    defeatQuote: '「私の魔法が……通じないなんて……」',
    quotes: [
      '「黒色破壊光線（ブラック・ディストラクション・ビーム）！！」',
      '「消し飛びなさい！」',
      '「邪魔よ、そこどいて。」',
    ],
    defeatQuotes: [
      '「私の魔法が……通じないなんて……」',
      '「ナギちゃん……逃げて……」',
    ],
  },
  {
    id: 'boss_04',
    name: '헬만 여기사',
    image: 'boss_04.webp',
    difficulty: 'easy',
    defeatQuote: '「ガラガラガラ……」',
    quotes: [
      '「ゴオオオォォォ……」',
      '「侵入者……排除……」',
      '「ツブス……」',
    ],
    defeatQuotes: [
      '「ガラガラガラ……」',
      '「体ガ……崩レル……」',
    ],
    imagePosition: 'center right',
    imageScale: 1,
  },
  {
    id: 'boss_05',
    name: '마인 노스',
    image: 'boss_05.webp',
    difficulty: 'normal',
    defeatQuote: '「ノスッ！？」',
    quotes: [
      '꿈인가? 아니면 현실인가... 뭐, 상관없나.',
      '「肉……肉だぁ……」',
      '「ノスッ！！」',
    ],
    defeatQuotes: [
      '「ノスッ！？」',
      '「死ぬノスぅぅ……」',
    ],
  },
  {
    id: 'boss_06',
    name: '하니킹',
    image: 'boss_06.webp',
    difficulty: 'epic',
    defeatQuote: '「馬鹿なハニ！ 余が負けるとは……」',
    quotes: [
      '「無礼者め、ひれ伏すがいいハニ！」',
      '「余の眠りを妨げるのは誰だハニ？」',
      '「雑魚は失せるハニ。」',
    ],
    defeatQuotes: [
      '「馬鹿なハニ！ 余が負けるとは……」',
      '「覚えておれハニ～！」',
    ],
  },
  {
    id: 'boss_07',
    name: '마인 레이',
    image: 'boss_07.webp',
    difficulty: 'hard',
    defeatQuote: '뼈만 남았지만... 왕의 위엄은 영원하다...',
    quotes: [
      '망자의 왕이 다스린다.',
      '해골군단이 뒤를 잇는다.',
      '침입자를 환영하지 않는다.',
    ],
    defeatQuotes: [
      '뼈만 남았지만... 왕의 위엄은 영원하다...',
      '해골도 때론 쉬어야 하는군...',
    ],
  },
  {
    id: 'boss_08',
    name: '적주 아키하',
    image: 'boss_08.webp',
    difficulty: 'easy',
    defeatQuote: '우가가... 배고파서 힘이 안 났어...',
    quotes: [
      '배고픈 거인이 화났다!',
      '네가 내 점심이냐?',
      '크게 한 번 휘둘러주지!',
    ],
    defeatQuotes: [
      '우가가... 배고파서 힘이 안 났어...',
      '다음엔 배 부르게 먹고 오겠어...',
    ],
  },
  {
    id: 'boss_09',
    name: '마인 레드아이',
    image: 'boss_09.webp',
    difficulty: 'hard',
    defeatQuote: '「俺様が……死ぬだとぉぉ！？」',
    quotes: [
      '「殺し足りねぇ……もっとだ！」',
      '「血……血の匂いだぁ……ヒャハハハ！」',
      '「貴様の悲鳴を聞かせろぉ！」',
    ],
    defeatQuotes: [
      '「俺様が……死ぬだとぉぉ！？」',
      '「血が……足りねぇ……」',
    ],
  },
  {
    id: 'boss_10',
    name: '타입문',
    image: 'boss_10.webp',
    difficulty: 'epic',
    defeatQuote: '재에서... 다시 태어나리라...',
    quotes: [
      '불꽃은 영원을 노래한다.',
      '모든 것이 불타오른다!',
      '검붉은 재를 맛보아라.',
    ],
    defeatQuotes: [
      '재에서... 다시 태어나리라...',
      '불꽃은 꺼지지 않는다...',
    ],
  },
  {
    id: 'boss_11',
    name: '시엘',
    image: 'boss_11.webp',
    difficulty: 'normal',
    defeatQuote: '「見事だ……」',
    quotes: [
      '「私の槍からは逃げられん！」',
      '「ヘルマンの誇りにかけて！」',
      '「遅い！ 見切れるか！」',
    ],
    defeatQuotes: [
      '「見事だ……」',
      '「まだ修行が足りないというのか……」',
    ],
  },
  {
    id: 'boss_12',
    name: '리틀 프린세스',
    image: 'boss_12.webp',
    difficulty: 'epic',
    defeatQuote: '「うえ～ん！ いじめられたぁ～！」',
    quotes: [
      '「私、戦うなんて嫌だよ…」',
      '「えいっ！ ……あ、当たった？」',
      '「もう怒ったんだから！」',
    ],
    defeatQuotes: [
      '「うえ～ん！ いじめられたぁ～！」',
      '「痛いよぉ……もうやだぁ……」',
    ],
  },
  {
    id: 'boss_13',
    name: '용사 아리오스 테오만',
    image: 'boss_13.webp',
    difficulty: 'epic',
    defeatQuote: '「我が野望が……ここで潰えるか……」',
    quotes: [
      '「天下布武！ 我が野望の糧となれ！」',
      '「この独眼竜の前に敵は無し！」',
      '「貴様の力、そのようなものか？」',
    ],
    defeatQuotes: [
      '「我が野望が……ここで潰えるか……」',
      '「バカな……この独眼竜が……」',
    ],
    imagePosition: 'center',
    imageScale: 1,
  },
  {
    id: 'boss_14',
    name: '마인 자비엘',
    image: 'boss_14.webp',
    difficulty: 'epic',
    defeatQuote: '「人間風情に……この我が……！」',
    quotes: [
      '「絶望せよ、人間ども。」',
      '「脆い、脆すぎるわ！」',
      '「死をもって償え。」',
    ],
    defeatQuotes: [
      '「人間風情に……この我が……！」',
      '「有り得ん……有り得んぞぉぉ！！」',
    ],
  },
  {
    id: 'boss_15',
    name: '사도 아이젤',
    image: 'boss_15.webp',
    difficulty: 'hard',
    defeatQuote: '「ザビエル様……申し訳ありませぬ……」',
    quotes: [
      '「ザビエル様のために！」',
      '「使徒アイゼル、推して参る！」',
      '「我が防御、破れるものなら破ってみよ！」',
    ],
    defeatQuotes: [
      '「ザビエル様……申し訳ありませぬ……」',
      '「ここまでのようだな……」',
    ],
    imagePosition: 'center',
    imageScale: 1,
  },
  {
    id: 'boss_16',
    name: '파스텔 카라',
    image: 'boss_16.webp',
    difficulty: 'hard',
    defeatQuote: '「男なんかに……屈するなんて……」',
    quotes: [
      '「汚らわしい男が、近寄るな！」',
      '「風よ、切り裂け！」',
      '「身の程を知りなさい！」',
    ],
    defeatQuotes: [
      '「男なんかに……屈するなんて……」',
      '「離しなさいよ！ 汚らわしい！」',
    ],
  },
  {
    id: 'boss_17',
    name: '마스조웨',
    image: 'boss_17.webp',
    difficulty: 'normal',
    defeatQuote: '내 눈이... 안 보여...',
    quotes: [
      '눈이 모든 것을 꿰뚫는다.',
      '네 움직임, 다 보고 있다.',
      '응시만으로 굴복시키지.',
    ],
    defeatQuotes: [
      '내 눈이... 안 보여...',
      '잠시 눈을 감을 뿐이다...',
    ],
    imagePosition: 'center right',
    imageScale: 1,
  },
  {
    id: 'boss_18',
    name: '흑화 세이버',
    image: 'boss_18.webp',
    difficulty: 'hard',
    defeatQuote: '「致命的なエラーが発生しました。」',
    quotes: [
      '「システム干渉を確認。排除します。」',
      '「バグですね。修正が必要です。」',
      '「無駄な足掻きです。」',
    ],
    defeatQuotes: [
      '「致命的なエラーが発生しました。」',
      '「システムダウン……強制終了します。」',
    ],
  },
  {
    id: 'boss_19',
    name: '풀 카라',
    image: 'boss_19.webp',
    difficulty: 'normal',
    defeatQuote: '「森が……汚れちゃう……」',
    quotes: [
      '「森を荒らす者は許さない！」',
      '「人間……帰れ！」',
      '「矢の雨を降らせてやるわ！」',
    ],
    defeatQuotes: [
      '「森が……汚れちゃう……」',
      '「きゃああっ！」',
    ],
  },
  {
    id: 'boss_20',
    name: '여신 엘리스(epic)',
    image: 'boss_20.webp',
    difficulty: 'epic',
    defeatQuote: '「世界の理（ことわり）には逆らえません。」',
    quotes: [
      '「世界の理（ことわり）には逆らえません。」',
      '「……記録しました。」',
      '「人間とは、愚かなものですね。」',
    ],
    defeatQuotes: [
      '「世界の理（ことわり）には逆らえません。」',
      '「……記録しました。」',
    ],
  },
  {
    id: 'boss_21',
    name: '마왕 가이',
    image: 'boss_21.webp',
    difficulty: 'epic',
    defeatQuote: 'やっと……終わるのか……この狂気が……',
    quotes: [
      '来るがいい。千年の絶望に届く刃があるならな。',
      '魔人の王の力、見るがいい！',
      '雷が前を阻む！',
    ],
    defeatQuotes: [
      'やっと……終わるのか……この狂気が……',
      'ミッキー…ごめん。荷物を託すよ',
    ],
  },
  {
    id: 'boss_22',
    name: '가르티아',
    image: 'boss_22.webp',
    difficulty: 'normal',
    defeatQuote: '「もう……食べられないよぉ……」',
    quotes: [
      '「いただきまぁ～す！」',
      '「お腹すいたぁ……食べていい？」',
      '「食事の邪魔しないでよぉ。」',
    ],
    defeatQuotes: [
      '「もう……食べられないよぉ……」',
      '「お腹……痛い……」',
    ],
    imagePosition: 'center 130%',
    imageScale: 1,
  },
  {
    id: 'boss_23',
    name: '도쿠간류 마사무네',
    image: 'boss_23.webp',
    difficulty: 'hard',
    defeatQuote: '「我が野望が……ここで潰えるか……」',
    quotes: [
      '「天下布武！ 我が野望の糧となれ！」',
      '「この独眼竜の前に敵は無し！」',
      '「貴様の力、そのようなものか？」',
    ],
    defeatQuotes: [
      '「我が野望が……ここで潰えるか……」',
      '「バカな……この独眼竜が……」',
    ],
  },
  {
    id: 'boss_24',
    name: '히소카',
    image: 'boss_24.webp',
    difficulty: 'normal',
    defeatQuote: '이 쇼는 여기까지인가...',
    quotes: [
      '카드를 뽑아볼까?',
      '흥미로운 상대군.',
      '쇼타임은 이제 시작이야.',
    ],
    defeatQuotes: [
      '이 쇼는 여기까지인가...',
      '다음 판에서 보자고.',
    ],
  },
  {
    id: 'boss_25',
    name: '간츠',
    image: 'boss_25.webp',
    difficulty: 'epic',
    defeatQuote: '규칙은 깨졌다... 끝내라.',
    quotes: [
      '새 미션을 시작한다.',
      '넌 선택받았다, 싸워라.',
      '포기하지 마, 아직 끝나지 않았다.',
    ],
    defeatQuotes: [
      '규칙은 깨졌다... 끝내라.',
      '미션 실패… 다음을 기약한다.',
    ],
  },
  {
    id: 'boss_26',
    name: '를르슈',
    image: 'boss_26.webp',
    difficulty: 'hard',
    defeatQuote: '제로의 계획이… 무너졌다.',
    quotes: [
      '세계는 내가 재정의한다.',
      '나의 명령에 복종하라!',
      '승리는 계산된 결과다.',
    ],
    defeatQuotes: [
      '제로의 계획이… 무너졌다.',
      '이 패배도 언젠가 활용하겠어.',
    ],
  },
  {
    id: 'boss_27',
    name: '하니',
    image: 'boss_27.webp',
    difficulty: 'easy',
    defeatQuote: '하니… 힘이 다했어.',
    quotes: [
      '하니는 강하다!',
      '꿀을 지켜야 해!',
      '작아 보여도 무섭다고!',
    ],
    defeatQuotes: [
      '하니… 힘이 다했어.',
      '다음엔 더 강해질 거야… 하니!',
    ],
  },
  {
    id: 'boss_28',
    name: '카미라',
    image: 'boss_28.webp',
    difficulty: 'hard',
    defeatQuote: '여왕의 날개가… 꺾였군.',
    quotes: [
      '내 사냥감을 건드린 건 네가 처음이야.',
      '고요히 무릎 꿇어라.',
      '날개를 펴면 모두 침묵한다.',
    ],
    defeatQuotes: [
      '여왕의 날개가… 꺾였군.',
      '이屈辱을 기억하겠다.',
    ],
  },
  {
    id: 'boss_29',
    name: '한니발',
    image: 'boss_29.webp',
    difficulty: 'epic',
    defeatQuote: '전략이… 무너졌다.',
    quotes: [
      '계획 없는 승리는 없다.',
      '네 수는 이미 읽었다.',
      '뒤를 조심해라, 함정은 이미 깔렸다.',
    ],
    defeatQuotes: [
      '전략이… 무너졌다.',
      '전장은 다시 돌아오리라.',
    ],
  },
  {
    id: 'boss_30',
    name: '다크란스',
    image: 'boss_30.webp',
    difficulty: 'hard',
    defeatQuote: '어둠조차… 빛에 삼켜지는군.',
    quotes: [
      '어둠이 네 숨을 죈다.',
      '빛은 금방 사라질 것이다.',
      '절망에 잠겨라.',
    ],
    defeatQuotes: [
      '어둠조차… 빛에 삼켜지는군.',
      '이 빚은 반드시 갚겠다.',
    ],
  },
  {
    id: 'boss_31',
    name: '크라피카',
    image: 'boss_31.webp',
    difficulty: 'normal',
    defeatQuote: '체인의 끝은 여기까지인가…',
    quotes: [
      '사슬은 거짓을 묶는다.',
      '차분히, 계획대로 움직인다.',
      '복수는 아직 끝나지 않았다.',
    ],
    defeatQuotes: [
      '체인의 끝은 여기까지인가…',
      '언젠가 다시 만날 것이다.',
    ],
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

/**
 * 난이도별 보스 ID 목록 생성 (풀 시스템용)
 * @returns 난이도별 보스 ID 배열 레코드
 */
export function groupBossesByDifficulty(): Record<Boss['difficulty'], string[]> {
  return {
    easy: BOSSES.filter(b => b.difficulty === 'easy').map(b => b.id),
    normal: BOSSES.filter(b => b.difficulty === 'normal').map(b => b.id),
    hard: BOSSES.filter(b => b.difficulty === 'hard').map(b => b.id),
    epic: BOSSES.filter(b => b.difficulty === 'epic').map(b => b.id),
  };
}

/**
 * 난이도별 보스 수 조회
 */
export const BOSS_COUNT_BY_DIFFICULTY = {
  easy: BOSSES.filter(b => b.difficulty === 'easy').length,    // 4
  normal: BOSSES.filter(b => b.difficulty === 'normal').length, // 8
  hard: BOSSES.filter(b => b.difficulty === 'hard').length,    // 10
  epic: BOSSES.filter(b => b.difficulty === 'epic').length,    // 9
} as const;
