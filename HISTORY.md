# TimeBlock Planner - Project History

이 문서는 TimeBlock Planner 프로젝트의 주요 개발 과정과 변경사항을 시간순으로 정리합니다.

---

## 🎯 Phase 1: 초기 프로토타입 (Pre-v1.0.1)

### 핵심 기능 구축
- **시간 블록 시스템 구현**
  - 6개 시간 블록 (5-8, 8-11, 11-14, 14-17, 17-20, 20-23)
  - 시간당 바(Hour Bar) 및 50분 집중 타이머
  - 저항도 레벨 시스템 (Low/Medium/High)

- **드래그 앤 드롭 시스템**
  - 초기 구현 및 여러 버그 수정 (Phase 1-2)
  - 통합 드래그 드롭 시스템 구축
  - 크로스 테이블 드래그 드롭 지원
  - 중복 작업 버그 및 작업 사라짐 버그 수정

- **데이터 아키텍처 확립**
  - IndexedDB (Dexie) 기반 로컬 데이터베이스
  - Firebase Realtime Database 동기화
  - Repository 패턴 구현 (BaseRepository)
  - 3-Tier 폴백 시스템 (IndexedDB → localStorage → Firebase)

- **AI 통합**
  - Gemini API 통합
  - AI 컨텍스트 생성 및 API 호출 통합 (aiService)
  - 작업 세부사항을 AI PersonaContext에 추가

- **UI 기능**
  - 왼쪽/오른쪽 패널 접기 기능
  - 시간 블록 내 시간바 표시
  - 인라인 작업 추가 입력창

---

## 🚀 Phase 2: Electron 통합 및 배포 자동화 (v1.0.1~v1.0.14)

### v1.0.1 - Electron 앱 변환
- Windows `.exe` 패키징을 위한 Electron 통합
- ES 모듈로 빌드 변환
- CommonJS (.cjs) 형식으로 Main/Preload 프로세스 구현

### v1.0.2~v1.0.4 - 데이터 동기화 개선
- Firebase 초기화를 Store 로딩 전에 실행하여 크로스 디바이스 데이터 폴백 구현
- Firebase에서 모든 컬렉션 (inbox, energy, shop, waifu) 가져오기 및 저장
- undefined 값 제거 데이터 정제
- ID 기반 병합 전략으로 globalInbox 데이터 손실 방지

### v1.0.3 - 자동 배포 시스템
- GitHub Actions 릴리스 워크플로우 추가
- Windows 빌드 자동화
- 중앙 집중식 버전 관리 스크립트 (`npm run bump`)

### v1.0.4 - 자동 업데이트 시스템
- electron-updater 구현
- 앱 버전 표시 (Settings 모달)

### v1.0.6 - QuickAdd 기능
- 전역 단축키 추가 (Ctrl+Shift+Space / Cmd+Shift+Space)
- 빠른 작업 추가 모달

### v1.0.7~v1.0.11 - 업데이트 및 UI 개선
- 수동 업데이트 확인 기능
- auto-update 404 에러 수정 (repository 필드 및 명시적 feed URL)
- QuickAdd 디자인 개편 (TaskModal UI)
- 다운로드 진행률 피드백 개선

### v1.0.12~v1.0.14 - 템플릿 자동 생성
- 템플릿 자동 생성 시간대 및 사용자 데이터 확인 이슈 수정
- QuickAdd 모달 크기 및 저장 기능 수정

---

## 🎨 Phase 3: UI/UX 개선 및 기능 확장 (v1.0.15~v1.0.26)

### v1.0.15 - 템플릿 관리 강화
- 템플릿 관리 UI 개선 (매일 주기 필터)
- 더블클릭 편집 기능
- 템플릿 이미지 썸네일 추가

### v1.0.16 - 드래그 앤 드롭 버그 수정
- 5분 후 잠금 버튼 표시
- 드래그 앤 드롭 복사 버그 수정
- Quick Add 저장 버그 수정

### v1.0.17~v1.0.26 - XP 시스템 버그 수정 집중기
- **v1.0.17**: 작업 완료 시 XP 미증가 버그 수정
- **v1.0.18**:
  - Zustand 상태 관리 구조 개선 및 중복 제거
  - 타이머 보너스 XP 저장 시 UI 업데이트 누락 수정
- **v1.0.19~v1.0.21**:
  - 디버그 로그 추가하여 XP 증가 추적
  - InboxTab에서 작업 완료 시 XP 미증가 근본 원인 수정
- **v1.0.22~v1.0.26**:
  - 디버그 로그 제거 및 코드 정리
  - 마이그레이션 작업

---

## 🤖 Phase 4: AI 기능 및 서버 아키텍처 (v1.0.27~v1.0.36)

### v1.0.29~v1.0.30 - 서버 우선 전략
- **서버 우선 전략 구현**: 템플릿 자동 생성
  - Firebase Cloud Function이 매일 00:00 KST에 템플릿 생성
  - 클라이언트는 관찰만 하고 생성하지 않음
- 공유 상수, 로깅, 에러 핸들링 유틸리티 추가

