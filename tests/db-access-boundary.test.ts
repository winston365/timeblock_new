/**
 * DB Access Boundary Guard Test
 * 
 * @role 정적 코드 분석으로 dexieClient 직접 import 및 db.* 직접 접근 위반을 검출
 * @description 허용 경로(src/data/repositories/**, src/data/db/**) 외부에서
 *              @/data/db/dexieClient를 import하거나 db.* 직접 접근하면 테스트 실패
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 허용 경로 패턴 (정규식)
const ALLOWED_PATH_PATTERNS = [
    /^src[\\/]data[\\/]repositories[\\/]/,
    /^src[\\/]data[\\/]db[\\/]/,
];

// 금지된 import 패턴
const FORBIDDEN_IMPORT_PATTERNS = [
    /@\/data\/db\/dexieClient/,
    /['"]\.\.?\/.*dexieClient['"]/,
    /from\s+['"]@\/data\/db\/dexieClient['"]/,
];

// 금지된 db.* 직접 접근 패턴 (주석/문자열 제외는 findForbiddenDbAccess에서 처리)
const FORBIDDEN_DB_ACCESS_PATTERNS = [
    /\bdb\.(table|globalInbox|aiInsights|dailyData|templates|settings|systemState|shopItems|completedInbox|taskCalendarMappings)\b/,
];

// 검사 대상 확장자
const TARGET_EXTENSIONS = ['.ts', '.tsx'];

// 제외 경로 (테스트, 문서 등)
const EXCLUDED_PATHS = [
    /^tests[\\/]/,
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /^coverage[\\/]/,
    /^agent-output[\\/]/,
    /^dist/,
    /node_modules/,
    /README\.md$/,
];

/**
 * 디렉토리를 재귀적으로 스캔하여 모든 파일 경로 반환
 */
function getAllFiles(dirPath: string, basePath: string = ''): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) {
        return files;
    }
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
            // node_modules 등 제외
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-electron') {
                continue;
            }
            files.push(...getAllFiles(fullPath, relativePath));
        } else if (entry.isFile()) {
            files.push(relativePath);
        }
    }
    
    return files;
}

/**
 * 파일이 허용 경로인지 확인
 */
function isAllowedPath(filePath: string): boolean {
    return ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * 파일이 제외 대상인지 확인
 */
function isExcludedPath(filePath: string): boolean {
    return EXCLUDED_PATHS.some(pattern => pattern.test(filePath));
}

/**
 * 파일이 검사 대상 확장자인지 확인
 */
function isTargetFile(filePath: string): boolean {
    return TARGET_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

/**
 * 파일 내용에서 금지된 import가 있는지 검사
 */
function findForbiddenImports(content: string): string[] {
    const violations: string[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
            if (pattern.test(line)) {
                violations.push(`Line ${i + 1}: ${line.trim()}`);
            }
        }
    }
    
    return violations;
}

/**
 * 파일 내용에서 금지된 db.* 직접 접근이 있는지 검사
 * 주석과 문자열 내부는 제외
 */
function findForbiddenDbAccess(content: string): string[] {
    const violations: string[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 주석 라인 스킵 (// 또는 * 로 시작)
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
        
        // 문자열 내부 제외를 위해 문자열 리터럴 제거
        const lineWithoutStrings = line
            .replace(/'[^']*'/g, '""')   // 싱글 쿼트 문자열 제거
            .replace(/"[^"]*"/g, '""')   // 더블 쿼트 문자열 제거
            .replace(/`[^`]*`/g, '""');  // 템플릿 리터럴 제거
        
        for (const pattern of FORBIDDEN_DB_ACCESS_PATTERNS) {
            if (pattern.test(lineWithoutStrings)) {
                violations.push(`Line ${i + 1}: ${line.trim()}`);
                break; // 같은 라인에서 중복 보고 방지
            }
        }
    }
    
    return violations;
}

describe('DB Access Boundary Guard', () => {
    it('should not have dexieClient imports outside allowed paths', () => {
        const projectRoot = process.cwd();
        const srcPath = path.join(projectRoot, 'src');
        
        // src 디렉토리의 모든 파일 스캔
        const allFiles = getAllFiles(srcPath, 'src');
        
        // 위반 목록
        const violations: Array<{ file: string; issues: string[] }> = [];
        
        for (const filePath of allFiles) {
            // 제외 대상 스킵
            if (isExcludedPath(filePath)) continue;
            
            // 비대상 확장자 스킵
            if (!isTargetFile(filePath)) continue;
            
            // 허용 경로 스킵
            if (isAllowedPath(filePath)) continue;
            
            // 파일 내용 읽기
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // 금지된 import 검사
            const issues = findForbiddenImports(content);
            
            if (issues.length > 0) {
                violations.push({ file: filePath, issues });
            }
        }
        
        // 위반 있으면 상세 메시지와 함께 실패
        if (violations.length > 0) {
            const message = violations.map(v => 
                `\n📁 ${v.file}:\n${v.issues.map(i => `   - ${i}`).join('\n')}`
            ).join('\n');
            
            expect.fail(
                `❌ dexieClient 직접 import 위반 ${violations.length}개 발견!\n` +
                `허용 경로: src/data/repositories/**, src/data/db/**\n` +
                `${message}\n\n` +
                `해결 방법: Repository 레이어(@/data/repositories/*)를 사용하세요.`
            );
        }
        
        // 성공 메시지
        expect(violations.length).toBe(0);
    });

    it('should not have db.* direct access outside allowed paths', () => {
        const projectRoot = process.cwd();
        const srcPath = path.join(projectRoot, 'src');
        
        // src 디렉토리의 모든 파일 스캔
        const allFiles = getAllFiles(srcPath, 'src');
        
        // 위반 목록
        const violations: Array<{ file: string; issues: string[] }> = [];
        
        for (const filePath of allFiles) {
            // 제외 대상 스킵
            if (isExcludedPath(filePath)) continue;
            
            // 비대상 확장자 스킵
            if (!isTargetFile(filePath)) continue;
            
            // 허용 경로 스킵
            if (isAllowedPath(filePath)) continue;
            
            // 파일 내용 읽기
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // 금지된 db.* 직접 접근 검사
            const issues = findForbiddenDbAccess(content);
            
            if (issues.length > 0) {
                violations.push({ file: filePath, issues });
            }
        }
        
        // 위반 있으면 상세 메시지와 함께 실패
        if (violations.length > 0) {
            const message = violations.map(v => 
                `\n📁 ${v.file}:\n${v.issues.map(i => `   - ${i}`).join('\n')}`
            ).join('\n');
            
            expect.fail(
                `❌ db.* 직접 접근 위반 ${violations.length}개 발견!\n` +
                `허용 경로: src/data/repositories/**, src/data/db/**\n` +
                `${message}\n\n` +
                `해결 방법: Repository 레이어(@/data/repositories/*)를 사용하세요.`
            );
        }
        
        // 성공 메시지
        expect(violations.length).toBe(0);
    });
});
