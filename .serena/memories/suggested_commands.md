# 개발 명령어 가이드

## 개발 환경 실행

```bash
# Electron 개발 모드 (권장 - E2E 루프)
npm run electron:dev

# 웹 개발 서버만 실행
npm run dev

# 프로덕션 빌드 로컬 실행
npm run electron:prod
```

## 빌드

```bash
# 웹 에셋 빌드 (Vite)
npm run build

# Electron 메인 프로세스 빌드
npm run electron:build

# 현재 플랫폼용 배포 파일 생성
npm run dist

# 플랫폼별 빌드
npm run dist:win      # Windows 인스톨러
npm run dist:mac      # macOS 앱
npm run dist:linux    # Linux 패키지
```

## 코드 품질 및 테스트

```bash
# ESLint 실행
npm run lint

# Vitest 테스트 실행
npm run test

# Vitest watch 모드
npm run test:watch

# 테스트 커버리지
npm run test:coverage
```

## 버전 관리

```bash
# 패치 버전 증가 및 커밋
npm run bump

# 미리보기
npm run preview
```

## Windows 시스템 유틸리티 명령어

```powershell
# 디렉토리 목록
Get-ChildItem   # 또는 ls, dir

# 현재 디렉토리
Get-Location    # 또는 pwd

# 디렉토리 이동
Set-Location <path>  # 또는 cd <path>

# 파일 검색
Get-ChildItem -Recurse -Filter "*.ts"

# 패턴 검색 (grep 대신)
Select-String -Path "*.ts" -Pattern "searchPattern"

# 파일 내용 확인
Get-Content <file>  # 또는 cat, type

# 파일/폴더 존재 확인
Test-Path <path>
```

## Git 명령어

```bash
git status
git add .
git commit -m "type: message"
git push
git pull
git log --oneline
git diff
```
