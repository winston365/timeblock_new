# 와이푸 포즈 이미지 폴더

이 폴더에 호감도별 와이푸 이미지를 추가하세요.

## 📁 폴더 구조

호감도 구간별로 폴더를 만들고, 각 폴더에 여러 이미지를 추가할 수 있습니다.

```
public/assets/waifu/poses/
├── hostile/          # 호감도 0-20 (혐오, 적대)
│   ├── 1.webp
│   ├── 2.webp
│   └── 3.webp
├── wary/             # 호감도 20-40 (경계, 혐오감 완화)
│   ├── 1.webp
│   ├── 2.webp
│   └── 3.webp
├── indifferent/      # 호감도 40-55 (무관심, 냉담)
│   ├── 1.webp
│   ├── 2.webp
│   └── 3.webp
├── interested/       # 호감도 55-70 (관심, 경계 풀림)
│   ├── 1.webp
│   ├── 2.webp
│   └── 3.webp
├── affectionate/     # 호감도 70-85 (호감, 친근)
│   ├── 1.webp
│   ├── 2.webp
│   └── 3.webp
└── loving/           # 호감도 85-100 (애정, 헌신)
    ├── 1.webp
    ├── 2.webp
    └── 3.webp
```

**또는 단일 파일 방식:**
```
public/assets/waifu/poses/
├── hostile.webp
├── wary.webp
├── indifferent.webp
├── interested.webp
├── affectionate.webp
└── loving.webp
```

## 🎭 호감도 구간별 성격

| 호감도 범위 | 폴더명 | 이름 | 기분 | 말투 예시 |
|------------|--------|------|------|----------|
| 0-20% | `hostile` | 혐오, 적대 | 😡 | "꺼져. 진짜로." / "시발 또 왔네." |
| 20-40% | `wary` | 경계, 혐오감 완화 | 😠 | "...또 뭐야, 씨발." / "귀찮게." |
| 40-55% | `indifferent` | 무관심, 냉담 | 😐 | "...뭔데." / "그래서?" |
| 55-70% | `interested` | 관심, 경계 풀림 | 🙂 | "오늘은... 괜찮네." / "나쁘지 않은데?" |
| 70-85% | `affectionate` | 호감, 친근 | 😊 | "오늘 많이 했네! 대단한데?" / "잘하고 있어!" |
| 85-100% | `loving` | 애정, 헌신 | 🥰 | "선배... 정말 멋있어요..." / "사랑해요!" |

## 🖼️ 이미지 요구사항

- **파일 형식**: PNG 또는 JPG
- **권장 크기**: 세로 이미지 (예: 600x900px, 800x1200px)
  - 기본 표시 크기: 최대 800px 높이
  - 모바일: 최대 500px 높이
- **배경**: 투명 배경 PNG 권장
- **파일 크기**: 3MB 이하 권장
- **이미지 개수**: 각 폴더에 1~10개 정도 (더 많아도 OK)

## ⚙️ 작동 방식

### 1. 이미지 자동 선택
- 호감도가 변경되면 해당 구간의 랜덤 이미지를 자동 선택
- 예: 호감도 75% → `affectionate` 폴더에서 랜덤 선택

### 2. 이미지 변경 조건
다음 중 하나가 발생하면 같은 호감도 범위 내에서 랜덤 이미지로 변경:
- **4번 클릭**: 와이푸 이미지를 4번 클릭할 때마다 변경
- **10분 경과**: 마지막 이미지 변경 후 10분이 지나면 자동 변경

### 3. 폴백 (Fallback) 순서
1. `/assets/waifu/poses/{tier_name}/{number}.webp` (폴더 구조)
2. `/assets/waifu/poses/{tier_name}.webp` (단일 파일)
3. `/assets/waifu/default.webp` (기본 이미지)
4. 플레이스홀더 표시

## 💡 팁

### 이미지 개수 조정
더 많은 변화를 원하면 `waifuImageUtils.ts`에서 이미지 개수를 늘리세요:

```typescript
const IMAGE_COUNTS: Record<string, number> = {
  hostile: 5,      // 5개로 증가
  wary: 5,
  indifferent: 5,
  interested: 5,
  affectionate: 5,
  loving: 5,
};
```

### 권장 이미지 스타일
- **hostile**: 화난 표정, 날카로운 눈빛
- **wary**: 경계하는 표정, 인상 찡그림
- **indifferent**: 무표정, 시큰둥
- **interested**: 약간 미소, 호기심 있는 표정
- **affectionate**: 밝은 미소, 친근한 표정
- **loving**: 행복한 표정, 하트 눈

### 예시 파일명
```
hostile/
  ├── 1.webp  (인상 쓰는 모습)
  ├── 2.webp  (화난 표정)
  └── 3.webp  (째려보는 모습)

loving/
  ├── 1.webp  (미소 지는 모습)
  ├── 2.webp  (하트 눈)
  └── 3.webp  (행복한 표정)
```

## 🎨 추천 이미지 생성 방법

1. **AI 이미지 생성**
   - Stable Diffusion, Midjourney, NovelAI 등
   - 프롬프트 예시: "anime girl, [표정], standing, full body, white background"

2. **일러스트 커미션**
   - 픽시브, 트위터 등에서 일러스트레이터에게 의뢰

3. **기존 이미지 편집**
   - 표정만 바꾸거나 색상 조정

## 📝 저작권 주의사항

- 본인이 직접 그린 이미지나 사용 권한이 있는 이미지만 사용하세요
- AI 생성 이미지는 해당 서비스의 이용 약관을 확인하세요
- 타인의 저작물을 무단으로 사용하지 마세요
