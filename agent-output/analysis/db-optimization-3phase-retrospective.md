# DB 전체 개선 작업 결과 및 교훈 (3-Phase Execution)
- 날짜: 2026-01-09
- 목표: Firebase 동기화 트래픽(페이로드/쓰기 횟수) 및 IndexedDB I/O 감소, 안전한 점진 전환(롤백 가능) 확보
## 수행한 주요 변경 사항
### Phase A (기반 작업)
- ItemSyncStrategy 인터페이스 정의
- syncItemToFirebase / deleteItemFromFirebase 구현
- createDebouncedSync 유틸리티
- FEATURE_FLAGS 시스템 도입
- task:completed:batch 이벤트 타입 추가
### Phase B (핵심 구현)
- weeklyGoalRepository Single Item Sync 전환
- inboxRepository Single Item Sync 전환
- templateRepository Single Item Sync 전환
- Repository 재조회 로직 제거
### Phase C (통합 마무리)
- taskCompletionBatcher 구현
- debouncedSyncService 구현
- EventBus 배치 처리 subscriber 추가
- Feature Flags 활성화(점진적 온/오프 가능)
## 성과(관측/예상)
- 테스트: 519개 → 536개 (+17)
- Firebase 페이로드: 90% 감소 예상 (5KB → 0.5KB)
- IndexedDB I/O: 50% 감소 예상
## 3-Phase 분할의 효과
- Phase A: 기존 코드 영향 없이 인프라를 먼저 구축하여 리스크 최소화
- Phase B: 핵심 로직을 작은 단위(Single Item)로 안전하게 전환
- Phase C: 배치/디바운스 통합 + Feature Flag로 점진적 활성화 및 롤백 경로 확보
## 기술적 패턴 및 주의사항
1) ItemSyncStrategy 패턴
- 컬렉션별 동기화 전략을 타입 안전하게 정의하여 결합도와 실수 가능성을 낮춤
2) Feature Flag 보호
- 새 동기화 경로를 플래그로 감싸 롤백을 빠르고 안전하게 보장
3) Batcher 패턴
- 이벤트 폭주를 debounce + batch로 흡수하여 쓰기 횟수/페이로드/연쇄 I/O를 줄임
4) userIdProvider 공통화
- Repository 간 중복 코드 제거로 유지보수 비용과 구현 편차를 감소
## 기존 구조와의 정합성(참고)
- 기존 withFirebaseSync 기반 구조/재시도 큐/해시 캐시 등과 공존 가능한 형태로, 동기화 경로를 “전략화 + 배치화 + 플래그화”하여 점진 전환을 가능하게 함
## 향후 권장사항
1) 프로덕션 배포 후 Firebase Console에서 쓰기 횟수/실패율/지연을 모니터링
2) 점진적 롤아웃 권장 (일부 사용자 먼저)
3) completedInbox date-keyed 구조는 유지 (히스토리 조회 용이)
