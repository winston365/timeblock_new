# Dexie Client (IndexedDB)

IndexedDB를 Dexie ORM으로 관리하는 데이터베이스 클라이언트

## 📁 모듈 구조

```
db/
├── dexieClient.ts   # Dexie 인스턴스 및 스키마 정의
└── README.md        # 이 문서
```

## 🗄️ 테이블 목록

| 테이블 | 키 | 설명 |
|--------|-----|------|
| `dailyData` | `date` | 일별 작업 및 블록 상태 |
| `gameState` | `key` | 게임 상태 (XP, 레벨, 퀘스트) |
| `templates` | `id` | 작업 템플릿 |
| `shopItems` | `id` | 상점 아이템 |
| `waifuState` | `key` | 와이푸 상태 (호감도, 포즈) |
| `energyLevels` | `id` | 시간대별 에너지 레벨 |
| `settings` | `key` | 앱 설정 |
| `chatHistory` | `id` | Gemini 채팅 히스토리 |
| `dailyTokenUsage` | `date` | 일별 토큰 사용량 |
| `globalInbox` | `id` | 글로벌 인박스 (미완료) |
| `completedInbox` | `id` | 완료된 인박스 작업 |
| `globalGoals` | `id` | 장기 목표 |
| `systemState` | `key` | 시스템 상태 (마지막 초기화 등) |
| `images` | `id` | 이미지 저장소 |
| `weather` | `id` | 날씨 캐시 |
| `aiInsights` | `id` | AI 인사이트 |

## 📜 스키마 버전 히스토리

| 버전 | 변경 내용 |
|------|----------|
| v1 | 초기 스키마 (dailyData, gameState, templates 등) |
| v2 | chatHistory 테이블 추가 |
| v3 | dailyTokenUsage 테이블 추가 |
| v4 | globalInbox 테이블 추가 |
| v5 | globalGoals 테이블 추가 |
| v6 | systemState 테이블 추가 |
| v7 | completedInbox 테이블 추가 (인박스 분리) |
| v8 | settings에 dontDoChecklist 필드 추가 |
| v9 | images 테이블 추가 |
| v10 | weather 캐시 테이블 추가 |
| v11 | aiInsights 테이블 추가 |

## 📘 사용 예시

### 기본 CRUD

```typescript
import { db } from '@/data/db/dexieClient';

// 조회
const dailyData = await db.dailyData.get('2025-01-17');

// 추가/수정
await db.dailyData.put({ date: '2025-01-17', tasks: [], ... });

// 삭제
await db.dailyData.delete('2025-01-17');

// 전체 조회
const allData = await db.dailyData.toArray();
```

### 쿼리

```typescript
// 조건 조회
const recentData = await db.dailyData
  .where('date')
  .above('2025-01-01')
  .toArray();

// 정렬
const sorted = await db.dailyData
  .orderBy('updatedAt')
  .reverse()
  .limit(10)
  .toArray();
```

### 트랜잭션

```typescript
await db.transaction('rw', [db.dailyData, db.gameState], async () => {
  await db.dailyData.put(dailyData);
  await db.gameState.put(gameState);
});
```

## 🔄 마이그레이션 가이드

새 테이블/필드 추가 시:

```typescript
// 1. 버전 번호 증가
this.version(12).stores({
  // 기존 테이블들...
  newTable: 'id, createdAt', // 새 테이블
});

// 2. 데이터 마이그레이션 (필요시)
this.version(12).stores({...}).upgrade(async (tx) => {
  // 기존 데이터 변환
  const oldData = await tx.table('oldTable').toArray();
  await tx.table('newTable').bulkPut(transformedData);
});
```

## ⚠️ 주의사항

### 마이그레이션

1. **버전은 항상 증가**: 절대 기존 버전 수정 금지
2. **Idempotent하게**: 마이그레이션은 여러 번 실행되어도 안전해야 함
3. **Firebase 동기화**: 스키마 변경 시 Firebase 전략도 함께 업데이트

### 인덱스

```typescript
// 인덱스 정의 예시
dailyData: 'date, updatedAt'  // date가 기본 키, updatedAt은 보조 인덱스
```

- 기본 키는 첫 번째 필드
- 복합 인덱스: `[field1+field2]`
- 고유 인덱스: `&field`
- 다중 값 인덱스: `*field`

### 타입 안전성

```typescript
// 테이블 타입 정의
dailyData!: Table<DailyData & { date: string }, string>;
//          Table<데이터 타입, 키 타입>
```

## 🔗 관련 모듈

- `src/data/repositories/` - Repository 패턴 (DB 접근 추상화)
- `src/shared/services/sync/syncEngine.ts` - Dexie Hook 기반 자동 동기화
- `src/shared/services/sync/firebase/strategies.ts` - Firebase 동기화 전략

## 📊 저장소 용량

IndexedDB는 브라우저/Electron별 제한이 있습니다:
- **Chrome/Electron**: 디스크 공간의 ~60%
- **일반적 사용량**: 수십 MB 이하

용량 확인:
```typescript
const estimate = await navigator.storage.estimate();
console.log(`사용: ${estimate.usage} / ${estimate.quota}`);
```
