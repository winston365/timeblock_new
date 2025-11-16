# Tailwind CSS 마이그레이션 가이드

## ✅ 완료된 작업

### Phase 1: 초기 설정 ✓ (2025-11-16)

- [x] **Tailwind CSS 패키지 설치**
  - `tailwindcss@4.1.17` 설치 완료
  - `postcss@8.5.6` 설치 완료
  - `autoprefixer@10.4.22` 설치 완료

- [x] **tailwind.config.js 생성**
  - 기존 디자인 시스템 CSS 변수 → Tailwind theme으로 완전 매핑
  - 색상: `primary`, `secondary`, `bg`, `text`, `border`, `resistance` 등
  - 간격: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
  - 타이포그래피: `2xs` ~ `3xl` 폰트 크기
  - 애니메이션: `fadeIn`, `scaleIn`, `shimmer`, `bounce` 키프레임

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

### Phase 2.1-2.2: 유틸리티 클래스 ✓ (2025-11-16)

- [x] **새 컴포넌트 Tailwind 가이드라인**
  - 앞으로 모든 신규 컴포넌트는 Tailwind CSS로 작성
  - 기존 CSS 파일 생성 금지

- [x] **기존 유틸리티 클래스 유지**
  - `globals.css`의 `.text-xs`, `.font-bold` 등은 Tailwind와 동일하게 동작
  - 별도 마이그레이션 불필요

### Week 1: Shared Components ✓ (2025-11-16 완료)

- [x] **src/shared/components/XPBar.tsx**
  - `XPBar.css` 제거 ✓
  - Tailwind 클래스로 100% 전환 ✓
  - shimmer 애니메이션 Tailwind config에 추가 ✓
  - 코드 라인: 51줄 → 56줄 (주석 추가)

- [x] **src/shared/components/XPToast.tsx**
  - `XPToast.css` 제거 ✓
  - Tailwind 클래스로 100% 전환 ✓
  - bounce 애니메이션 Tailwind config에 추가 ✓
  - gradient 및 text-shadow는 inline style 유지
  - 코드 라인: 59줄 → 77줄

### Week 2: Features/Tasks ✓ (2025-11-16 완료)

- [x] **features/tasks/InboxTab.tsx**
  - `tasks.css` import 제거 ✓
  - 전체 Tailwind 전환 완료 ✓
  - 드래그 오버 상태 처리 ✓
  - 코드 라인: 195줄 → 203줄

- [x] **features/tasks/CompletedTab.tsx**
  - `tasks.css` import 제거 ✓
  - 전체 Tailwind 전환 완료 ✓
  - 완료 아이템 레이아웃 최적화 ✓
  - 코드 라인: 124줄 → 129줄

- [x] **features/tasks/BulkAddModal.tsx**
  - `bulkAdd.css` import 제거 ✓
  - 전체 Tailwind 전환 완료 ✓
  - 설정, 입력, 미리보기, 버튼 모두 전환 ✓
  - 코드 라인: 347줄 → 363줄

- [x] **CSS 파일 제거**
  - `src/features/tasks/tasks.css` 삭제 ✓
  - `src/features/tasks/bulkAdd.css` 삭제 ✓

**마이그레이션 통계**:
- ✅ 삭제된 CSS 라인: **722줄**
- ✅ 추가된 Tailwind 코드: **140줄**
- ✅ 순 감소: **-582줄** (80% 코드 감소)
- ✅ 완료된 컴포넌트: **5개**
- ✅ 제거된 CSS 파일: **4개**

---

## 📋 남은 작업

### ⏳ 다음 단계: Week 2-3 Features (예상 2-3일)

#### 1. features/schedule/ (우선순위 높음)
**예상 작업 시간**: 2일

파일 목록:
- `ScheduleView.tsx` - schedule.css 사용
- `TimeBlock.tsx` - schedule.css 사용
- `TaskCard.tsx` - schedule.css 사용
- `TaskModal.tsx` - schedule.css 사용

제거할 CSS:
- `src/features/schedule/schedule.css` (복잡한 time-block 애니메이션 포함)

**전환 패턴**:
```tsx
// Before
<div className="time-block">
  <div className="block-header">

// After
<div className="flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden transition-all duration-300">
  <div className="flex items-center justify-between p-lg border-b border-border">
```

**주의사항**:
- `time-block-animated` 등 복잡한 애니메이션은 `@layer components`로 정의 고려
- 현재 블록 강조 효과 (`current-block`) 유지 필요

#### 2. features/gamification/ (우선순위 중간)
**예상 작업 시간**: 1일

