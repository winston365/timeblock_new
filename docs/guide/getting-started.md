# 빠른 시작

5분 안에 TimeBlock Planner 개발 환경을 설정하는 방법입니다.

## 사전 요구사항

- **Node.js 18** 이상
- **npm** (Node.js와 함께 설치됨)
- **Git**

## 설치

### 1. 저장소 클론

```bash
git clone https://github.com/winston365/timeblock_new.git
cd timeblock_new
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 모드 실행

**Electron 앱 실행 (권장):**

```bash
npm run electron:dev
```

**웹 전용 개발 모드:**

```bash
npm run dev
```

## 주요 명령어

### 개발

| 명령어 | 설명 |
|:---|:---|
| `npm run dev` | Vite 개발 서버 실행 (웹 전용) |
| `npm run electron:dev` | Electron 앱 개발 모드 실행 |
| `npm run electron:prod` | 프로덕션 빌드 로컬 실행 |

### 빌드

| 명령어 | 설명 |
|:---|:---|
| `npm run build` | 웹 에셋 빌드 (Vite) |
| `npm run electron:build` | Electron 메인 프로세스 빌드 |
| `npm run dist` | 현재 플랫폼용 인스톨러 생성 |
| `npm run dist:win` | Windows 인스톨러 (.exe) |
| `npm run dist:mac` | macOS 앱 (.dmg) |

### 코드 품질

| 명령어 | 설명 |
|:---|:---|
| `npm run lint` | ESLint 실행 |
| `npm test` | Vitest 테스트 실행 (494+ 테스트) |
| `npm run test:watch` | 테스트 Watch 모드 |
| `npm run test:coverage` | 커버리지 리포트 생성 |

## 검증

개발 환경이 제대로 설정되었는지 확인:

```bash
# 테스트 실행
npm test

# 린트 검사
npm run lint
```

::: tip 팁
`npm run electron:dev`는 Hot Module Replacement(HMR)를 지원하여 코드 변경 시 자동으로 새로고침됩니다.
:::

## 다음 단계

- [개발 환경 설정](/guide/development-setup) - 상세 설정 가이드
- [프로젝트 구조](/guide/project-structure) - 코드베이스 이해하기