### v1.0.33~v1.0.36 - AI 작업 분해 기능
- AI 작업 분해 UX 개선 및 고급 기능 추가
- TaskBreakdownModal에서 사용자 선택 timeBlock 보존
- 원본 작업에서 defaultTimeBlock 초기화 수정
- 집중모드 추가

---

## 🔄 Phase 5: 데이터 동기화 안정화 (v1.0.37~v1.0.42)

### v1.0.37~v1.0.38
- 와이푸 패널 관련 수정
- Store 중심 아키텍처로 inbox 데이터 동기화 리팩토링

### v1.0.39~v1.0.41
- inbox 데이터 동기화 및 Firebase 필터링 이슈 수정
- useEffect 의존성 수정 및 inbox sync용 디버그 헬퍼 추가
- 데이터 동기화 관련 브랜치 revert (여러 시도)

### v1.0.42
- Settings 모달 업데이트

---

## 📚 Phase 6: 문서화 및 새로운 기능 (v1.0.43~v1.0.50)

### v1.0.43~v1.0.45 - 프로젝트 문서화
- **CLAUDE.md** 추가: 코드베이스 아키텍처 및 개발 가이드
- **README.md** 작성: 포괄적인 프로젝트 문서
- 문서 삭제 및 복원 과정 (실험)

### v1.0.46~v1.0.47 - 새로운 기능 모듈
- 와이푸, 데일리 골, 상점, inbox, 설정 기능 추가
  - 각 기능의 store, modal, panel, hook 구현
- 상품 인풋 디자인 변경
- Don't-Do 체크리스트 기능 및 타입 추가

### v1.0.48~v1.0.50 - 최신 버전
- **v1.0.48**:
  - 포괄적인 아키텍처 분석 문서 추가
- **v1.0.50**:
  - Don't-Do 체크리스트 기능을 시간 블록에 추가 (최신)

---

## 📊 주요 기술 스택 진화

### 초기 스택
- React + TypeScript
- Vite 빌드 시스템
- Tailwind CSS
- IndexedDB (Dexie)
- Firebase Realtime Database

### 추가된 기술
- **Electron** (v1.0.1): 데스크톱 앱 패키징
- **electron-updater** (v1.0.4): 자동 업데이트
- **GitHub Actions** (v1.0.3): CI/CD 자동화
- **Zustand** (리팩토링): 상태 관리 개선
- **Firebase Functions** (v1.0.29): 서버 사이드 로직

---

## 🎮 게임화 시스템 발전

1. **초기**: XP 및 레벨 시스템
2. **v1.0.17~v1.0.26**: XP 계산 및 보상 시스템 안정화
3. **현재**:
   - XP 시스템
   - 데일리 퀘스트
   - 상점 시스템
   - 와이푸 동반자 (affection 시스템)
   - 작업 완료 핸들러 파이프라인

---

## 🔧 주요 버그 수정 히스토리

### 드래그 앤 드롭 관련
- 중요 드래그 드롭 이슈 (Phase 1)
- 통합 드래그 드롭 시스템 구현 (Phase 2)
- 중복 작업 버그 (double addition)
- 작업 사라짐 버그 (hourSlot null)
- Inbox 드래그 드롭 및 완료 탭 이슈
- 크로스 테이블 드래그 드롭 및 TypeScript 에러

### XP 시스템 관련
- 작업 완료 시 XP 미증가 (v1.0.17, v1.0.18, v1.0.21)
- 타이머 보너스 XP 저장 시 UI 업데이트 누락 (v1.0.18)
- InboxTab XP 미증가 근본 원인 (v1.0.21)

### 데이터 동기화 관련
- Firebase 초기화 순서 (v1.0.2)
- IndexedDB 저장 에러 처리 (v1.0.2)
- ID 기반 병합 전략 (v1.0.2)
- Inbox 데이터 동기화 및 Firebase 필터링 (v1.0.39)

### 자동 업데이트 관련
- auto-update 404 에러 (v1.0.8)
- QuickAdd 저장 버그 (v1.0.9, v1.0.14, v1.0.16)

---

## 🌟 미래 개발 방향

프로젝트는 현재 **v1.0.50**에 도달했으며, 다음과 같은 주요 기능을 보유하고 있습니다:

- ✅ 시간 블록 기반 작업 관리
- ✅ 게임화 시스템 (XP, 레벨, 퀘스트)
- ✅ AI 통합 (Gemini)
- ✅ 데스크톱 앱 (Electron)
- ✅ 크로스 디바이스 동기화 (Firebase)
- ✅ 자동 업데이트 시스템
- ✅ 와이푸 동반자 시스템
- ✅ Don't-Do 체크리스트

---

## 📈 통계

- **총 커밋 수**: 165개
- **개발 기간**: v1.0.1 ~ v1.0.50 (50 버전)
- **주요 리팩토링**: 3회 (드래그 드롭, Zustand, 데이터 동기화)
- **주요 기능 추가**: 15개 이상
- **버그 수정**: 30개 이상

---

*마지막 업데이트: 2025-11-21*
*현재 버전: v1.0.50*
