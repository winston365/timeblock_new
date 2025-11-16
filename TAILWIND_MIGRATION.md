# Tailwind CSS 마이그레이션 가이드

## ✅ 완료된 작업 (Phase 1 & Phase 2.1-2.2)

### Phase 1: 초기 설정 ✓

- [x] **Tailwind CSS 패키지 설치**
  - `tailwindcss@4.1.17` 설치 완료
  - `postcss@8.5.6` 설치 완료
  - `autoprefixer@10.4.22` 설치 완료

- [x] **tailwind.config.js 생성**
  - 기존 디자인 시스템 CSS 변수 → Tailwind theme으로 완전 매핑
  - 색상: `primary`, `secondary`, `bg`, `text`, `border`, `resistance` 등
  - 간격: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
  - 타이포그래피: `2xs` ~ `3xl` 폰트 크기
  - 애니메이션: `fadeIn`, `scaleIn` 키프레임

- [x] **postcss.config.js 생성**
  - Tailwind 및 Autoprefixer 플러그인 설정

- [x] **globals.css에 Tailwind 디렉티브 추가**
  - `@tailwind base;`
  - `@tailwind components;`
  - `@tailwind utilities;`
  - 기존 CSS 변수 및 커스텀 스타일 모두 유지 (하이브리드 접근)

- [x] **개발 서버 동작 확인**
  - Vite 개발 서버 정상 실행 (368ms)
  - Tailwind 컴파일 정상 동작

### Phase 2.1-2.2: 유틸리티 클래스 ✓

- [x] **새 컴포넌트 Tailwind 가이드라인**
  - 앞으로 모든 신규 컴포넌트는 Tailwind CSS로 작성
  - 기존 CSS 파일 생성 금지

- [x] **기존 유틸리티 클래스 유지**
  - `globals.css`의 `.text-xs`, `.font-bold` 등은 Tailwind와 동일하게 동작
  - 별도 마이그레이션 불필요

---

## 📋 남은 작업 (Phase 2.3 ~ Phase 4)

### Phase 2.3: 컴포넌트 마이그레이션 (2-3주 예상)

**우선순위 1: Shared Components (Week 1, 예상 1-2일)**

- [ ] `src/shared/components/XPBar.tsx`
  - `XPBar.css` 제거
  - Tailwind 클래스로 전환
  ```tsx
  // Before
  <div className="xp-bar-container">
    <div className="xp-fill" style={{width: `${percentage}%`}} />
  </div>

  // After
  <div className="relative h-2 w-full bg-bg-surface rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300"
      style={{width: `${percentage}%`}}
    />
  </div>
  ```

- [ ] `src/shared/components/XPToast.tsx`
  - `XPToast.css` 제거
  - Tailwind 클래스로 전환

**우선순위 2: Feature Components (Week 2-3)**

