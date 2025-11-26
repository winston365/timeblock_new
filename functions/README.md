# Firebase Cloud Functions

TimeBlock Planner를 위한 서버리스 백엔드 함수

## 📋 개요

이 디렉토리에는 Firebase Cloud Functions가 포함되어 있습니다. 현재 주요 기능은 **매일 자동으로 템플릿에서 작업 생성**입니다.

## 🏗 아키텍처: Server-First Strategy

### 설계 원칙

클라이언트와 서버가 동시에 작업을 생성하면 중복이 발생할 수 있습니다. 이를 방지하기 위해 **Server-First 전략**을 사용합니다:

```
┌──────────────────────────────────────────────────────────┐
│          Server-First Template Generation                │
├──────────────────────────────────────────────────────────┤
│  ✅ Firebase Function = Primary Source of Truth          │
│  ✅ 클라이언트 = Observer (읽기 전용)                      │
│  ✅ Idempotency 보장 (중복 방지)                          │
│  ✅ 시스템 상태 추적 (lastTemplateGeneration)             │
└──────────────────────────────────────────────────────────┘

매일 00:00 KST
    │
    ▼
Firebase Cloud Function 실행
    │
    ├─▶ 1. systemState 확인 (lastTemplateGeneration)
    │      └─▶ 오늘 이미 실행했으면 스킵 (Idempotency)
    │
    ├─▶ 2. Templates 컬렉션에서 autoGenerate=true 템플릿 로드
    │
    ├─▶ 3. 각 템플릿의 recurrence 확인
    │      ├─ daily: 매일 생성
    │      ├─ weekdays: 월~금 생성
    │      ├─ weekends: 토~일 생성
    │      └─ custom: daysOfWeek 배열 확인 (e.g., [1,3,5] = 월,수,금)
    │
    ├─▶ 4. 오늘 날짜의 DailyData에 작업 추가
    │      └─▶ Firebase RTDB: /dailyData/{YYYY-MM-DD}
    │
    └─▶ 5. systemState 업데이트 (lastTemplateGeneration = 오늘)
    │
    ▼
클라이언트는 Firebase Realtime Listener로 자동 반영
```

### Server-First의 장점

| 항목 | Server-First | Client-First |
|------|--------------|--------------|
| **중복 방지** | ✅ 서버가 단일 진실 공급원 | ❌ 여러 클라이언트가 동시 생성 가능 |
| **일관성** | ✅ 모든 디바이스에 동일한 작업 | ❌ 디바이스마다 다를 수 있음 |
| **오프라인 대응** | ⚠️ 온라인 필요 | ✅ 오프라인에서도 생성 가능 |
| **디버깅** | ✅ 서버 로그 확인 | ❌ 각 클라이언트 로그 확인 필요 |

## 📁 파일 구조

```
functions/
├── index.js                 # ⭐ 메인 함수 정의
├── package.json            # 의존성
├── package-lock.json
└── shared/                 # 클라이언트와 공유하는 코드
    └── constants/
        └── resistanceMultipliers.js
```

## 🔧 주요 함수

### 1. `generateDailyTasksFromTemplates`

**스케줄**: 매일 00:00 KST

**역할**: 템플릿에서 작업 자동 생성

**실행 흐름**:

```javascript
exports.generateDailyTasksFromTemplates = onSchedule({
  schedule: "0 0 * * *",      // Cron: 매일 00:00
  timeZone: "Asia/Seoul",     // KST
}, async (event) => {
  // 1. Idempotency 체크
  const systemState = await db.ref('systemState/current').once('value');
  const lastGen = systemState.val()?.lastTemplateGeneration;

  if (lastGen === today) {
    logger.info('Already generated today. Skipping.');
    return;
  }

  // 2. 템플릿 로드
  const templatesSnapshot = await db.ref('templates').once('value');
  const templates = templatesSnapshot.val();

  // 3. autoGenerate=true 템플릿 필터링
  const autoTemplates = Object.values(templates).filter(t => t.autoGenerate);

  // 4. 오늘 요일에 맞는 템플릿만 선택
  const todayTemplates = autoTemplates.filter(template => {
    return shouldGenerateToday(template, today);
  });

  // 5. 작업 생성 및 Firebase에 저장
  const tasks = todayTemplates.map(t => createTaskFromTemplate(t, today));

  await db.ref(`dailyData/${today}/tasks`).set(tasks);

  // 6. systemState 업데이트
  await db.ref('systemState/current').update({
    lastTemplateGeneration: today,
  });

  logger.info(`Generated ${tasks.length} tasks for ${today}`);
});
```

### 2. `createTaskFromTemplate`

**역할**: 템플릿에서 Task 객체 생성

**입력**:
- `template`: Template 객체
- `date`: 날짜 문자열 (YYYY-MM-DD)

**출력**: Task 객체

```javascript
function createTaskFromTemplate(template, date) {
  const adjustedDuration = Math.round(
    template.baseDuration * getResistanceMultiplier(template.resistance)
  );

  return {
    id: generateId('task'),
    text: template.text,
    memo: template.memo || '',
    baseDuration: template.baseDuration,
    resistance: template.resistance,
    adjustedDuration,
    timeBlock: template.timeBlock || null,
    hourSlot: getHourSlotFromTimeBlock(template.timeBlock),
    completed: false,
    createdAt: new Date().toISOString(),
    fromAutoTemplate: true,
    // ...
  };
}
```

### 3. `shouldGenerateToday`

**역할**: 템플릿의 recurrence 설정에 따라 오늘 생성할지 결정

**Recurrence 타입**:

| 타입 | 설명 | 예시 |
|------|------|------|
| `daily` | 매일 | 매일 운동 |
| `weekdays` | 월~금 | 업무 회의 |
| `weekends` | 토~일 | 주말 휴식 |
| `custom` | 특정 요일 | `daysOfWeek: [1,3,5]` = 월,수,금 |

```javascript
function shouldGenerateToday(template, todayDate) {
  const dayOfWeek = new Date(todayDate).getDay(); // 0=일, 1=월, ..., 6=토

  switch (template.recurrence) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      return template.daysOfWeek?.includes(dayOfWeek) || false;
    default:
      return false;
  }
}
```

## 🔄 클라이언트 통합

### 클라이언트는 Observer 역할

클라이언트는 Firebase Realtime Listener를 통해 서버가 생성한 작업을 자동으로 받습니다:

```typescript
// 클라이언트 (React)
useEffect(() => {
  const dailyDataRef = firebase.ref(`dailyData/${currentDate}`);

  const unsubscribe = dailyDataRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // 서버가 생성한 작업을 UI에 반영
      setDailyData(data);
    }
  });

  return () => dailyDataRef.off('value', unsubscribe);
}, [currentDate]);
```

### 중복 방지 메커니즘

1. **서버 측**: `systemState/current/lastTemplateGeneration` 확인
2. **클라이언트 측**: 작업 생성 안 함 (읽기 전용)

```typescript
// ❌ 클라이언트에서 템플릿 작업 생성 금지
// 서버가 이미 생성했으므로 중복됨

// ✅ 클라이언트는 Firebase에서 읽기만
const dailyData = await loadDailyData(date); // Firebase에서 로드
```

## 🚀 배포 가이드

### 1. Firebase CLI 설치

```bash
npm install -g firebase-tools
```

### 2. Firebase 로그인

```bash
firebase login
```

### 3. 프로젝트 설정

```bash
firebase use test1234-edcb6  # 프로젝트 ID
```

### 4. Functions 의존성 설치

```bash
cd functions
npm install
```

### 5. 배포

```bash
# Functions 디렉토리에서
firebase deploy --only functions

# 또는 특정 함수만
firebase deploy --only functions:generateDailyTasksFromTemplates
```

### 6. 로그 확인

```bash
firebase functions:log
```

## 🧪 로컬 테스트

### Firebase Emulator 사용

```bash
# Firebase Tools 설치 (이미 했으면 생략)
npm install -g firebase-tools

# Emulator 시작
firebase emulators:start

# 함수 수동 트리거 (테스트)
curl http://localhost:5001/test1234-edcb6/us-central1/generateDailyTasksFromTemplates
```

### 수동 테스트 (Firebase Console)

1. Firebase Console → Functions 탭
2. `generateDailyTasksFromTemplates` 선택
3. "테스트" 버튼 클릭
4. 로그 확인

## 📊 모니터링

### 실행 로그 확인

Firebase Console → Functions → Logs:

```
✅ Generated 5 tasks for 2025-01-17
✅ Updated systemState: lastTemplateGeneration = 2025-01-17
```

### 에러 처리

함수 실행 중 에러 발생 시:
- Firebase Console → Functions → Logs에서 에러 확인
- `logger.error()` 메시지 확인
- Retry 정책: Firebase가 자동으로 재시도 (최대 7일)

## ⚙️ 환경 변수

Firebase Functions는 환경 변수를 통해 설정을 관리합니다:

```bash
# 환경 변수 설정
firebase functions:config:set someservice.key="THE API KEY"

# 환경 변수 조회
firebase functions:config:get

# 함수 코드에서 사용
const apiKey = functions.config().someservice.key;
```

## 🔐 보안

### IAM 권한

Firebase Functions는 다음 권한이 필요합니다:
- Realtime Database 읽기/쓰기
- Cloud Scheduler (스케줄 실행)

### 비용 최적화

- **무료 할당량**: 매일 1회 실행 (무료)
- **Cold Start**: 첫 실행 시 느릴 수 있음 (15초 이내 정상)
- **Timeout**: 기본 60초 (충분함)

## 📝 디버깅 팁

### 1. 로컬 테스트

```javascript
// functions/index.js
// 테스트용 함수 추가 (개발 환경만)
if (!IS_PRODUCTION) {
  exports.testTemplateGeneration = onRequest(async (req, res) => {
    // 수동으로 함수 실행
    const result = await generateDailyTasksFromTemplates();
    res.json({ success: true, result });
  });
}
```

### 2. 타임존 확인

```javascript
const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
logger.info(`Current KST: ${now}`);
```

### 3. 중복 생성 확인

```bash
# Firebase Console → Realtime Database
# systemState/current/lastTemplateGeneration 확인
```

## 🔗 관련 모듈

- `src/data/repositories/templateRepository.ts` - 템플릿 CRUD
- `src/app/hooks/useAppInitialization.ts` - 클라이언트 초기화 로직
- `src/shared/types/domain.ts` - Task, Template 타입 정의

## 🎓 Best Practices

1. **Idempotency**: 같은 날짜에 여러 번 실행해도 안전
2. **Logging**: 모든 중요한 작업은 로그 남기기
3. **Error Handling**: try-catch로 에러 처리
4. **Timeout**: 함수 실행 시간 모니터링
5. **Cost Optimization**: 불필요한 DB 읽기/쓰기 최소화

## 📚 추가 리소스

- [Firebase Functions 공식 문서](https://firebase.google.com/docs/functions)
- [Cloud Scheduler 문서](https://cloud.google.com/scheduler/docs)
- [Firebase Realtime Database 문서](https://firebase.google.com/docs/database)
