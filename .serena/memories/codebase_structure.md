# 코드베이스 구조

## 루트 디렉토리
```
timeblock_new/
├── src/                    # 소스 코드
├── electron/               # Electron 메인/프리로드 프로세스
├── tests/                  # Vitest 테스트
├── public/                 # 정적 에셋
├── functions/              # Firebase Cloud Functions
├── docs/                   # 문서
├── scripts/                # 빌드 스크립트
└── agent-output/           # AI 에이전트 출력 (분석, 계획 등)
```

## src/ 구조
```
src/
├── main.tsx               # 앱 진입점
├── App.tsx                # 루트 컴포넌트
├── app/                   # 앱 쉘 및 초기화
│   ├── AppShell.tsx      # 메인 쉘 (daily reset, template auto-gen)
│   └── hooks/            # 앱 초기화 훅
├── features/              # 기능 모듈 (Feature-based 구조)
│   ├── schedule/         # 타임블로킹 UI (가장 큰 기능)
│   ├── waifu/            # AI 동반자 시스템
│   ├── tasks/            # 작업 관리
│   ├── gemini/           # AI 채팅 통합
│   ├── gamification/     # XP, 퀘스트, 업적
│   ├── goals/            # 글로벌 목표
│   ├── template/         # 작업 템플릿
│   ├── settings/         # 설정 (tabs/ 하위 모듈)
│   ├── stats/            # 통계 대시보드 (tabs/ 하위 모듈)
│   ├── shop/             # XP 상점
│   ├── insight/          # AI 인사이트 패널
│   ├── weather/          # 날씨 정보
│   ├── energy/           # 에너지 레벨 추적
│   ├── focus/            # 포커스 타이머
│   ├── feedback/         # 현실 체크 모달
│   ├── inventory/        # 인벤토리
│   ├── pip/              # Picture-in-Picture
│   ├── quickadd/         # 빠른 작업 추가
│   └── ...
├── shared/                # 공유 코드
│   ├── stores/           # Zustand 상태 관리 (12개 스토어)
│   ├── services/         # 비즈니스 로직
│   │   ├── gameplay/     # 게이미피케이션 핸들러
│   │   ├── sync/         # Firebase 동기화 전략
│   │   ├── ai/           # AI 통합 (Gemini)
│   │   ├── rag/          # 하이브리드 RAG 시스템
│   │   └── task/         # 작업 서비스
│   ├── lib/              # 유틸리티 라이브러리
│   │   └── eventBus/     # Pub/Sub 이벤트 버스
│   ├── constants/        # 상수 (defaults.ts 중요)
│   └── utils/            # 공통 유틸리티
├── data/                  # 데이터 레이어
│   ├── db/               # Dexie 스키마 및 마이그레이션
│   └── repositories/     # Repository Pattern (데이터 접근 계층)
│       └── dailyData/    # 모듈화된 큰 Repository
└── styles/               # 전역 스타일
```

## Feature 폴더 구조 (예: schedule)
```
features/schedule/
├── components/           # UI 컴포넌트
├── hooks/               # 기능별 훅
├── utils/               # 헬퍼 함수
├── stores/              # 기능별 스토어 (필요시)
└── types.ts             # 타입 정의 (필요시)
```

## Zustand 스토어 (src/shared/stores/)
1. `dailyDataStore` - 작업 & 타임블록 상태
2. `gameStateStore` - XP, 레벨, 퀘스트, 스트릭
3. `settingsStore` - API 키, Firebase 설정
4. `waifuCompanionStore` - 동반자 상태
5. `focusStore` - 포커스 타이머
6. `uiStore` - UI 상태 (모달, 패널)
7. `toastStore` - 알림
8. `realityCheckStore` - 현실 체크 모달
9. `inboxStore` - 글로벌 인박스 작업
10. `goalStore` - 글로벌 목표
11. `templateStore` - 작업 템플릿
12. `completedTasksStore` - 완료된 인박스 작업

## 주요 파일 참조
- **DB 스키마**: `src/data/db/dexieClient.ts`
- **기본값**: `src/shared/constants/defaults.ts`
- **Firebase 동기화**: `src/shared/services/sync/firebase/`
- **EventBus**: `src/shared/lib/eventBus/`
- **작업 완료 핸들러**: `src/shared/services/gameplay/taskCompletion/handlers/`
