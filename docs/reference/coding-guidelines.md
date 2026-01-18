# 코딩 가이드라인

TimeBlock Planner 개발 시 따라야 하는 코딩 컨벤션입니다.

## 핵심 원칙

### 규칙 우선순위

충돌 시 다음 순서를 따릅니다:

1. **데이터 무결성 & 안전성**
2. **기능적 정확성**
3. **타입 안전성 & 검증**
4. **유지보수성 & 가독성**
5. **디자인 & 스타일 컨벤션**

## 저장소 정책 (중요!)

### ❌ localStorage 사용 금지

```typescript
// ❌ 절대 금지 - dev에서 경고 발생
localStorage.setItem('myKey', JSON.stringify(data));
getFromStorage('myKey', defaultValue);

// ✅ Dexie systemState 사용
import { db } from '@/data/db/dexieClient';

await db.systemState.put({ key: 'myKey', value: data });
const record = await db.systemState.get('myKey');
```

**예외**: `theme` 키만 localStorage 허용 (Dexie 초기화 전 필요)

### 왜 Dexie인가?

- 용량 제한 없음 (localStorage: 5MB)
- 비동기 API (UI 블로킹 없음)
- 트랜잭션 지원
- 인덱스 및 쿼리 가능

## 기본값 정책 (중요!)

### ❌ 하드코딩 금지

```typescript
// ❌ 하드코딩된 기본값 - 일관성 깨짐
const focusInterval = settings?.focusTimerMinutes ?? 25;
const maxRetries = 3;

// ✅ 중앙화된 기본값 사용
import { SETTING_DEFAULTS, GAME_STATE_DEFAULTS } from '@/shared/constants/defaults';

const focusInterval = settings?.focusTimerMinutes ?? SETTING_DEFAULTS.focusTimerMinutes;
```

### 기본값 상수 위치

```
src/shared/constants/defaults.ts
├── SETTING_DEFAULTS      # 사용자 설정
├── IDLE_FOCUS_DEFAULTS   # 집중 모드 설정
└── GAME_STATE_DEFAULTS   # 게임 상태 초기화
```

## 타입스크립트

### any 금지

```typescript
// ❌ any 절대 금지
function processData(data: any) { ... }

// ✅ 구체적 타입 또는 제네릭
function processData<T extends BaseData>(data: T) { ... }
```

### import type 사용

```typescript
// 타입만 import할 때
import type { Task, TimeBlock } from '@/shared/types';

// 값과 타입 같이 import할 때
import { TaskStatus, type Task } from '@/shared/types';
```

### readonly 활용

```typescript
interface Config {
  readonly apiKey: string;
  readonly maxRetries: number;
}
```

## 함수 & 컴포넌트

### 화살표 함수 선호

```typescript
// ✅ 화살표 함수
const calculateXP = (duration: number, resistance: Resistance): number => {
  return duration * RESISTANCE_MULTIPLIER[resistance];
};

// ✅ 컴포넌트도 화살표 함수
const TaskItem: React.FC<TaskItemProps> = ({ task, onComplete }) => {
  // ...
};
```

### 함수형 프로그래밍

```typescript
// ❌ 클래스 사용 피하기
class TaskService {
  process(task: Task) { ... }
}

// ✅ 순수 함수 선호
const processTask = (task: Task): ProcessedTask => {
  // ...
};
```

### 명시적 반환 타입

```typescript
// ✅ 반환 타입 명시
const getTasks = async (date: string): Promise<Task[]> => {
  // ...
};
```

## 명명 규칙

### 일반 규칙

| 대상 | 규칙 | 예시 |
|:---|:---|:---|
| 컴포넌트 | PascalCase | `TaskItem.tsx` |
| 훅/유틸 | camelCase | `useTaskState.ts` |
| 상수 | UPPER_SNAKE | `MAX_RETRIES` |
| 타입/인터페이스 | PascalCase | `TaskStatus` |
| 파일/폴더 | kebab-case | `task-utils.ts` |

### 서술적 네이밍

```typescript
// ❌ 모호한 이름
const d = getData();
const flag = true;

// ✅ 서술적 이름 (보조 동사 활용)
const isLoading = true;
const hasError = false;
const canSubmit = true;
const shouldRefresh = false;
```

## 에러 처리

### 가드 절 사용

```typescript
// ✅ early return으로 가드
const processTask = (task: Task | null): Result => {
  if (!task) {
    return { error: 'Task is required' };
  }
  
  if (task.completed) {
    return { error: 'Task already completed' };
  }
  
  // 메인 로직
  return { success: true };
};
```

### 명시적 에러 처리

```typescript
// ✅ try-catch로 감싸기
try {
  await repository.save(data);
} catch (error) {
  if (error instanceof NetworkError) {
    // 네트워크 에러 처리
  } else if (error instanceof ValidationError) {
    // 검증 에러 처리
  } else {
    throw error; // 알 수 없는 에러는 재throw
  }
}
```

### Optional Chaining & Nullish Coalescing

```typescript
// ✅ 안전한 접근
const taskTitle = dailyData?.tasks?.[0]?.title ?? 'Untitled';

// ✅ 기본값 (SETTING_DEFAULTS 사용)
const interval = settings?.autoMessageInterval ?? SETTING_DEFAULTS.autoMessageInterval;
```

## 데이터 접근

### Repository 통해서만 접근

```typescript
// ❌ 직접 DB 접근 금지
const tasks = await db.dailyData.where('date').equals(today).toArray();

// ✅ Repository 사용
const tasks = await dailyDataRepository.getByDate(today);
```

### Store → Repository → DB

```typescript
// 올바른 데이터 흐름
Component
  → Store (dailyDataStore)
    → Repository (dailyDataRepository)
      → Dexie (db)
      → Firebase (sync)
```

## import 정리

### 순서

```typescript
// 1. React
import { useState, useEffect } from 'react';

// 2. 외부 라이브러리
import { motion } from 'framer-motion';
import { z } from 'zod';

// 3. 내부 모듈 (@/ 별칭)
import { db } from '@/data/db';
import { dailyDataStore } from '@/shared/stores';
import { formatDate } from '@/shared/utils';

// 4. 상대 경로 (같은 feature 내)
import { TaskItem } from './TaskItem';
import type { TaskItemProps } from './types';
```

### @/ 별칭 사용

```typescript
// ✅ 별칭 사용
import { db } from '@/data/db';

// ❌ 상대 경로 피하기
import { db } from '../../../data/db';
```

## 모달 규칙

### ESC로 닫기

```typescript
import { useModalEscapeClose } from '@/shared/hooks';

const MyModal = ({ isOpen, onClose }) => {
  useModalEscapeClose(isOpen, onClose);
  // ...
};
```

### 배경 클릭으로 닫지 않기

```typescript
// ❌ 배경 클릭으로 닫기 금지
<div onClick={onClose} className="backdrop">

// ✅ 명시적 닫기 버튼만 사용
<button onClick={onClose}>닫기</button>
```

## 품질 체크리스트

코드 작성 후 확인:

- [ ] 타입 완전 지정 (any 없음)
- [ ] 미사용 코드 없음
- [ ] 암묵적 가정 없음
- [ ] 입력 검증 포함
- [ ] 에러 처리 완료
- [ ] 명명 규칙 준수
- [ ] 가독성 & 유지보수성 확보

## 다음 단계

- [상수 & 기본값](/reference/constants-defaults) - SETTING_DEFAULTS 상세
- [아키텍처 개요](/architecture/overview) - 전체 구조 이해
