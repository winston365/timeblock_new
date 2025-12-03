# 와이푸 이미지 폴더

이 폴더는 와이푸 캐릭터 이미지를 저장하는 곳입니다.

## 폴더 구조

```
public/assets/waifu/
├── default.webp          # 기본 와이푸 이미지
├── poses/              # 다양한 포즈 이미지
│   ├── happy.webp
│   ├── sad.webp
│   ├── excited.webp
│   └── ...
└── README.md
```

## 이미지 요구사항

- **권장 크기**: 세로 이미지 (예: 400x600px, 500x750px)
- **파일 형식**: PNG (투명 배경 권장) 또는 JPG
- **최대 파일 크기**: 2MB 이하 권장

## 사용 방법

1. 와이푸 이미지를 이 폴더에 추가합니다.
2. WaifuPanel 컴포넌트에서 이미지를 사용할 때:

```tsx
<WaifuPanel imagePath="/assets/waifu/default.webp" />
```

또는

```tsx
<WaifuPanel imagePath="/assets/waifu/poses/happy.webp" />
```

## 예시

기본 이미지를 설정하려면:

```tsx
// AppShell.tsx 또는 관련 컴포넌트에서
<aside className="waifu-panel-container">
  <WaifuPanel imagePath="/assets/waifu/default.webp" />
</aside>
```

## 팁

- 다양한 포즈나 표정 이미지를 `poses/` 폴더에 추가하여 호감도나 기분에 따라 다른 이미지를 표시할 수 있습니다.
- 투명 배경 PNG를 사용하면 더 자연스러운 UI 통합이 가능합니다.
