# TimeBlock Planner

> 게이미피케이션과 AI 동반자 시스템을 결합한 타임블로킹 데일리 플래너

TimeBlock Planner는 시간 관리 방법론인 타임블로킹(Time-blocking)을 게임화 요소와 결합한 데스크톱 애플리케이션입니다. Electron, React, TypeScript로 구축되었으며, AI 가상 동반자와 함께 생산성을 높이고 목표를 달성할 수 있도록 돕습니다.

## ✨ 주요 기능

### 📅 타임블로킹 시스템
- **6개 시간 블록**: 하루를 6개의 시간대로 나누어 관리 (5-8, 8-11, 11-14, 14-17, 17-20, 20-23)
- **저항도 시스템**: 작업에 대한 심리적 저항도를 반영한 실제 소요 시간 예측
  - 🟢 낮음 (1.0x): 즐거운 작업
  - 🟡 보통 (1.3x): 중립적 작업
  - 🔴 높음 (1.6x): 미루고 싶은 작업
- **블록 상태 관리**: lock, perfect, failed, timer 상태로 진행 상황 추적

### 🎮 게이미피케이션
- **경험치(XP) & 레벨 시스템**: 작업 완료 시 XP 획득 및 레벨업
- **일일 퀘스트**: 6가지 유형의 퀘스트로 동기부여
- **상점 시스템**: 획득한 XP로 아이템 구매
- **연속 출석**: 매일 로그인 스트릭 추적

### 🤖 AI 동반자 (Waifu Companion)
- **감정 표현 시스템**: 호감도(0-100)에 따라 변화하는 5가지 감정 포즈
- **특수 포즈**: 상호작용으로 해금 가능한 특별 포즈 (울음, 취함, 놀람 등)
- **자동 메시지**: 설정 가능한 주기적 응원 메시지
- **인터랙션 모드**: 일반 모드 vs 캐릭터 성격 기반 모드

### 🧠 Gemini AI 통합
- **전체 화면 채팅**: AI와 대화하며 작업 계획 및 동기부여
- **작업 분해**: 큰 작업을 작은 단위로 자동 분할
- **일일 토큰 사용량 추적**: 사용량 제한 관리

### 🎯 목표 관리
- **글로벌 목표**: 장기 목표 설정 및 시간 추적
- **템플릿 시스템**: 반복되는 작업을 템플릿으로 저장 및 자동 생성
- **글로벌 인박스**: 날짜 독립적인 작업 관리

### ⚡ 기타 기능
- **포커스 타이머**: 작업 집중을 위한 타이머
- **에너지 레벨 추적**: 시간대별 에너지 수준 기록
- **행동 패턴 추적**: 미루기, 삭제 등 사용자 행동 패턴 분석
- **QuickAdd 모드**: Ctrl+Shift+Space (macOS: Cmd+Shift+Space)로 빠른 작업 추가
- **🔥 점화 시스템**: 3분 마이크로 스텝으로 작업 시작 저항 극복
- **🌤️ 날씨 통합**: Google Search Grounding 기반 실시간 날씨 정보
- **💡 AI 인사이트**: 생산성 패턴 분석 및 맞춤 조언
- **📊 통계 대시보드**: XP 추이, 타임블록별 분포, 목표 진행률

## 🛠 기술 스택

### Frontend
- **React 18.3.1** - UI 프레임워크
- **TypeScript 5.4.5** - 타입 안전성
- **Vite 7.2.2** - 빌드 도구 및 개발 서버
- **Tailwind CSS 3.4** - 스타일링
- **Zustand 5.0.8** - 상태 관리
- **Recharts 2.13** - 통계 차트
- **Framer Motion 12** - 애니메이션

### Desktop
- **Electron 39** - 크로스 플랫폼 데스크톱 앱
- **electron-updater 6** - 자동 업데이트

### 데이터 지속성 (3-Tier 폴백 시스템)
1. **Dexie (IndexedDB)** - 로컬 데이터베이스 (Primary)
2. **localStorage** - 동기식 폴백 (Secondary)
3. **Firebase Realtime Database** - 클라우드 동기화 및 백업 (Cloud)

### AI & Backend
- **Google Gemini API** - AI 채팅 및 작업 지원
- **Firebase Functions** - 서버리스 백엔드 (템플릿 자동 생성)

## 🚀 시작하기

### 사전 요구사항
- Node.js 18 이상
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/winston365/timeblock_new.git
cd timeblock_new

# 의존성 설치
npm install
```

### 개발 모드 실행

```bash
# Electron 개발 모드
npm run electron:dev

# 웹 개발 서버만 실행
npm run dev
```

### 프로덕션 빌드

```bash
# 현재 플랫폼용 배포 파일 생성
npm run dist