파일 목록:
- `QuestsPanel.tsx` - gamification.css 사용
- `LevelUpModal.tsx` - gamification.css 사용

제거할 CSS:
- `src/features/gamification/gamification.css`

**전환 패턴**:
```tsx
// Before
<div className="quest-item">
  <div className="quest-progress">

// After
<div className="flex items-center gap-md p-md bg-bg-surface border border-border rounded-md">
  <div className="flex-1">
```

#### 3. features/waifu/ (우선순위 중간)
**예상 작업 시간**: 1일

파일 목록:
- `WaifuPanel.tsx` - waifu.css 사용

제거할 CSS:
- `src/features/waifu/waifu.css`

**전환 패턴**:
```tsx
// Before
<div className="waifu-container">
  <img className="waifu-image" />

// After
<div className="flex flex-col items-center p-lg">
  <img className="w-full max-w-md rounded-lg shadow-lg transition-all" />
```

---

### 추가 Features (선택사항)

#### 4. features/gemini/
- `GeminiFullscreenChat.tsx` - gemini-fullscreen.css
- 복잡한 visual novel 레이아웃 포함

#### 5. features/settings/
- `SettingsModal.tsx` - settings.css
- `SyncLog.tsx` - syncLog.css

#### 6. features/energy/
- `EnergyTab.tsx` - energy.css

#### 7. features/shop/
- `shop.css`

#### 8. features/stats/
- `StatsTab.tsx` - stats.css

#### 9. features/template/
- `TemplatesModal.tsx` - templatesModal.css, template.css

#### 10. app/components/
- `TopToolbar.tsx`, `LeftSidebar.tsx`, `RightPanel.tsx`, `CenterContent.tsx`
- `src/styles/layout.css` 사용

---

## 🎯 빠른 마이그레이션 가이드

### 자주 사용하는 변환 패턴

#### 1. 레이아웃
```tsx
// Flex Container
className="flex flex-col gap-md"
className="flex justify-between items-center"

// Grid
className="grid grid-cols-3 gap-lg"

// Sizing
className="w-full h-full"
className="max-w-[800px] max-h-[90vh]"
```

#### 2. 간격 & 패딩
```tsx
className="p-md"      // padding: var(--spacing-md)
className="px-lg"     // padding-left/right: var(--spacing-lg)
className="gap-sm"    // gap: var(--spacing-sm)
className="mb-xs"     // margin-bottom: var(--spacing-xs)
```

#### 3. 색상
```tsx
className="bg-bg-surface"      // background: var(--color-bg-surface)
className="text-text-secondary" // color: var(--color-text-secondary)
className="border-border"       // border-color: var(--color-border)
```

#### 4. 타이포그래피
```tsx
className="text-sm font-semibold leading-tight"
className="text-base font-medium"
className="text-xs text-text-tertiary"
```

#### 5. 상태 & 인터랙션
```tsx
className="hover:bg-primary-dark transition-all"
className="focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
className="disabled:opacity-50 disabled:cursor-not-allowed"
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

## 📝 작업 체크리스트

### 컴포넌트 마이그레이션 단계
- [x] shared/components (2개) ✓
- [x] features/tasks (3개) ✓
- [ ] features/schedule (4개)
- [ ] features/gamification (2개)
- [ ] features/waifu (1개)
- [ ] features/gemini
- [ ] features/settings
- [ ] features/energy
- [ ] features/shop
- [ ] features/stats
- [ ] features/template
- [ ] app/components (4개)

### 정리 작업
- [x] XPBar.css, XPToast.css 제거 ✓
- [x] tasks.css, bulkAdd.css 제거 ✓
- [ ] schedule.css 제거
- [ ] gamification.css 제거
- [ ] waifu.css 제거
- [ ] 기타 CSS 파일 제거
- [ ] import 문 정리
- [ ] globals.css 정리
- [ ] 빌드 크기 확인
- [ ] 성능 테스트
- [ ] 접근성 테스트

---

## ⚠️ 주의사항

1. **점진적 마이그레이션**: 한 번에 한 feature씩 진행
2. **하이브리드 접근**: 복잡한 애니메이션은 `@layer components` 활용
3. **테마 시스템 유지**: `[data-theme="ocean"]` 등 CSS 변수 병행 사용
4. **접근성 우선**: `:focus-visible`, `prefers-reduced-motion` 유지
5. **테스트 필수**: 각 feature 전환 후 시각적 확인

---

**최종 목표**: 18개 CSS 파일 → 0개 (globals.css 제외)
**현재 진행률**: 4/18 (22%) ✓
**예상 완료일**: 2025-11-20 (남은 작업 3-4일 예상)
