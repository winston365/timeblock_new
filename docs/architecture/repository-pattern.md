# Repository 패턴

데이터 접근을 추상화하는 Repository 패턴의 구현입니다.

## 왜 Repository 패턴인가?

### 문제점: 직접 DB 접근

```typescript
// ❌ 잘못된 방식 - 컴포넌트에서 직접 DB 접근
function TaskList() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    // DB 직접 접근 - 테스트 어려움, 로직 분산
    db.dailyData.where('date').equals(today).toArray()
      .then(setTasks);
  }, []);
}
```

### 해결책: Repository 추상화

```typescript
// ✅ 올바른 방식 - Repository를 통한 접근
function TaskList() {
  const { tasks } = useDailyDataStore();
  // Store가 Repository를 호출, Repository가 DB 접근
}
```

## 계층 구조

```
┌─────────────────────────────────────────────┐
│              React Component                │
│         useDailyDataStore()                 │
└───────────────────┬─────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────┐
│              Zustand Store                  │
│         dailyDataStore                      │
│                                             │
│  • UI 상태 관리                              │
│  • 낙관적 업데이트                            │
│  • 롤백 처리                                 │
└───────────────────┬─────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────┐
│              Repository                     │
│         dailyDataRepository                 │
│                                             │
│  • CRUD 추상화                               │
│  • 로컬 저장 (Dexie)                         │
│  • 클라우드 동기화 (Firebase)                 │
└───────────────────┬─────────────────────────┘
                    │
         ┌─────────┴─────────┐
         ↓                   ↓
┌─────────────────┐  ┌─────────────────┐
│     Dexie       │  │    Firebase     │
│   (IndexedDB)   │  │     (RTDB)      │
└─────────────────┘  └─────────────────┘
```

## 기본 Repository

```typescript
// src/data/repositories/baseRepository.ts

export abstract class BaseRepository<T, K = string> {
  protected abstract tableName: string;
  
  protected get table() {
    return db.table<T, K>(this.tableName);
  }
  
  async getById(id: K): Promise<T | undefined> {
    return this.table.get(id);
  }
  
  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }
  
  async save(item: T): Promise<void> {
    await this.table.put(item);
    await this.syncToFirebase(item);
  }
  
  async delete(id: K): Promise<void> {
    await this.table.delete(id);
    await this.deleteFromFirebase(id);
  }
  
  // 하위 클래스에서 구현
  protected abstract syncToFirebase(item: T): Promise<void>;
  protected abstract deleteFromFirebase(id: K): Promise<void>;
}
```

## 구체적 Repository 예시

```typescript
// src/data/repositories/dailyDataRepository.ts

class DailyDataRepository extends BaseRepository<DailyData> {
  protected tableName = 'dailyData';
  
  async getByDate(date: string): Promise<DailyData | undefined> {
    return this.table.get(date);
  }
  
  async getDateRange(
    startDate: string, 
    endDate: string
  ): Promise<DailyData[]> {
    return this.table
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }
  
  async updateTask(
    date: string, 
    taskId: string, 
    updates: Partial<Task>
  ): Promise<void> {
    await db.transaction('rw', this.table, async () => {
      const dailyData = await this.table.get(date);
      if (!dailyData) return;
      
      const tasks = dailyData.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      );
      
      await this.table.put({ ...dailyData, tasks });
    });
    
    await this.syncToFirebase({ date, taskId, updates });
  }
  
  protected async syncToFirebase(item: DailyData): Promise<void> {
    await syncCore.sync(item, dailyDataStrategy);
  }
  
  protected async deleteFromFirebase(date: string): Promise<void> {
    await firebase.database()
      .ref(`users/${uid}/dailyData/${date}`)
      .remove();
  }
}

export const dailyDataRepository = new DailyDataRepository();
```

## 대형 Repository 모듈화

`dailyDataRepository`처럼 큰 경우 폴더로 분리합니다:

```
repositories/dailyData/
├── index.ts           # 공개 API 및 re-export
├── coreOperations.ts  # 기본 CRUD
├── taskOperations.ts  # 작업 관련 메서드
├── blockOperations.ts # 타임블록 관련 메서드
├── queryHelpers.ts    # 복잡한 쿼리
└── types.ts           # 내부 타입
```

```typescript
// dailyData/index.ts

import { coreOperations } from './coreOperations';
import { taskOperations } from './taskOperations';
import { blockOperations } from './blockOperations';

export const dailyDataRepository = {
  ...coreOperations,
  ...taskOperations,
  ...blockOperations,
};
```

## Store에서 사용

```typescript
// src/shared/stores/dailyDataStore.ts

export const dailyDataStore = create<DailyDataState>((set, get) => ({
  dailyData: null,
  loading: false,
  error: null,
  
  async loadByDate(date: string) {
    set({ loading: true, error: null });
    
    try {
      const data = await dailyDataRepository.getByDate(date);
      set({ dailyData: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  async updateTask(taskId: string, updates: Partial<Task>) {
    const { dailyData } = get();
    if (!dailyData) return;
    
    // 낙관적 업데이트
    const original = { ...dailyData };
    const updatedTasks = dailyData.tasks.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    );
    set({ dailyData: { ...dailyData, tasks: updatedTasks } });
    
    try {
      await dailyDataRepository.updateTask(
        dailyData.date, 
        taskId, 
        updates
      );
    } catch (error) {
      // 롤백
      set({ dailyData: original });
      throw error;
    }
  }
}));
```

## 테스트

Repository 패턴은 테스트를 쉽게 만듭니다:

```typescript
// tests/dailyDataRepository.test.ts
import 'fake-indexeddb/auto';

describe('DailyDataRepository', () => {
  beforeEach(async () => {
    await db.dailyData.clear();
  });
  
  it('should save and retrieve daily data', async () => {
    const data = { date: '2024-01-15', tasks: [] };
    
    await dailyDataRepository.save(data);
    const result = await dailyDataRepository.getByDate('2024-01-15');
    
    expect(result).toEqual(data);
  });
});
```

## 다음 단계

- [DB 스키마 레퍼런스](/reference/database-schema) - 전체 테이블 목록
- [Zustand 스토어](/reference/zustand-stores) - 스토어 구조
