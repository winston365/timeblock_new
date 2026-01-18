# 아키텍처 개요

TimeBlock Planner의 전체 시스템 아키텍처입니다.

## 핵심 원칙

### Local-First

모든 데이터는 로컬(IndexedDB)에 먼저 저장되고, 백그라운드에서 클라우드(Firebase)로 동기화됩니다.

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 인터페이스                         │
│                   (React 19 Components)                     │
├─────────────────────────────────────────────────────────────┤
│                     Zustand 스토어                           │
│  dailyDataStore | gameStateStore | settingsStore | ...      │
├─────────────────────────────────────────────────────────────┤
│                     Repository 계층                          │
│  dailyDataRepository | gameStateRepository | ...            │
├────────────────────────────┬────────────────────────────────┤
│     IndexedDB (Dexie)      │      Firebase RTDB             │
│        [Primary]           │      [Cloud Backup]            │
│     • 즉시 저장             │     • 비동기 동기화             │
│     • 오프라인 지원          │     • 다중 기기 동기화          │
└────────────────────────────┴────────────────────────────────┘
```

### Feature-First 모듈화

기능별로 코드를 분리하여 각 feature가 자체 완결적 구조를 가집니다.

```
features/
├── schedule/      # 타임블로킹 (가장 큰 기능)
├── waifu/         # AI 동반자
├── gamification/  # 게이미피케이션
├── gemini/        # AI 채팅
└── ...
```

## 계층 구조

### 1. Presentation Layer (UI)

- **React 19 Components** - 함수형 컴포넌트, 훅 기반
- **Zustand 스토어** - UI 상태 관리
- **EventBus** - 컴포넌트 간 통신

### 2. Business Logic Layer

- **Services** - 도메인 로직 (taskCompletionService, syncService 등)
- **Handlers** - 작업 완료 파이프라인
- **RAG System** - AI 컨텍스트 생성

### 3. Data Access Layer

- **Repositories** - 데이터 접근 추상화
- **Dexie Client** - IndexedDB 래퍼
- **Sync Strategies** - Firebase 동기화 전략

## 데이터 흐름

### 읽기 흐름

```
Component
    ↓ useStore()
Zustand Store (메모리 상태)
    ↓ 초기 로드 시
Repository
    ↓
Dexie (IndexedDB)
```

### 쓰기 흐름

```
Component
    ↓ store.updateTask()
Zustand Store
    ↓ 낙관적 업데이트
Repository.update()
    ├──→ Dexie (동기)
    └──→ Firebase (비동기)
         ├──→ 성공: 완료
         └──→ 실패: Retry Queue
```

## 핵심 패턴

### Repository Pattern

UI는 절대 데이터베이스에 직접 접근하지 않습니다.

```typescript
// ❌ 잘못된 방식
const tasks = await db.dailyData.where('date').equals(today).toArray();

// ✅ 올바른 방식
const tasks = await dailyDataRepository.getByDate(today);
```

### Handler Pattern

작업 완료 시 발생하는 사이드 이펙트를 핸들러 체인으로 처리합니다.

```
TaskComplete
    → GoalProgressHandler (목표 진행도)
    → XPRewardHandler (XP 계산)
    → QuestProgressHandler (퀘스트 갱신)
    → WaifuAffectionHandler (호감도)
    → BlockCompletionHandler (블록 확정)
```

### Optimistic Update

UI를 먼저 업데이트하고, 백그라운드에서 저장합니다.

```typescript
// 원본 저장
const originalState = { ...state };

// UI 즉시 업데이트
setState(newState);

try {
  await repository.update(newState);
} catch (error) {
  // 실패 시 롤백
  setState(originalState);
}
```

## Electron 구조

```
┌──────────────────────────────────────────────┐
│              Main Process                     │
│  • 윈도우 관리                                 │
│  • IPC 핸들러                                  │
│  • 자동 업데이트                               │
│  • 글로벌 단축키 (Ctrl+Shift+Space)           │
├──────────────────────────────────────────────┤
│              Preload Script                   │
│  • contextBridge (보안 IPC 브릿지)            │
├──────────────────────────────────────────────┤
│              Renderer Process                 │
│  • React 앱                                   │
│  • nodeIntegration: false                     │
│  • contextIsolation: true                     │
│  • sandbox: true                              │
└──────────────────────────────────────────────┘
```

## 다음 단계

- [데이터 계층](/architecture/data-layer) - Repository와 Dexie 상세
- [Firebase 동기화](/architecture/firebase-sync) - 동기화 전략 상세
- [Handler 패턴](/architecture/handler-pattern) - 작업 완료 파이프라인
