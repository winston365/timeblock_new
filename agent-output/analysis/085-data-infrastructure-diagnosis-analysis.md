---
ID: 85
Origin: 85
UUID: b9a2c4f0
Status: Active
---

# 데이터 인프라 현황 진단

## Changelog
| Date | Author | Change |
| --- | --- | --- |
| 2026-01-10 | Analyst (은하) | 착수: Dexie 스키마, Sync, Repository 흐름 전수 조사 |

## Value Statement and Business Objective
- 앱이 로컬 우선으로 안정적으로 동작하면서도 Firebase 동기화로 일관성을 유지하도록, 데이터 경로/병목을 식별해 추후 개선 범위를 명확히 한다.
- 목표: 대량 데이터/빈번한 동기화 시에도 느려지거나 누락되지 않는 저장·동기화 파이프라인 확보.

## Context
- Dexie v17 스키마로 IndexedDB가 로컬 SoT, Firebase RTDB는 동기화용. 초기 bulk fetch는 건너뛰고 RTDB 리스너 + on-demand backfill로 채운다.
- SyncEngine은 infra 레이어에서 Dexie hook 기반 양방향 sync를 수행하며, 일부 리포지토리는 별도 syncToFirebase/itemSync를 직접 호출.

## Methodology
- 코드 정독: Dexie 스키마/마이그레이션, SyncEngine (hooks, listeners, queue), Firebase 전략/리스너 레지스트리, 주요 리포지토리(dailyData, inbox, weeklyGoal, baseRepository).
- 증거 수집: 라인 단위 위치 확보, 컬렉션 단위 동기화·풀스캔 지점 확인.
- 문맥 확인: 리스너 lookback 설정, backfill 경로, debounce/queue 동작.

## Findings
- **[Proven] CompletedInbox 로컬→클라우드가 매 변경마다 전체 테이블 스캔/멀티 업로드**: Dexie hook이 750ms debounce 후 `completedInbox.toArray()` 전체 스캔 후 날짜별로 모든 항목을 재동기화. 대량 완료 작업이 있을 때 변경 1건당 O(n) 스캔/여러 set 발생 [src/data/db/infra/syncEngine/index.ts#L143-L158].
- **[Proven] CompletedInbox 원격→로컬 적용 시 매 이벤트마다 전체 테이블 재작성**: 리스너가 date-keyed child 이벤트마다 맵을 재구성한 뒤 `db.completedInbox.clear()`→`bulkPut`로 전체 테이블을 갈아끼움. 작업 n개일 때 원격 1건 업데이트도 O(n) 재작성 발생, 충돌 시 데이터 플리킹 위험 [src/data/db/infra/syncEngine/listener.ts#L276-L296].
- **[Proven] Inbox 완료 토글이 아이템 단위 sync를 우회하고 전체 인박스/완료 인박스를 매번 풀 업로드**: `syncBothInboxTablesToFirebase`가 `globalInbox.toArray()`와 `completedInbox.toArray()`를 모두 읽어 전체 세트를 syncToFirebase로 전송, 토글 1회가 전체 데이터 재동기화로 확장 [src/data/repositories/inboxRepository.ts#L29-L44][src/data/repositories/inboxRepository.ts#L281-L295].
- **[Proven] saveCollection이 부분 업데이트 없이 전체 clear→bulkPut→전체 Firebase 업로드**: 컬렉션 변경 1건도 전체 테이블 클리어 후 전량 재쓰기 + 전체 syncToFirebase 수행. 컬렉션 기반 저장소(templates/shopItems/weeklyGoals reorder 등)에서 불필요한 전송/리라이트가 발생 [src/data/repositories/baseRepository.ts#L327-L343].
- **[Inferred] 날짜 이동 시 Firebase backfill이 날짜별 get()을 매번 트리거**: RTDB 리스너가 lookback 3일로 제한되어(대역폭 최적화) 그 이전 날짜는 `backfillKeyOnce`로 단건 get을 날림. 과거 일자를 순회하면 네트워크 왕복이 날짜 수 만큼 발생 [src/shared/constants/defaults.ts#L89-L98][src/data/repositories/dailyData/coreOperations.ts#L90-L108].

## Remaining Gaps
| # | Unknown | Blocker | Required Action | Owner |
| - | - | - | - | - |
| 1 | 실제 앱 사용 시 completedInbox/ globalInbox 규모와 변경 빈도 | 런타임 관측 없음 | 계측/샘플 데이터 수집, syncLog 필터링 | TBD |
| 2 | saveCollection 호출 빈도 및 대상(템플릿/상점 등) 데이터량 | 사용 경로 파악 미흡 | 호출 스택/스토어 이벤트 추적 | TBD |
| 3 | backfillKeyOnce 캐시 적중률 및 과거 날짜 탐색 패턴 | 사용자 행동 로그 없음 | 탐색 경로 계측 또는 리서치 | TBD |

## Analysis Recommendations (next analysis steps)
- 계측: syncLog/RTDB metrics를 이용해 completedInbox와 inbox 토글 시 발생하는 set/write 횟수와 페이로드 크기를 샘플링해 실제 비용 정량화.
- 워크로드 샘플링: 과거 날짜 탐색 시 backfill 요청 수/시간을 로깅해 lookback=3 설정의 체감 영향 측정.
- 호출 그래프 파악: saveCollection을 호출하는 UI/스토어 경로를 추적해 실제 데이터량과 호출 빈도를 분류(예: 템플릿 reorder vs. 상점 갱신).

## Open Questions
- completedInbox가 대규모(수천 건)일 때 현재 전량 재동기화 설계로 실사용 성능이 허용 가능한가?
- ITEM_SYNC_ENABLED 플래그가 off일 때의 네트워크 비용 차이는 어느 정도인지, 토글 시 fallback 경로가 적절히 스로틀되는지?
- backfillKeyOnce 캐시가 탭/윈도우 간 공유되지 않는데, 멀티 윈도우 사용 시 중복 fetch가 얼마나 발생하는가?
