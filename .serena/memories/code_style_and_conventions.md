# 코드 스타일 및 컨벤션

## TypeScript 설정
- **strict 모드**: 활성화
- **Target**: ES2020
- **Path Alias**: `@/` → `./src/`

## 네이밍 컨벤션
- **클래스/컴포넌트**: PascalCase (예: `TaskCard`, `DailyDataStore`)
- **변수/함수/훅/서비스**: camelCase (예: `useTasks`, `dailyDataRepository`)
- **파일/디렉토리**: kebab-case (예: `task-card.tsx`, `daily-data/`)
- **상수/환경변수**: UPPERCASE (예: `SETTING_DEFAULTS`, `NODE_ENV`)
- **보조 동사 활용**: `isLoading`, `hasError`, `canSubmit`

## ESLint 규칙 (중요)
1. **localStorage 사용 금지**: `theme` 키만 예외
   - 대신 Dexie `systemState` 테이블 사용
2. **dexieClient 직접 import 금지**: Repository 레이어 사용
   - 예외: `src/data/repositories/**`, `src/data/db/**`
3. **db.* 직접 접근 금지**: Repository 레이어 사용
4. **@typescript-eslint/no-explicit-any**: warn
5. **no-duplicate-imports**: error

## 코딩 패턴

### any 사용 금지
```typescript
// ❌ 잘못된 예
const data: any = fetchData();

// ✅ 올바른 예
interface TaskData { id: string; title: string; }
const data: TaskData = fetchData();
```

### 함수형 프로그래밍 선호
```typescript
// ❌ 클래스 사용
class TaskService { ... }

// ✅ 함수 및 훅 사용
const useTaskService = () => { ... };
export const taskService = { ... };
```

### Arrow Function 사용
```typescript
// ✅ 권장
const handleClick = () => { ... };
const calculateXP = (task: Task): number => { ... };
```

### 기본값 중앙 집중화
```typescript
// ❌ 하드코딩된 폴백
const interval = settings?.focusTimerMinutes ?? 25;

// ✅ 중앙 상수 사용
import { SETTING_DEFAULTS } from '@/shared/constants/defaults';
const interval = settings?.focusTimerMinutes ?? SETTING_DEFAULTS.focusTimerMinutes;
```

### Optional Chaining 필수
```typescript
// ❌ 위험
const name = user.profile.name;

// ✅ 안전
const name = user?.profile?.name;
```

## Import 순서 (권장)
1. React/외부 라이브러리
2. `@/` 경로 import
3. 상대 경로 import
4. 타입 import (`import type`)

## JSDoc 문서화
모든 함수, 컴포넌트, 타입에 JSDoc 작성:
```typescript
/**
 * 작업의 XP를 계산합니다.
 * @param task - 대상 작업
 * @param bonusMultiplier - 보너스 배율 (기본: 1.0)
 * @returns 계산된 XP 값
 */
const calculateTaskXP = (task: Task, bonusMultiplier = 1.0): number => { ... };
```

## Git 커밋 메시지
Conventional Commits 형식 사용:
```
type: 간결한 제목

상세 설명 (필요시)
```

Type: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
