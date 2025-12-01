# TimeBlock Planner – AI Agent Guide

## Architecture Overview
- **Electron + React + TypeScript**: Renderer in `src/**`, desktop shell in `electron/main` + `electron/preload`. Entry: `src/main.tsx` → `AppShell`.
- **Feature-first structure**: `src/features/*` (schedule, waifu, gemini, ignition, etc.) with co-located UI, hooks, utils. Cross-cutting code in `src/shared/**`.
- **State flow**: Zustand stores (`src/shared/stores/*`) → Repository layer (`src/data/repositories/*`) → Dexie (IndexedDB) → Firebase (async sync).

## Critical Policies

### ⛔ localStorage 금지
```typescript```typescript

// ❌ 금지 (개발 환경에서 경고 발생)
localStorage.setItem('key', value);

// ✅ 올바른 방법 - Dexie systemState
import { db } from '@/data/db/dexieClient';
await db.systemState.put({ key: 'myKey', value: data });
```
- **유일한 예외**: `theme` 키 (Dexie 초기화 전 필요)

### ⛔ 하드코딩 기본값 금지
```typescript
// ❌ 금지 - 불일치 버그 원인
const cooldown = settings?.ignitionCooldownMinutes ?? 5;

// ✅ 올바른 방법 - 중앙 집중 defaults
import { SETTING_DEFAULTS, IGNITION_DEFAULTS } from '@/shared/constants/defaults';
const cooldown = settings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes;
```

## Key Patterns

### Data Persistence
- **Repository Pattern**: 모든 CRUD는 `src/data/repositories/*`를 통해서만. 직접 Dexie/Firebase 호출 금지.
- **Dexie Schema**: `src/data/db/dexieClient.ts` (현재 v12). 스키마 변경 시 버전 증가 + `upgrade()` 마이그레이션 추가.
- **Firebase Sync**: `syncToFirebase(strategy, data, key)` 패턴. 전략은 `src/shared/services/sync/firebase/strategies.ts`에 정의.

### Task 저장소 이원화
```typescript
// Task는 두 곳에 저장됨:
// - dailyData.tasks: timeBlock !== null (스케줄된 작업)
// - globalInbox: timeBlock === null (대기 작업)

// 저장소 위치를 모를 때:
import { updateAnyTask, getAnyTask } from '@/shared/services/task/unifiedTaskService';
await updateAnyTask(taskId, updates); // 자동 위치 감지
```

### Task Completion Pipeline
작업 완료 시 `taskCompletionService.ts`가 핸들러 체인 실행:
1. `GoalProgressHandler` → 목표 진행률
2. `XPRewardHandler` → XP 지급
3. `QuestProgressHandler` → 퀘스트 업데이트
4. `WaifuAffectionHandler` → 호감도 변경
5. `BlockCompletionHandler` → 퍼펙트 블록 판정

새 부수효과 추가: `src/shared/services/gameplay/taskCompletion/handlers/`에 `TaskCompletionHandler` 구현.

### EventBus 사용 규칙
```typescript
// ✅ Store에서 emit, Subscriber에서 구독
eventBus.emit('task:completed', { taskId, xpEarned }, { source: 'dailyDataStore' });

// ❌ UI 컴포넌트에서 emit 금지, 렌더링 트리거로 사용 금지
```
- 구독 위치: `src/shared/subscribers/*.ts`
- 명명: `[domain]:[action]` (예: `task:completed`, `block:locked`)
- `useEffect` cleanup에서 반드시 구독 해제

## Development Workflow
```bash
npm run electron:dev    # 권장 개발 루프 (풀 Electron 앱)
npm run dev             # Vite 렌더러만
npm run lint            # 유일한 자동 검사 (테스트 없음)
npm run electron:prod   # 프로덕션 빌드 검증
npm run dist:win        # Windows 배포 빌드
```

## File Conventions
- **Imports**: `@/` alias 사용 (예: `@/shared/stores`)
- **Naming**: Components = PascalCase, hooks/services = camelCase
- **Large modules**: 폴더로 분해 (예: `dailyData/` → coreOperations, taskOperations 등)

## Integration Points
| 기능 | 위치 | 비고 |
|------|------|------|
| Gemini AI | `src/shared/services/ai/gemini/` | `personaUtils`로 컨텍스트 빌드 후 호출 |
| Waifu 이미지 | `public/assets/waifu/poses/{tier}/` | hostile/wary/indifferent/affectionate/loving |
| Quick Add | `?mode=quickadd` | `Ctrl+Shift+Space`, `inboxRepository` 사용 |
| Template 자동생성 | `functions/index.js` | 00:00 KST 서버 실행, 클라이언트 생성 금지 |

## Debugging
- **Firebase Sync**: SyncLog 모달 (`src/features/settings/SyncLogModal.tsx`)
- **EventBus**: `window.__performanceMonitor.printReport()` (dev 환경)
- **RAG**: `window.hybridRag.generateContext()`, `window.rag.debugGetAllDocs()`

## Documentation Map
- Firebase Sync: `src/shared/services/sync/firebase/README.md`
- EventBus: `src/shared/lib/eventBus/README.md`
- Task Service: `src/shared/services/task/README.md`
- Task Completion: `src/shared/services/gameplay/taskCompletion/README.md`
- Dexie Schema: `src/data/db/README.md`
