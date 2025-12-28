# 작업 완료 체크리스트

## 코드 변경 후 필수 수행 사항

### 1. 코드 품질 검증
```bash
# ESLint 실행 (필수)
npm run lint
```

### 2. 테스트 실행
```bash
# 테스트 실행 (필수)
npm run test

# 커버리지 확인 (권장)
npm run test:coverage
```

### 3. 수동 검증
- `npm run preview` - 웹 빌드 미리보기
- `npm run electron:prod` - Electron 프로덕션 빌드 확인
- 웹과 데스크톱 환경 모두에서 동작 확인

## 데이터 구조 변경 시 추가 작업

### Dexie 스키마 변경 시
1. `src/data/db/dexieClient.ts`에서 버전 증가
2. 마이그레이션 로직 추가 (idempotent하게)
3. 해당 Repository 업데이트
4. Firebase 동기화 전략 업데이트 (`src/shared/services/sync/firebase/strategies.ts`)

### 새 기능 추가 시
1. Feature 폴더 구조 준수 (`src/features/<feature>/`)
2. 필요시 Zustand 스토어 생성 (`src/shared/stores/`)
3. Repository 패턴 적용 (`src/data/repositories/`)

### 작업 완료 파이프라인 확장 시
1. `TaskCompletionHandler` 인터페이스 구현
2. `taskCompletionService.ts`에 핸들러 등록

## PR/커밋 전 최종 확인

- [ ] ESLint 에러 없음
- [ ] 테스트 통과
- [ ] TypeScript 컴파일 에러 없음
- [ ] localStorage 사용하지 않음 (`theme` 제외)
- [ ] dexieClient 직접 import 없음 (Repository 사용)
- [ ] 하드코딩된 기본값 없음 (SETTING_DEFAULTS 등 사용)
- [ ] optional chaining 적용됨
- [ ] JSDoc 문서화됨 (새 함수/컴포넌트)
