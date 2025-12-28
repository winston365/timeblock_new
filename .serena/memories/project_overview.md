# TimeBlock Planner - 프로젝트 개요

## 목적
TimeBlock Planner는 타임블로킹(Time-blocking) 방법론을 게임화 요소와 결합한 **데스크톱 생산성 애플리케이션**입니다.
- 하루를 6개의 시간 블록으로 나누어 작업 관리
- 경험치(XP), 레벨, 일일 퀘스트 등 게이미피케이션 요소
- AI 가상 동반자 (Waifu Companion)와 상호작용
- Google Gemini AI 통합 채팅 및 작업 지원
- 하이브리드 RAG 시스템으로 과거 작업 기록 기반 AI 응답

## 기술 스택

### Frontend
- **React 19** - UI 프레임워크
- **TypeScript 5.5** - 타입 안전성 (strict mode)
- **Vite 7.2** - 빌드 도구 및 개발 서버
- **Tailwind CSS 3.4** - 스타일링
- **Zustand 5.0** - 상태 관리
- **Framer Motion 12** - 애니메이션
- **Recharts 2.13** - 통계 차트

### Desktop
- **Electron 39** - 크로스 플랫폼 데스크톱 앱
- **electron-updater 6** - 자동 업데이트

### 데이터 지속성
1. **Dexie (IndexedDB)** - 로컬 데이터베이스 (Primary)
2. **Firebase Realtime Database** - 클라우드 동기화

### AI & Backend
- **Google Gemini API** - AI 채팅 및 작업 지원
- **Orama 3.1** - 인메모리 벡터 검색 엔진 (RAG 시스템)
- **Zod 4** - 스키마 검증

## 주요 특징
- **Repository Pattern**: 모든 데이터 접근은 Repository 레이어를 통해 수행
- **Handler Pattern**: 작업 완료 시 파이프라인 (XP, 퀘스트, 목표 등)
- **EventBus**: Pub/Sub 패턴의 이벤트 기반 UI 로직
- **Firebase Sync Strategy Pattern**: 데이터 타입별 동기화 전략

## 아키텍처 특이사항
- **Local-first**: Electron 데스크톱 앱으로, UI는 클라이언트 전용 React (SSR 없음)
- **localStorage 사용 금지**: `theme` 키를 제외한 모든 데이터는 Dexie `systemState` 테이블 사용
- **dexieClient 직접 import 금지**: Repository 레이어를 통해서만 DB 접근
- **하드코딩된 기본값 금지**: `src/shared/constants/defaults.ts`의 상수 사용