**Week 2:**
- [ ] **features/tasks/** (예상 2일)
  - `tasks.css` → Tailwind
  - 파일: `InboxTab.tsx`, `CompletedTab.tsx`, `BulkAddModal.tsx`

- [ ] **features/schedule/** (예상 2일)
  - `schedule.css` → Tailwind
  - 파일: `ScheduleView.tsx`, `TimeBlock.tsx`, `TaskCard.tsx`, `TaskModal.tsx`

**Week 3:**
- [ ] **features/gamification/** (예상 1일)
  - `gamification.css` → Tailwind
  - 파일: `QuestsPanel.tsx`, `LevelUpModal.tsx`

- [ ] **features/waifu/** (예상 1일)
  - `waifu.css` → Tailwind
  - 파일: `WaifuPanel.tsx`

- [ ] **features/gemini/** (예상 1일)
  - `gemini-fullscreen.css` → Tailwind
  - 파일: `GeminiFullscreenChat.tsx`

- [ ] **features/settings/** (예상 1일)
  - `settings.css`, `syncLog.css` → Tailwind
  - 파일: `SettingsModal.tsx`, `SyncLog.tsx`

**우선순위 3: 나머지 Features**
- [ ] **features/energy/** - `energy.css` → Tailwind
- [ ] **features/shop/** - `shop.css` → Tailwind
- [ ] **features/stats/** - `stats.css` → Tailwind
- [ ] **features/template/** - `template.css`, `templatesModal.css` → Tailwind
- [ ] **features/insight/** - 별도 CSS 없음 (인라인 스타일만 전환)

**우선순위 4: App Components**
- [ ] **app/components/**
  - `TopToolbar.tsx`
  - `LeftSidebar.tsx`
  - `RightPanel.tsx`
  - `CenterContent.tsx`

---

### Phase 3: 최적화 및 정리 (3-5일)

- [ ] **사용하지 않는 CSS 파일 제거**
  ```bash
  # 마이그레이션 완료된 CSS 파일 삭제
  rm src/shared/components/XPBar.css
  rm src/shared/components/XPToast.css
  rm src/features/tasks/tasks.css
  rm src/features/tasks/bulkAdd.css
  rm src/features/schedule/schedule.css
  rm src/features/gamification/gamification.css
  rm src/features/waifu/waifu.css
  rm src/features/gemini/gemini-fullscreen.css
  rm src/features/settings/settings.css
  rm src/features/settings/syncLog.css
  rm src/features/energy/energy.css
  rm src/features/shop/shop.css
  rm src/features/stats/stats.css
  rm src/features/template/template.css
  rm src/features/template/templatesModal.css
  ```

- [ ] **import 문 정리**
  - 모든 `import './xxx.css'` 제거
  - 남은 globals.css, layout.css, design-system.css 검토

- [ ] **globals.css 정리**
  - Tailwind로 전환 불가능한 스타일만 유지:
    - `@keyframes` 애니메이션 (복잡한 것)
    - 스크롤바 커스터마이징 (`::-webkit-scrollbar`)
    - 테마별 CSS 변수 (`[data-theme="ocean"]` 등)
    - 접근성 관련 스타일 (`:focus-visible`, `prefers-reduced-motion` 등)
    - 모달 시스템 스타일 (`.modal-overlay`, `.modal-content`)

- [ ] **layout.css & design-system.css 검토**
  - Tailwind로 전환 가능한 부분 제거
  - 반드시 필요한 레이아웃 스타일만 유지

- [ ] **빌드 크기 확인**
  ```bash
  npm run build
  # dist/assets/*.css 크기 확인
  # Before vs After 비교
  ```

- [ ] **성능 테스트**
  - 첫 페이지 로드 시간 측정
  - CSS 번들 크기 측정
  - Lighthouse 점수 확인

- [ ] **접근성 테스트**
  - 키보드 내비게이션 확인
  - 스크린 리더 호환성 확인
  - 포커스 인디케이터 확인

---

### Phase 4: 고급 기능 (선택사항, 1주)

- [ ] **다크모드 전환 Tailwind 방식 고려**
  - 현재: `[data-theme="ocean"]` 등 CSS 변수
  - Tailwind: `dark:` modifier 사용 가능
  - 둘 중 선택 또는 병행 사용

- [ ] **커스텀 플러그인 개발**
  ```js
  // tailwind.config.js
  const plugin = require('tailwindcss/plugin')

  module.exports = {
    plugins: [
      plugin(function({ addUtilities, addComponents }) {
        addUtilities({
          '.scrollbar-thin': {
            'scrollbar-width': 'thin',
          },
        })
        addComponents({
          '.time-block': {
            // 복잡한 time-block 스타일을 컴포넌트로 추출
          }
        })
      })
    ]
  }
  ```

- [ ] **VSCode 확장 설치 권장**
  - Tailwind CSS IntelliSense
  - Prettier 플러그인: `prettier-plugin-tailwindcss`

- [ ] **린트 규칙 추가 (선택)**
  - `eslint-plugin-tailwindcss` 설치 및 설정
  - 클래스명 순서 자동 정렬

---

## 📝 마이그레이션 체크리스트

### Setup (완료)
- [x] Tailwind 패키지 설치
- [x] tailwind.config.js 디자인 시스템 매핑
- [x] postcss.config.js 설정
- [x] globals.css에 Tailwind 디렉티브 추가
- [x] 개발 서버에서 Tailwind 동작 확인

### 컴포넌트 마이그레이션 (진행 예정)
- [ ] shared/components (2개)
- [ ] features/tasks (5개 파일)
- [ ] features/schedule (6개 파일)
- [ ] features/gamification
- [ ] features/waifu
- [ ] features/gemini
- [ ] features/settings
- [ ] features/energy
- [ ] features/shop
- [ ] features/stats
- [ ] features/template
- [ ] app/components (4개)

### 정리 (진행 예정)
- [ ] CSS 파일 제거
- [ ] import 문 정리
- [ ] globals.css 정리
- [ ] 빌드 크기 확인
- [ ] 성능 테스트
- [ ] 접근성 테스트

---

## 🎯 컴포넌트별 마이그레이션 가이드

### 기본 변환 규칙

#### 1. 레이아웃
```tsx
// Before
<div className="time-block">
  <div className="block-header">

// After
<div className="flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden">
  <div className="flex items-center justify-between p-lg border-b border-border">
```

#### 2. 간격
```tsx
// Before: CSS variables
padding: var(--spacing-md);
gap: var(--spacing-sm);

// After: Tailwind
className="p-md gap-sm"
```

#### 3. 색상
```tsx
// Before
background: var(--color-primary);
color: var(--color-text-secondary);

// After
className="bg-primary text-text-secondary"
```

#### 4. 타이포그래피
```tsx
// Before
font-size: var(--text-lg);
font-weight: var(--font-semibold);
line-height: var(--leading-tight);

// After
className="text-lg font-semibold leading-tight"
```

#### 5. 호버 상태
```tsx
// Before CSS
.btn:hover {
  background: var(--color-primary-dark);
}

// After Tailwind
className="bg-primary hover:bg-primary-dark transition-colors"
```

#### 6. 복잡한 스타일은 @layer components
```css
/* globals.css */
@layer components {
  .time-block-animated {
    @apply relative flex flex-col bg-bg-surface border border-border rounded-lg;
    @apply transition-all duration-300 ease-out;
  }

  .time-block-animated.current-block {
    @apply border-2 border-primary shadow-lg scale-[1.01];
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  }
}
```

---

## ⚠️ 주의사항

### 1. 점진적 마이그레이션 필수
- 한 번에 모든 파일을 전환하지 마세요
- Feature 단위 또는 컴포넌트 단위로 진행
- 각 단계마다 테스트

### 2. 하이브리드 접근
- Tailwind로 전환이 어려운 복잡한 스타일은 기존 CSS 유지 가능
- `@layer components`를 활용하여 재사용 가능한 컴포넌트 스타일 정의

### 3. 테마 시스템 유지
- 기존 `[data-theme="ocean"]` 등 CSS 변수 기반 테마는 그대로 유지
- Tailwind와 병행 사용 가능

### 4. 접근성 우선
- 기존 접근성 스타일 (`:focus-visible`, `prefers-reduced-motion` 등) 절대 제거 금지
- 마이그레이션 후 키보드 내비게이션 테스트 필수

### 5. 성능 모니터링
- 각 Phase 완료 후 빌드 크기 확인
- CSS 번들 크기가 오히려 커지면 설정 재검토

---

## 🚀 다음 단계

1. **Phase 2.3 시작**: `src/shared/components/XPBar.tsx` 마이그레이션부터 시작
2. **테스트 작성**: 각 컴포넌트 마이그레이션 후 시각적 회귀 테스트
3. **문서화**: 마이그레이션 과정에서 발견한 패턴을 이 문서에 계속 업데이트

---

## 📚 참고 자료

- [Tailwind CSS 공식 문서](https://tailwindcss.com/docs)
- [Tailwind with Vite](https://tailwindcss.com/docs/guides/vite)
- [Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- [Tailwind Layer 시스템](https://tailwindcss.com/docs/adding-custom-styles#using-css-and-layer)
- [Prettier Plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)

---

**마이그레이션 시작일**: 2025-11-16
**Phase 1 완료일**: 2025-11-16
**예상 완료일**: 2025-12-07 (3주 예상)
