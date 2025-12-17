# Value Statement and Business Objective
Vite dev 서버에서 UI가 뜨지 않는 빌드 차단 오류를 빠르게 확정/격리해 개발 생산성을 회복한다. 특히 React 플러그인(Babel) 파이프라인에서 발생한 파싱 에러를 재현 가능하게 정리하고, 가장 가능성 높은 원인과 확정 체크포인트를 제공한다.

## Objective
- `npm run dev` 실행 시 발생하는 `Identifier 'BaseTabProps' has already been declared` 에러를 재현/원인 가설/확정 방법으로 정리한다.
- 구현/수정은 이 문서 범위를 벗어나며(분석 전용), 확인에 필요한 코드 포인트만 제시한다.

## Context
- 증상: `npm run dev`에서 UI 미표시 + Vite React(Babel) 플러그인 에러로 번들링 중단.
- 로그 키워드: `ScheduleTab.tsx`에서 `Identifier 'BaseTabProps' has already been declared`.

## Root Cause (Most Likely)
### 사실(Fact)
- [src/features/settings/components/tabs/ScheduleTab.tsx](src/features/settings/components/tabs/ScheduleTab.tsx#L17-L18)에 동일 모듈(`./types`)에서 동일 식별자(`BaseTabProps`, `Settings`)를 중복 import 하는 구문이 존재한다.
  - L17: `import type { BaseTabProps, TimeSlotTagTemplate, Settings } from './types';`
  - L18: `import type { BaseTabProps, Settings } from './types';`
- JS/TS 파서 관점에서 동일 스코프 내 동일 로컬 바인딩을 두 번 선언하는 것은 SyntaxError이며, Babel이 이 단계에서 실패하면 Vite는 런타임까지 진입하지 못해 UI가 안 뜬다.

## Methodology
- 코드베이스 텍스트 검색으로 `BaseTabProps` 정의/사용 위치 식별.
- 에러가 지목하는 `ScheduleTab.tsx` 상단 import 구문을 직접 확인.

## Findings
### 확정된 관찰
- `BaseTabProps`의 정의는 [src/features/settings/components/tabs/types.ts](src/features/settings/components/tabs/types.ts#L19-L29)에 단일 `export interface`로 존재한다.
- 에러의 직접 트리거는 `ScheduleTab.tsx` 내부 중복 import 구문일 가능성이 매우 높다(동일 파일 내에서 이미 재현 가능한 위반 구문).

### 가설(Hypotheses)
1) **(최우선)** IDE 자동 import/머지 충돌로 동일 import 라인이 중복 삽입되어 Babel 파서가 동일 식별자 재선언으로 즉시 실패
2) `./types`에 대한 경로/리졸브가 중복 파일로 매핑되는 비정상 상태(대/소문자 차이, symlink 등)로 인해 결과적으로 동일 바인딩이 두 번 들어옴 (Windows에서 대소문자 비민감 + 리네임 이력 있을 때 가능)
3) Vite React 플러그인의 Babel 변환 단계에서 `import type` 처리가 예상과 다르게 동작하거나(플러그인/설정 충돌), 동일 파일이 두 번 변환되는 파이프라인 이상으로 중복 선언이 표면화

## Recommendations (Verification-First)
- 가장 빠른 확정: [src/features/settings/components/tabs/ScheduleTab.tsx](src/features/settings/components/tabs/ScheduleTab.tsx#L17-L18)에서 `BaseTabProps`/`Settings` 중복 import가 실제로 존재하는지 확인 (이미 존재함).
- 로그 확정 포인트: Vite 터미널/오버레이 스택트레이스에 `ScheduleTab.tsx:17` 또는 `:18` 인근이 찍히는지 확인.
- 환경/리졸브 의심 시: 동일 경로 파일이 2개로 인식되는지 `git status` 및 파일명 대소문자 변경 이력 확인(특히 `tabs/` 경로 내).

## Open Questions
- 에러 스택에서 정확히 어떤 변환 단계가 `ScheduleTab.tsx`를 처리 중인지(react plugin, 다른 babel plugin, 혹은 ts transform) 로그에 표시되는지?
- 해당 중복 import가 언제/어떻게 들어왔는지(최근 리베이스/머지/IDE 자동 import) 파악 가능한지?

## Changelog
- 2025-12-17: 중복 import 구문 근거 링크 포함해 원인/가설/확정 체크포인트 정리.
