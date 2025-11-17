/**
 * Electron 빌드 스크립트
 *
 * @role Electron Main/Preload 프로세스를 TypeScript에서 JavaScript로 컴파일
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Electron processes...');

// 출력 디렉토리 생성
const distElectron = path.join(__dirname, '../dist-electron');
if (!fs.existsSync(distElectron)) {
  fs.mkdirSync(distElectron, { recursive: true });
}

try {
  // TypeScript 컴파일
  execSync('tsc -p tsconfig.electron.json', { stdio: 'inherit' });

  // dist-electron/electron/ → dist-electron/으로 flat하게 복사
  const sourceDir = path.join(distElectron, 'electron');
  if (fs.existsSync(sourceDir)) {
    // main/, preload/ 폴더 복사
    const mainSource = path.join(sourceDir, 'main');
    const preloadSource = path.join(sourceDir, 'preload');
    const mainDest = path.join(distElectron, 'main');
    const preloadDest = path.join(distElectron, 'preload');

    if (fs.existsSync(mainSource)) {
      fs.cpSync(mainSource, mainDest, { recursive: true });
    }
    if (fs.existsSync(preloadSource)) {
      fs.cpSync(preloadSource, preloadDest, { recursive: true });
    }

    // electron/ 폴더 삭제
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }

  console.log('✅ Electron build completed');
} catch (error) {
  console.error('❌ Electron build failed:', error.message);
  process.exit(1);
}
