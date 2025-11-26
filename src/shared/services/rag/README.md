# RAG (Retrieval-Augmented Generation) 서비스

## 📋 개요

TimeBlock Planner의 RAG 시스템은 사용자의 과거 작업 기록을 AI 대화에 컨텍스트로 제공합니다.

## 🏗️ 아키텍처

### 하이브리드 RAG 전략

```
사용자 쿼리
    ↓
[QueryParser] 쿼리 분석
    ↓
┌─────────────────────────────────────┐
│ 쿼리 유형에 따라 분기               │
├─────────────────────────────────────┤
│ date_specific │ → DirectQuery (DB)  │
│ status_query  │ → DirectQuery (DB)  │
│ stats_query   │ → Stats 생성        │
│ semantic      │ → Hybrid 검색       │
└─────────────────────────────────────┘
    ↓
[AI Context] 컨텍스트 생성
    ↓
[Gemini API] AI 응답
```

## 📁 파일 구조

```
src/shared/services/rag/
├── README.md                 # 이 문서
├── hybridRAGService.ts       # ⭐ 메인 서비스 (권장)
├── queryParser.ts            # 자연어 쿼리 파싱
├── directQueryService.ts     # IndexedDB 직접 쿼리
├── autoTagService.ts         # 🏷️ 자동 태그 추천
├── ragService.ts             # 벡터 검색 서비스 (보조)
├── vectorStore.ts            # Orama 벡터 스토어
├── embeddingService.ts       # Gemini Embedding API
└── ragSyncHandler.ts         # 데이터 변경 시 인덱싱
```

## 🔧 핵심 컴포넌트

### 1. HybridRAGService (권장)

구조화된 쿼리와 벡터 검색을 결합한 하이브리드 서비스입니다.

```typescript
import { hybridRAGService } from '@/shared/services/rag/hybridRAGService';

// AI 컨텍스트 생성
const context = await hybridRAGService.generateContext("11월 24일에 완료한 작업 알려줘");

// 쿼리 파싱 (디버깅용)
const parsed = hybridRAGService.parseQuery("어제 완료한 작업");
console.log(parsed);
// {
//   dateFilter: "2025-11-25",
//   completedFilter: true,
//   queryType: "date_specific",
//   ...
// }
```

### 2. QueryParser

자연어 쿼리를 구조화된 검색 조건으로 변환합니다.

**지원하는 패턴:**

| 패턴 | 예시 | 파싱 결과 |
|------|------|-----------|
| 날짜 | "11월 24일" | `dateFilter: "2025-11-24"` |
| 상대 날짜 | "오늘", "어제", "그저께" | 해당 날짜로 변환 |
| 기간 | "이번 주", "지난 주", "최근 7일" | `dateRange: { start, end }` |
| 완료 상태 | "완료한", "끝낸", "마친" | `completedFilter: true` |
| 미완료 상태 | "못한", "남은", "미완료" | `completedFilter: false` |
| 통계 | "몇 개", "얼마나", "총" | `queryType: "stats_query"` |
| 시간대 | "아침", "오후", "저녁" | `timeBlockFilter: "morning"` |

### 3. DirectQueryService

IndexedDB를 직접 쿼리하여 정확한 결과를 반환합니다.

```typescript
import { executeDirectQuery, formatTasksAsContext } from './directQueryService';
import { parseQuery } from './queryParser';

const parsed = parseQuery("11월 24일 완료 작업");
const result = await executeDirectQuery(parsed);

console.log(result.summary);
// { totalCount: 19, completedCount: 19, pendingCount: 0, dateRange: "2025-11-24" }

const context = formatTasksAsContext(result.tasks);
```

### 4. VectorStore (보조)

Orama 기반 인메모리 벡터 스토어입니다. 의미 기반 검색에 사용됩니다.

**⚠️ 주의사항:**
- 인메모리 DB로 앱 재시작 시 데이터 소실
- 재시작 시 자동 재인덱싱 (비용 발생 가능)
- 구조화된 쿼리에는 DirectQuery 사용 권장

## 📊 쿼리 유형별 처리

### date_specific (날짜 특정 쿼리)
```
"11월 24일에 완료한 작업 알려줘"
→ DirectQuery 실행 (100% 정확)
→ 임베딩 API 호출 없음
```

