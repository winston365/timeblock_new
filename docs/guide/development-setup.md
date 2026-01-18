# 개발 환경 설정

TimeBlock Planner 개발을 위한 상세 환경 설정 가이드입니다.

## IDE 설정

### VS Code 권장 확장

- **ESLint** - 코드 린팅
- **Tailwind CSS IntelliSense** - Tailwind 자동완성
- **TypeScript Importer** - 자동 import

### 설정 파일

프로젝트에 포함된 VS Code 설정:

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 프로젝트 설정 파일

### TypeScript 설정

```
tsconfig.json          # 메인 설정
tsconfig.node.json     # Vite 설정
tsconfig.electron.json # Electron 설정
```

### 경로 별칭

`@/`는 `./src/`로 해석됩니다:

```typescript
// ✅ 권장
import { db } from '@/data/db';
import { dailyDataStore } from '@/shared/stores';

// ❌ 피하세요
import { db } from '../../../data/db';
```

## 환경 변수

::: warning 주의
API 키는 절대 커밋하지 마세요!
:::

### Firebase 설정

Firebase 인증 정보는 앱 내 Settings 모달에서 사용자가 직접 입력합니다.

`src/data/firebase/config.ts`는 `.gitignore`에 포함되어 있습니다.

### Gemini API

Gemini API 키도 Settings 모달에서 설정합니다. `settingsStore`에 저장되어 Firebase를 통해 동기화됩니다.

## 디버깅

### 개발자 도구

Electron 개발 모드에서 `Ctrl+Shift+I`로 DevTools를 열 수 있습니다.

### 콘솔 디버깅 유틸리티

```javascript
// RAG 시스템 디버깅
window.hybridRag.generateContext('지난주 완료 작업')
window.rag.debugGetAllDocs()

// 퍼포먼스 모니터링
window.__performanceMonitor // EventBus 이벤트 추적
```

### SyncLogModal

Firebase 동기화 문제 디버깅:

```
Settings → Sync → Sync Log
```

## 테스트 환경

### Vitest 설정

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // fake-indexeddb 사용
  }
})
```

### IndexedDB 테스트

`fake-indexeddb`를 사용하여 메모리 내에서 IndexedDB를 테스트합니다.

## 다음 단계

- [프로젝트 구조](/guide/project-structure) - 폴더 구조 이해하기
- [아키텍처 개요](/architecture/overview) - 시스템 설계 살펴보기
