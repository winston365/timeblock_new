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
    image: 'boss_02.png',
    difficulty: 'normal',
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
    image: 'boss_03.png',
    difficulty: 'easy',
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
    name: '바위 골렘',
    image: 'boss_04.png',
    difficulty: 'normal',
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
    name: '노스',
    image: 'boss_05.png',
    difficulty: 'hard',
    defeatQuote: '「ノスッ！？」',
    quotes: [
      '「ノスノス！」',
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
    image: 'boss_06.png',
    difficulty: 'easy',
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
    name: '미네르바',
    image: 'boss_07.png',
    difficulty: 'normal',
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
    name: '코린',
    image: 'boss_08.png',
    difficulty: 'normal',
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
    image: 'boss_09.png',
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
    name: '노스',
    image: 'boss_10.png',
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
    name: 'Mineva Margaret',
    image: 'boss_11.png',
    difficulty: 'epic',
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
    image: 'boss_12.png',
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
    name: '도쿠간류 마사무네',
    image: 'boss_13.png',
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
    imagePosition: 'center',
    imageScale: 1,
  },
  {
    id: 'boss_14',
    name: '자비엘',
    image: 'boss_14.png',
    difficulty: 'normal',
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
    name: '아이젤',
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
    image: 'boss_16.png',
    difficulty: 'epic',
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
    image: 'boss_17.png',
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
    name: '여신 ALICE',
    image: 'boss_18.png',
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
    name: '카라',
    image: 'boss_19.png',
    difficulty: 'epic',
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
    name: '여신 엘리스',
    image: 'boss_20.png',
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
    name: '폭풍의 정령',
    image: 'boss_21.png',
    difficulty: 'hard',
    defeatQuote: '바람이... 멈췄다...',
    quotes: [
      '폭풍을 견딜 준비가 됐나?',
      '바람이 네 편이 아닐 거다.',
      '번개가 앞을 막는다!',
    ],
    defeatQuotes: [
      '바람이... 멈췄다...',
      '폭풍이 잠시 잦아들 뿐...',
    ],
  },
  {
    id: 'boss_22',
    name: '가르티아',
    image: 'boss_22.png',
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
    name: '천상의 수호자',
    image: 'boss_23.png',
    difficulty: 'epic',
    defeatQuote: '나의 임무는... 여기까지다...',
    quotes: [
      '천상에서 내려온 심판이다.',
      '빛의 방패가 모든 것을 막는다.',
      '하늘의 명령을 전한다.',
    ],
    defeatQuotes: [
      '나의 임무는... 여기까지다...',
      '명령이 끝났으니 물러나겠다...',
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