### status_query (상태 쿼리)
```
"완료한 작업 목록"
→ DirectQuery 실행
→ 최근 30일 중 완료된 작업 반환
```

### stats_query (통계 쿼리)
```
"이번 주 몇 개 작업 완료했어?"
→ 통계 집계 후 요약 텍스트 생성
→ 완료율, 날짜별 상세 포함
```

### semantic_search (의미 기반 검색)
```
"프로그래밍 관련 작업"
→ 하이브리드 검색 (DirectQuery + Vector)
→ 키워드 매칭 + 의미 유사도
```

## 🛠️ 디버깅

브라우저 콘솔에서 사용 가능:

```javascript
// Hybrid RAG 서비스
await window.hybridRag.generateContext("11월 24일 완료 작업");
window.hybridRag.parseQuery("어제 했던 일");

// 기존 벡터 RAG 서비스
await window.rag.debugGetAllDocs();
await window.rag.search("프로그래밍", 10);
```

## 📈 성능 비교

| 기능 | 기존 RAG | 하이브리드 RAG |
|------|----------|----------------|
| 날짜 쿼리 정확도 | ~60% (벡터 유사도) | 100% (직접 쿼리) |
| API 비용 | 매 쿼리 임베딩 | 구조화 쿼리 시 0 |
| 재시작 시 | 전체 재인덱싱 | 직접 쿼리는 영향 없음 |
| 응답 속도 | 벡터 검색 latency | IndexedDB 쿼리 (빠름) |

## 🔄 데이터 흐름

```
1. 작업 생성/수정/완료
   ↓
2. Dexie Hook 트리거 (ragSyncHandler)
   ↓
3. 벡터 스토어 인덱싱 (ragService.indexDocument)
   ↓
4. 사용자 쿼리
   ↓
5. hybridRAGService.generateContext()
   ├── 구조화 쿼리 → directQueryService
   └── 의미 검색 → ragService.search()
   ↓
6. AI 컨텍스트에 주입
```

## ⚠️ 알려진 제한사항

1. **인메모리 벡터 스토어**: 앱 재시작 시 재인덱싱 필요
2. **임베딩 비용**: 벡터 검색 사용 시 API 호출 발생
3. **캐시 휘발성**: 임베딩 캐시도 인메모리

## 🚀 향후 개선 계획

- [ ] 임베딩 IndexedDB 영구 저장
- [ ] 지연 인덱싱 (온디맨드)
- [ ] 로컬 임베딩 모델 (오프라인 지원)
- [ ] 청크 기반 문서 처리

---

## 🏷️ AutoTagService (자동 태그 추천)

### 개요

과거 작업 이력을 분석하여 새 작업에 적합한 태그를 추천합니다.
태그는 메모 필드에 `#태그명` 형식으로 저장됩니다.

### 사용법

```typescript
import { 
  suggestTagsForTask, 
  extractTagsFromMemo 
} from '@/shared/services/rag/autoTagService';

// 태그 추천
const result = await suggestTagsForTask("React 컴포넌트 리팩토링");
console.log(result.suggestedTags);
// [
//   { tag: "개발", count: 15, source: "history", relatedTasks: ["React 버그 수정", ...] },
//   { tag: "프론트엔드", count: 8, source: "history", relatedTasks: [...] }
// ]

// 메모에서 태그 추출
const tags = extractTagsFromMemo("작업 완료 #개발 #긴급");
// ["개발", "긴급"]
```

### 추천 알고리즘

1. **히스토리 기반 (기본)**: 
   - 최근 60일 작업에서 유사한 제목 검색
   - 유사 작업들의 메모에서 태그 추출
   - 사용 빈도 순 정렬

2. **AI 보조 (선택적)**:
   - Gemini API 키가 있는 경우 활성화
   - 기존 태그 목록을 참고하여 새 태그 추천
   - `source: "ai"` 로 구분

### UI 통합

`TaskModal.tsx`에서 태그 추천 버튼 제공:

- 🏷️ **태그 추천** 버튼 클릭
- 추천 태그 패널 표시 (클릭하면 메모에 추가)
- 히스토리 기반 태그: 🟡 (amber)
- AI 추천 태그: 🟣 (indigo) + ✨ 표시
