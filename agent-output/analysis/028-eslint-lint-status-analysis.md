Status: Completed
Changelog:
- 2025-12-23: 초기 작성, ESLint/린트 구성 현황 및 중복 import 방지 옵션 조사.

Value Statement and Business Objective:
- 린트 체계를 명확히 파악해 최소 변경으로 중복 import를 방지해, 팀의 코드 일관성과 회귀 리스크를 줄인다.

Objective:
- ESLint 설치 및 스크립트 유무 확인.
- ESLint 설정 파일 위치와 형태 확인.
- 현재 Vite/TS 구성에 적합한 중복 import 방지 최소 변경안 2가지 제안 및 1개 추천.

Context:
- 프로젝트는 Vite + React + TypeScript 5.5 환경.
- 현 lint 스크립트는 전체 워크스페이스 대상으로 실행되며 max-warnings 0 설정.
- 기존 ESLint 규칙은 React Hooks, TS 기본 추천과 로컬 정책(예: localStorage, dexie 접근 제한)에 집중.

Methodology:
- package.json 스크립트와 devDependencies 검토.
- 루트 ESLint 설정 파일(.eslintrc.cjs) 내용 확인.
- eslint.config.* 및 package.json 내 eslintConfig 존재 여부 검색.

Findings (facts unless 표시):
- lint 스크립트 존재: npm run lint → eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0. (source: package.json)
- ESLint 및 TS/React 관련 플러그인 설치: eslint@8.57, @typescript-eslint/parser/plugin, eslint-plugin-react-hooks, eslint-plugin-react-refresh. (source: package.json devDependencies)
- 설정 파일: 루트에 .eslintrc.cjs 1개. eslint.config.* 없음. package.json 내 eslintConfig 없음. (source: file search + grep)
- 현재 규칙 세트: eslint:recommended, @typescript-eslint/recommended, react-hooks/recommended, react-refresh/only-export-components, 여러 no-restricted-* 규칙(localStorage/dexie). 중복 import 차단 규칙 없음. (source: .eslintrc.cjs)
- ignore 대상: dist, dist-electron, node_modules, .eslintrc.cjs. (source: .eslintrc.cjs)

Recommendations (minimal options):
- Option A (built-in, zero new deps): 추가 규칙 'no-duplicate-imports': ['error', { includeExports: true }]. 장점: ESLint 기본 제공, 설치 불필요, TS/JS 모두 즉시 적용. 제한: type import와 value import를 분리 선언할 때도 경고 가능.
- Option B (eslint-plugin-import 추가): devDependency로 eslint-plugin-import 추가 후 'import/no-duplicates': ['error', { considerQueryString: true }]. 장점: type/value 분리(import type) 케이스도 중복 감지 정확도가 높음. 제한: 새 플러그인 설치 필요, config 확장 또는 rules 추가 필요.

Preferred (minimal/safe):
- 선택: Option A. 이유: 이미 ESLint 8.57과 @typescript-eslint 파이프라인이 구축되어 있어 추가 의존성 없이 바로 적용 가능하며 lint 스크립트에도 변경이 거의 없다. TS의 type-only import를 별도 줄로 쓰는 패턴이 드물다면 false-positive 위험이 낮아 가장 빠르고 안전한 도입 경로다. 필요 시 추후 Option B로 강화 가능.

Open Questions:
- 팀이 type-only import를 value import와 분리 선언하는 패턴을 얼마나 사용하는가? (많다면 Option B가 더 적합)
- lint 범위에서 tests/나 scripts/에 대한 예외가 필요한가?
