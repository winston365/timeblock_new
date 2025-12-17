# Value Statement and Business Objective
사용자가 요청한 요구사항(지난 타임블록 숨김, 3시간 타임블록 정의/현재 블록 계산, 워밍업 프리셋 모달/자동삽입, Dexie systemState 접근, defaults 중앙상수)과 직접 연결된 **정확한 코드 위치**를 제시하여, 수정/리팩터링 시 탐색 비용을 최소화합니다.

# Objective
- 레포에서 요구사항 1~6 관련 코드의 **후보 파일 경로 목록**을 제공
- 각 파일별로 요구 구간의 **관련 스니펫(5~15줄)** 을 발췌
- 요구사항 1/2에 대해 **수정 포인트(어디를 바꾸면 되는지) 요약**
- 코드 수정은 하지 않음

# Context
- 앱: Electron + React + TS
- 시간 블록은 `TIME_BLOCKS`(3시간 단위)로 정의됨
- Schedule(list)와 Timeline(view) 모두 “지난 블록 숨김(showPastBlocks)” 개념이 존재하나, 구현 방식/영속화가 다름

# Root Cause (Systemic)
- (Fact) 현재 블록 계산 로직이 여러 곳에 **중복**되어 있음: `TIME_BLOCKS.find(...)`, `timeBlockVisibility.getCurrentBlock(hour)`, `timeBlockUtils.getCurrentBlock()`.
- (Fact) “지난 블록 숨김(showPastBlocks)”이 **뷰별로 다른 의미/저장 방식**을 가짐: ScheduleView는 store-only, TimelineView는 Dexie `systemState` 영속.

# Methodology
- 키워드 기반 코드 검색: `showPastBlocks`, `ScheduleView`, `TIME_BLOCKS`, `getCurrentBlock`, `WarmupPresetModal`, `warmup`, `systemState`, `db.systemState`, `useModalEscapeClose`
- 상위 후보 파일을 선별한 뒤, 해당 파일에서 실제 구현 부분을 5~15줄로 발췌

# Findings (Fact)

