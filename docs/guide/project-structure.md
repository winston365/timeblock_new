# 프로젝트 구조

TimeBlock Planner의 폴더 구조와 각 모듈의 역할입니다.

## 최상위 구조

```
timeblock_new/
├── electron/           # Electron 메인/프리로드 프로세스
├── src/               # React 앱 소스코드
├── public/            # 정적 에셋
├── tests/             # 테스트 파일
├── docs/              # VitePress 문서
├── functions/         # Firebase Cloud Functions
├── coverage/          # 테스트 커버리지 리포트
└── release/           # 빌드된 인스톨러
```

## src/ 구조

### Feature-First 아키텍처

기능별로 모듈을 분리하여 관련 코드를 한 곳에 모읍니다.

```
src/
├── app/                 # 앱 진입점 및 초기화
│   ├── AppShell.tsx    # 메인 쉘 컴포넌트
│   └── hooks/          # 앱 레벨 훅 (useAppInitialization)
│
├── data/                # 데이터 계층
│   ├── db/             # Dexie 스키마 및 마이그레이션
│   └── repositories/   # 데이터 접근 객체 (DAO)
│
├── features/            # 기능별 모듈 ⭐
│   ├── schedule/       # 타임블로킹 UI (가장 큰 기능)
│   ├── waifu/          # AI 동반자 시스템
│   ├── tasks/          # 작업 관리
│   ├── gemini/         # AI 채팅
│   ├── gamification/   # XP, 퀘스트, 업적
│   ├── goals/          # 글로벌 목표 패널
│   ├── template/       # 작업 템플릿
│   ├── settings/       # 설정 및 동기화 로그
│   ├── stats/          # 통계 대시보드
│   ├── shop/           # XP 상점
│   ├── insight/        # AI 인사이트 패널
│   ├── weather/        # 날씨 통합
│   ├── focus/          # 집중 타이머
│   └── ...
│
├── shared/              # 공용 모듈
│   ├── lib/            # EventBus, 유틸리티 래퍼
│   ├── services/       # 비즈니스 로직 서비스
│   ├── stores/         # Zustand 스토어
│   ├── types/          # 전역 타입 정의
│   ├── utils/          # 헬퍼 함수
│   ├── constants/      # 상수 및 기본값
│   └── components/     # 공용 UI 컴포넌트
│
└── styles/              # 글로벌 스타일
```

## Feature 모듈 구조

각 feature 폴더는 자체 완결적 구조를 가집니다:

```
features/schedule/
├── components/         # UI 컴포넌트
│   ├── TimeBlockCard.tsx
│   ├── TaskItem.tsx
│   └── ...
├── hooks/              # feature 전용 훅
│   └── useScheduleState.ts
├── utils/              # 헬퍼 함수
│   └── timeBlockUtils.ts
├── stores/             # feature 전용 스토어 (필요시)
├── types.ts            # 타입 정의
└── index.ts            # 공개 API
```

## Electron 구조

```
electron/
├── main/
│   └── index.ts        # 메인 프로세스 (윈도우, IPC, 자동 업데이트)
├── preload/
│   └── index.ts        # 프리로드 스크립트 (보안 IPC 브릿지)
└── resources/          # 앱 아이콘 등 리소스
```

## 데이터 계층

```
data/
├── db/
│   └── dexieClient.ts  # Dexie 스키마 v17 + 마이그레이션
└── repositories/
    ├── baseRepository.ts     # 기본 CRUD 추상화
    ├── dailyDataRepository.ts
    ├── gameStateRepository.ts
    ├── templateRepository.ts
    └── dailyData/            # 대형 레포지토리 모듈화
        ├── coreOperations.ts
        ├── taskOperations.ts
        ├── blockOperations.ts
        └── types.ts
```

## 서비스 계층

```
shared/services/
├── sync/
│   └── firebase/       # Firebase 동기화 핵심
│       ├── syncCore.ts
│       ├── strategies.ts
│       ├── conflictResolver.ts
│       └── syncRetryQueue.ts
├── gameplay/
│   └── taskCompletion/
│       ├── taskCompletionService.ts
│       └── handlers/   # 핸들러 체인
├── rag/                # RAG 시스템
│   ├── hybridRAGService.ts
│   ├── vectorStore.ts
│   └── queryParser.ts
└── ai/
    └── gemini/         # Gemini API 클라이언트
```

## 다음 단계

- [아키텍처 개요](/architecture/overview) - 시스템 설계 이해하기
- [데이터 계층](/architecture/data-layer) - Repository 패턴 상세