# 플랫폼별 빌드
npm run dist:win      # Windows 인스톨러
npm run dist:mac      # macOS 앱
npm run dist:linux    # Linux 패키지
```

## 📝 개발 명령어

```bash
# 개발
npm run dev                    # Vite 개발 서버 시작
npm run electron:dev          # Electron 개발 모드
npm run electron:prod         # 프로덕션 빌드 로컬 실행

# 빌드
npm run build                 # 웹 에셋 빌드 (Vite)
npm run electron:build        # Electron 메인 프로세스 빌드
npm run dist                  # 배포용 빌드 (현재 플랫폼)
npm run dist:win              # Windows 빌드
npm run dist:mac              # macOS 빌드
npm run dist:linux            # Linux 빌드

# 코드 품질
npm run lint                  # ESLint 실행
npm run bump                  # 패치 버전 증가 및 커밋

# 미리보기
npm run preview               # 프로덕션 빌드 미리보기
```

## 📁 프로젝트 구조

```
timeblock_new/
├── src/
│   ├── features/              # 기능 모듈 (feature-based organization)
│   │   ├── schedule/         # 타임블로킹 UI (가장 큰 기능)
│   │   ├── waifu/            # AI 동반자 시스템 (poses/ 포함)
│   │   ├── tasks/            # 작업 관리
│   │   ├── gemini/           # AI 채팅 통합
│   │   ├── gamification/     # XP, 퀘스트, 업적
│   │   ├── goals/            # 글로벌 목표
│   │   ├── template/         # 작업 템플릿
│   │   ├── settings/         # 설정 및 동기화 로그 (tabs/ 하위 모듈)
│   │   ├── stats/            # 통계 대시보드 (tabs/ 하위 모듈)
│   │   ├── shop/             # XP 상점
│   │   ├── ignition/         # 3분 점화 시스템
│   │   ├── insight/          # AI 인사이트 패널
│   │   ├── weather/          # 날씨 정보 통합
│   │   ├── energy/           # 에너지 레벨 추적
│   │   ├── focus/            # 포커스 타이머
│   │   ├── feedback/         # 현실 체크 모달
│   │   ├── inventory/        # 인벤토리
│   │   ├── pip/              # Picture-in-Picture
│   │   ├── quickadd/         # 빠른 작업 추가
│   │   └── ...
│   ├── shared/
│   │   ├── stores/           # Zustand 상태 관리 스토어
│   │   ├── services/         # 비즈니스 로직 서비스
│   │   │   ├── gameplay/    # 게임화 핸들러
│   │   │   ├── sync/        # Firebase 동기화 전략
│   │   │   └── ai/          # AI 통합
│   │   └── utils/            # 공통 유틸리티
│   ├── data/
│   │   ├── db/              # Dexie 스키마 및 마이그레이션 (v11)
│   │   └── repositories/    # 데이터 접근 레이어 (Repository Pattern)
│   │       └── dailyData/   # DailyData 모듈화 (coreOperations, taskOperations 등)
│   └── App.tsx              # 루트 컴포넌트
├── electron/
│   ├── main/                # Electron 메인 프로세스
│   └── preload/             # Preload 스크립트 (IPC 브릿지)
├── functions/               # Firebase Cloud Functions
├── public/                  # 정적 에셋
├── CLAUDE.md               # AI 개발 가이드
└── package.json
```

## 🏗 아키텍처 하이라이트

### 3-Tier 데이터 지속성
모든 데이터는 3단계 폴백 시스템으로 관리됩니다:
1. IndexedDB (Dexie) - 고성능 로컬 스토리지
2. localStorage - 동기식 백업
3. Firebase Realtime Database - 클라우드 동기화

모든 데이터 작업은 **Repository Pattern**을 통해 수행되며, 3개 레이어에 자동으로 동기화됩니다.

### Handler Pattern - 작업 완료 파이프라인
작업 완료 시 다음 핸들러들이 순차 실행됩니다:
1. `GoalProgressHandler` - 목표 진행도 업데이트
2. `XPRewardHandler` - XP 계산 및 지급
3. `QuestProgressHandler` - 일일 퀘스트 업데이트
4. `WaifuAffectionHandler` - 동반자 호감도 증가
5. `BlockCompletionHandler` - 타임블록 완료 체크

### Firebase 동기화 아키텍처
- **Strategy Pattern**: 각 데이터 타입별 `SyncStrategy<T>` 구현
- **충돌 해결**: Last-Write-Wins (LWW) 방식
- **재시도 큐**: 실패한 동기화 자동 재시도
- **중복 제거**: 해시 기반 중복 동기화 방지

### Feature-Based 조직
코드베이스는 기능 모듈로 구성되어 있으며, 각 feature는 자체 포함적입니다:
- `components/` - UI 컴포넌트
- `hooks/` - 기능별 React 훅
- `stores/` - 기능별 Zustand 스토어 (필요 시)
- `utils/` - 헬퍼 함수
- `types.ts` - TypeScript 타입 정의

### 상태 관리 - Zustand Stores
12개의 전문화된 스토어로 상태를 관리합니다:
- `dailyDataStore` - 작업 & 타임블록 상태
- `gameStateStore` - XP, 레벨, 퀘스트, 스트릭
- `settingsStore` - API 키, Firebase 설정
- `waifuCompanionStore` - 동반자 상태
- `focusStore` - 포커스 타이머
- `uiStore` - UI 상태
- `toastStore` - 알림
- `realityCheckStore` - 현실 체크 모달
- `inboxStore` - 글로벌 인박스 작업
- `goalStore` - 글로벌 목표
- `templateStore` - 작업 템플릿
- `completedTasksStore` - 완료된 인박스 작업

## 🔐 보안

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- Preload 스크립트를 통한 안전한 IPC 통신

## 🗄 데이터베이스 스키마

11개의 스키마 버전으로 관리되는 주요 테이블 (`src/data/db/dexieClient.ts`):
- **dailyData** - 일일 작업 및 블록 (YYYY-MM-DD 키)
- **gameState** - 플레이어 진행 상황 (싱글톤)
- **templates** - 재사용 가능한 작업 템플릿
- **globalInbox** - 날짜 독립적 작업
- **completedInbox** - 완료된 인박스 작업 (v7+)
- **globalGoals** - 장기 목표 및 시간 추적
- **shopItems** - XP로 구매 가능한 아이템
- **waifuState** - 동반자 호감도 및 상호작용
- **energyLevels** - 시간대별 에너지 추적
- **chatHistory** - Gemini AI 대화 기록
- **dailyTokenUsage** - 일일 Gemini 토큰 사용량
- **systemState** - 시스템 상태 키-값 저장소 (v6+)
- **settings** - 앱 설정 및 하지않기 체크리스트 (v8+)
- **images** - 이미지 저장소 (v9+)
- **weather** - 날씨 캐시 (v10+)
- **aiInsights** - AI 인사이트 캐시 (v11+)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 Private 프로젝트입니다.

## 📞 문의

프로젝트 링크: [https://github.com/winston365/timeblock_new](https://github.com/winston365/timeblock_new)

---

## 📚 Documentation Map

프로젝트 문서 전체 구조입니다. 자세한 내용은 각 링크를 참조하세요.

### 📖 프로젝트 문서
| 문서 | 설명 |
|------|------|
| [README.md](./README.md) | 프로젝트 개요 및 시작 가이드 (현재 문서) |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 개발 환경 설정 및 아키텍처 상세 |
| [CLAUDE.md](./CLAUDE.md) | AI 에이전트용 개발 가이드 |
| [.github/copilot-instructions.md](./.github/copilot-instructions.md) | GitHub Copilot 지침 |

### 🔧 핵심 모듈 문서
| 모듈 | 문서 | 설명 |
|------|------|------|
| Firebase Sync | [README](./src/shared/services/sync/firebase/README.md) | 동기화 전략, 충돌 해결, 마이그레이션 |
| EventBus | [README](./src/shared/lib/eventBus/README.md) | Pub/Sub 패턴, 사용 규칙 (DO/DON'T) |
| Gemini AI | [README](./src/shared/services/ai/gemini/README.md) | API 클라이언트, 페르소나, 작업 분해 |
| Task Completion | [README](./src/shared/services/gameplay/taskCompletion/README.md) | 핸들러 패턴, 실행 흐름 |
| DailyData Repository | [README](./src/data/repositories/dailyData/README.md) | 모듈 구조, CRUD 예시 |
| Dexie (IndexedDB) | [README](./src/data/db/README.md) | 스키마 버전, 마이그레이션 가이드 |

### 📊 분석 문서
| 문서 | 설명 |
|------|------|
| [docs/analysis/INDEX.md](./docs/analysis/INDEX.md) | 코드베이스 분석 인덱스 |
| [docs/analysis/ANALYSIS_SUMMARY.md](./docs/analysis/ANALYSIS_SUMMARY.md) | 분석 요약 |
| [docs/analysis/cross_cutting_analysis.md](./docs/analysis/cross_cutting_analysis.md) | 횡단 관심사 분석 |
| [docs/analysis/refactoring_strategies.md](./docs/analysis/refactoring_strategies.md) | 리팩토링 전략 |

### 🎨 에셋 문서
| 문서 | 설명 |
|------|------|
| [public/assets/waifu/README.md](./public/assets/waifu/README.md) | 와이푸 에셋 구조 |
| [public/assets/waifu/poses/README.md](./public/assets/waifu/poses/README.md) | 포즈 이미지 가이드 |

---

**Made with ❤️ by winston365**