## 후보 파일 경로 목록
### 요구사항 1) Schedule 타임블록 렌더링 + 지난 타임블록 가리기
- [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
- [src/features/schedule/stores/scheduleViewStore.ts](src/features/schedule/stores/scheduleViewStore.ts)
- [src/features/schedule/utils/timeBlockVisibility.ts](src/features/schedule/utils/timeBlockVisibility.ts)
- (참고: Timeline에도 별도 구현) [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts)

### 요구사항 2) 3h 타임블록 정의(TIME_BLOCKS) + 현재 블록 계산 유틸
- [src/shared/types/domain.ts](src/shared/types/domain.ts)
- [src/shared/utils/timeBlockUtils.ts](src/shared/utils/timeBlockUtils.ts)
- [src/features/schedule/utils/timeBlockVisibility.ts](src/features/schedule/utils/timeBlockVisibility.ts)
- (참고: ScheduleView 내부 중복) [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)

### 요구사항 3) WarmupPresetModal 파일
- [src/features/schedule/components/WarmupPresetModal.tsx](src/features/schedule/components/WarmupPresetModal.tsx)

### 요구사항 4) 워밍업 자동생성/자동삽입 로직
- [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)

### 요구사항 5) Dexie systemState 접근(읽기/쓰기)
- (Repo wrapper) [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts)
- (Direct access examples)
  - [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts)
  - [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx)
  - [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts)
  - [src/shared/services/sync/firebase/syncUtils.ts](src/shared/services/sync/firebase/syncUtils.ts)
  - [src/shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts)
  - [src/app/hooks/usePanelLayout.ts](src/app/hooks/usePanelLayout.ts)
- (Dexie schema) [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)

### 요구사항 6) defaults 중앙 상수
- [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)

---

## 스니펫 모음 (파일별 5~15줄)

### 1) Schedule: showPastBlocks 상태(스토어)
파일: [src/features/schedule/stores/scheduleViewStore.ts](src/features/schedule/stores/scheduleViewStore.ts)
```ts
interface ScheduleViewState {
    // 지난 블록 표시 여부
    showPastBlocks: boolean;
    toggleShowPastBlocks: () => void;
    setShowPastBlocks: (show: boolean) => void;

    // 워밍업 모달 열림 여부
    isWarmupModalOpen: boolean;
    openWarmupModal: () => void;
    closeWarmupModal: () => void;
}
```

### 1) Schedule: 타임블록 렌더링 시 가시성 정책 적용
파일: [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
```tsx
const { 
  showPastBlocks, 
  isWarmupModalOpen, 
  closeWarmupModal 
} = useScheduleViewStore();

// 표시 정책: 기본적으로 현재 블록만 표시, showPastBlocks가 true면 과거 포함한 전체 표시
const visibilityMode: VisibilityMode = showPastBlocks ? 'all' : 'current-only';
const blocksToRender = getVisibleBlocks(currentHour, visibilityMode);
const currentBlock = getCurrentBlock(currentHour);
```

### 1) Schedule: 실제 렌더 루프(필터링 결과 blocksToRender)
파일: [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
```tsx
{blocksToRender.map((block, index) => {
  const blockTasks = sortTasks(dailyData.tasks.filter(task => task.timeBlock === block.id));
  const blockState = dailyData.timeBlockStates[block.id];
  const isCurrentBlock = block.id === currentBlockId;
  const isPastBlock = currentHour >= block.end;

  return (
    <div key={block.id} style={{ zIndex: blocksToRender.length - index, position: 'relative' }}>
      <TimeBlock ... />
    </div>
  );
})}
```

### 1/2) timeBlockVisibility: 모드(숨김 정책) + visible blocks 계산
파일: [src/features/schedule/utils/timeBlockVisibility.ts](src/features/schedule/utils/timeBlockVisibility.ts)
```ts
export type VisibilityMode =
  | 'all'
  | 'hide-past'
  | 'current-only';

export function getCurrentBlock(hour: number): TimeBlock | null {
  return TIME_BLOCKS.find((b) => hour >= b.start && hour < b.end) ?? null;
}

export function getVisibleBlocks(currentHour: number, mode: VisibilityMode): TimeBlock[] {
  return TIME_BLOCKS.filter((block) => shouldShowBlock(block, currentHour, mode));
}
```

### 2) TIME_BLOCKS: 3시간 타임블록 정의
파일: [src/shared/types/domain.ts](src/shared/types/domain.ts)
```ts
export const TIME_BLOCKS = [
  { id: '5-8', label: '05:00 - 08:00', start: 5, end: 8 },
  { id: '8-11', label: '08:00 - 11:00', start: 8, end: 11 },
  { id: '11-14', label: '11:00 - 14:00', start: 11, end: 14 },
  { id: '14-17', label: '14:00 - 17:00', start: 14, end: 17 },
  { id: '17-20', label: '17:00 - 20:00', start: 17, end: 20 },
  { id: '20-23', label: '20:00 - 23:00', start: 20, end: 23 },
] as const;
```

### 2) shared timeBlockUtils: 현재 블록/ID 계산
파일: [src/shared/utils/timeBlockUtils.ts](src/shared/utils/timeBlockUtils.ts)
```ts
export function getBlockIdFromHour(hour: number): TimeBlockId {
  for (const block of TIME_BLOCKS) {
    if (hour >= block.start && hour < block.end) {
      return block.id as TimeBlockId;
    }
  }
  return null;
}

export function getCurrentBlockId(): TimeBlockId {
  return getBlockIdFromHour(new Date().getHours());
}
```

### 2) ScheduleView 내부에도 현재 블록 계산 중복 존재
파일: [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
```tsx
const getCurrentBlockId = (): TimeBlockId => {
  const hour = currentHour;
  const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
  return block ? (block.id as TimeBlockId) : null;
};
```

### 3) WarmupPresetModal: 모달 파일 + ESC 닫기 + systemState 토글
파일: [src/features/schedule/components/WarmupPresetModal.tsx](src/features/schedule/components/WarmupPresetModal.tsx)
```tsx
import { useModalEscapeClose } from '@/shared/hooks';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults;

const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(
  SYSTEM_STATE_DEFAULTS.warmupAutoGenerateEnabled
);
useModalEscapeClose(true, onClose);

const storedValue = await getSystemState<boolean>(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED);
await setSystemState(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED, newValue);
```

### 4) 워밍업 자동삽입: 30초 폴링 + 분/시간 조건 + 중복 방지
파일: [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    if (!warmupAutoGenerateEnabled) return;
    if (!dailyData) return;
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (minute !== 50) return;
    if ([22, 23, 0, 1, 2, 3].includes(hour)) return;

    const currentBlock = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    if (!currentBlock) return;
    const completedCount = dailyData.tasks.filter(t => t.timeBlock === currentBlock.id).filter(t => t.completed).length;
    if (completedCount > 0) return;

    insertWarmupTasks(targetBlock.id as TimeBlockId, targetHourInBlock);
  }, 30 * 1000);
  return () => clearInterval(interval);
}, [dailyData, warmupPreset, warmupAutoGenerateEnabled]);
```

### 4) 워밍업 삽입 함수(프리셋을 실제 Task로 생성)
파일: [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
```tsx
const insertWarmupTasks = async (blockId: TimeBlockId, hourSlot?: number, preset = warmupPreset) => {
  const targetBlock = TIME_BLOCKS.find(b => b.id === blockId);
  const targetHour = hourSlot ?? targetBlock?.start;
  if (!targetBlock || targetHour === undefined) return;

  for (const warmupItem of preset) {
    const newTask = createNewTask(warmupItem.text, { ...warmupItem, timeBlock: blockId, hourSlot: targetHour });
    await addTask(newTask);
  }
};
```

### 5) systemState Repo wrapper
파일: [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts)
```ts
export const SYSTEM_KEYS = {
  WARMUP_AUTO_GENERATE_ENABLED: 'schedule:warmupAutoGenerateEnabled',
} as const;

export async function setSystemState(key: string, value: unknown): Promise<void> {
  await db.systemState.put({ key, value });
}

export async function getSystemState<T>(key: string): Promise<T | undefined> {
  const record = await db.systemState.get(key);
  return record?.value as T;
}
```

### 5) Timeline: showPastBlocks를 systemState에 영속화
파일: [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts)
```ts
const TIMELINE_SHOW_PAST_KEY = 'timelineShowPastBlocks';

useEffect(() => {
  const state = await db.systemState.get(TIMELINE_SHOW_PAST_KEY);
  if (state?.value === true) setShowPastBlocks(true);
}, []);

const toggleShowPastBlocks = async () => {
  const newValue = !showPastBlocks;
  setShowPastBlocks(newValue);
  await db.systemState.put({ key: TIMELINE_SHOW_PAST_KEY, value: newValue });
};
```

### 5) Timeline: 헤더 버튼(지난 블록 보기/숨기기)
파일: [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx)
```tsx
<button
  type="button"
  onClick={toggleShowPastBlocks}
  title={showPastBlocks ? '지난 블록 숨기기' : '지난 블록 보기'}
>
  {showPastBlocks ? '📜' : '📜'}
</button>
```

### 5) HourBar: 접힘 상태를 systemState에 저장/로드
파일: [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx)
```tsx
useEffect(() => {
  const record = await db.systemState.get('collapsedHourBars');
  const collapsedSet = new Set((record?.value as string[]) || []);
  setIsCollapsed(collapsedSet.has(`${blockId}_${hour}`));
}, [blockId, hour]);

await db.systemState.put({ key: 'collapsedHourBars', value: Array.from(collapsedSet) });
```

### 5) Sync logger: 로그를 systemState에 저장
파일: [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts)
```ts
const STORAGE_KEY = 'syncLogs';

const record = await db.systemState.get(STORAGE_KEY);

db.systemState.put({ key: STORAGE_KEY, value: logs }).catch(error => {
  console.error('Failed to save sync logs to Dexie:', error);
});
```

### 5) Sync utils: deviceId를 systemState에 저장/로드
파일: [src/shared/services/sync/firebase/syncUtils.ts](src/shared/services/sync/firebase/syncUtils.ts)
```ts
const DEVICE_ID_KEY = 'deviceId';

const record = await db.systemState.get(DEVICE_ID_KEY);

cachedDeviceId = generateId('device');
await db.systemState.put({ key: DEVICE_ID_KEY, value: cachedDeviceId });
```

### 5) Google Calendar: 설정을 systemState에 저장/로드
파일: [src/shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts)
```ts
const STORAGE_KEY = 'googleCalendarSettings';

const record = await db.systemState.get(STORAGE_KEY);
return record?.value as GoogleCalendarSettings | null;

await db.systemState.put({ key: STORAGE_KEY, value: settings });
```

### 5) Panel layout: 좌/우 패널 및 타임라인 표시 상태를 systemState에 저장/로드
파일: [src/app/hooks/usePanelLayout.ts](src/app/hooks/usePanelLayout.ts)
```ts
const LEFT_SIDEBAR_KEY = 'leftSidebarCollapsed';
const RIGHT_PANELS_KEY = 'rightPanelsCollapsed';
const TIMELINE_VISIBLE_KEY = 'timelineVisible';

const leftState = await db.systemState.get(LEFT_SIDEBAR_KEY);
const timelineState = await db.systemState.get(TIMELINE_VISIBLE_KEY);

await db.systemState.put({ key, value });
```

### 5) Dexie schema: systemState 테이블 타입/정의
파일: [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)
```ts
export interface SystemStateRecord {
  key: string;
  value: unknown;
}

export class TimeBlockDB extends Dexie {
  systemState!: Table<SystemStateRecord, string>;
}
```

### 6) defaults: SETTING_DEFAULTS + SYSTEM_STATE_DEFAULTS
파일: [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)
```ts
export const SETTING_DEFAULTS = {
  idleFocusModeEnabled: IDLE_FOCUS_DEFAULTS.enabled,
  idleFocusModeMinutes: IDLE_FOCUS_DEFAULTS.minutes,
  timeBlockXPGoal: GAMEPLAY_DEFAULTS.timeBlockXPGoal,
  waifuMode: 'characteristic' as const,
  autoMessageInterval: TIME_INTERVAL_DEFAULTS.autoMessageInterval,
} as const;

export const SYSTEM_STATE_DEFAULTS = {
  warmupAutoGenerateEnabled: true,
} as const;
```

# Recommendations
## 요구사항 1) 수정 포인트 요약 (지난 타임블록 가리기)
- (Fact) ScheduleView는 `showPastBlocks=false`일 때 `visibilityMode='current-only'`로 설정되어 **미래 블록도 숨김**.
  - 만약 요구사항이 “지난 블록만 숨기기(현재+미래는 보이기)”라면, [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)에서 `visibilityMode` 매핑을 `hide-past`로 바꾸는 지점이 핵심.
- (Fact) TimelineView의 showPastBlocks는 Dexie `systemState`에 저장되지만, ScheduleView showPastBlocks는 현재 store 메모리 상태로만 존재.
  - UX 일관성을 원하면 ScheduleView도 `systemState` 영속화를 고려(단, 현재 문서는 위치 식별이 목적).

## 요구사항 2) 수정 포인트 요약 (현재 블록 계산/유틸 표준화)
- (Fact) 현재 블록 계산이 3군데 이상으로 분산:
  - ScheduleView 내부 `TIME_BLOCKS.find(...)`
  - `timeBlockVisibility.getCurrentBlock(hour)`
  - `timeBlockUtils.getCurrentBlock()/getCurrentBlockId()`
- 수정/표준화 시 “단일 진실 소스”를 정하고, [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)의 내부 함수/중복 호출을 해당 유틸로 치환하는 것이 주요 작업 포인트.

# Open Questions
- ScheduleView의 토글(showPastBlocks)이 실제 UI에서 어디서 트리거되는지(해당 버튼/토글 컴포넌트) 추가 확인이 필요합니다. (현재 발췌 범위에서는 ScheduleView 자체에 토글 UI가 보이지 않음)
- ScheduleView에서 원하는 기본 정책이 `hide-past`인지 `current-only`인지(“지난 블록만 숨기기” vs “현재 블록만 보기”) 제품 정의 확인 필요
