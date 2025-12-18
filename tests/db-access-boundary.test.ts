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
import ts from 'typescript';

// 허용 경로 패턴 (정규식)
const ALLOWED_PATH_PATTERNS = [
    /^src[\\/]data[\\/]repositories[\\/]/,
    /^src[\\/]data[\\/]db[\\/]/,
];

// 금지된 dexieClient 직접 import 식별자
const FORBIDDEN_DEXIECLIENT_MODULE_IDS = [
    '@/data/db/dexieClient',
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

function createSourceFile(filePath: string, content: string): ts.SourceFile {
    const isTsx = filePath.endsWith('.tsx');
    return ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2022,
        true,
        isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
}

function getLineSnippet(content: string, lineNumber1Based: number): string {
    const lines = content.split('\n');
    const raw = lines[lineNumber1Based - 1] ?? '';
    return raw.trim();
}

/**
 * 파일 AST에서 금지된 dexieClient 직접 import를 검사
 */
function findForbiddenDexieClientImports(filePath: string, content: string): string[] {
    const sourceFile = createSourceFile(filePath, content);
    const violations: string[] = [];

    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
            const moduleId = ts.isStringLiteral(node.moduleSpecifier)
                ? node.moduleSpecifier.text
                : '';

            const isForbiddenExact = FORBIDDEN_DEXIECLIENT_MODULE_IDS.includes(moduleId);
            const isForbiddenContains = moduleId.includes('dexieClient');

            if (isForbiddenExact || isForbiddenContains) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                const lineNo = line + 1;
                violations.push(`Line ${lineNo}: ${getLineSnippet(content, lineNo)}`);
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return violations;
}

/**
 * 파일 AST에서 금지된 db.* 직접 접근을 검사
 * - 주석/문자열은 AST에 포함되지 않으므로 false positive를 자연스럽게 방지
 */
function findForbiddenDbAccessAst(filePath: string, content: string): string[] {
    const sourceFile = createSourceFile(filePath, content);
    const violations: string[] = [];

    const chainApi = ts as unknown as {
        isPropertyAccessChain?: (node: ts.Node) => node is ts.PropertyAccessChain;
        isElementAccessChain?: (node: ts.Node) => node is ts.ElementAccessChain;
    };

    const isDbIdentifier = (expr: ts.Expression): boolean =>
        ts.isIdentifier(expr) && expr.text === 'db';

    const report = (node: ts.Node) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const lineNo = line + 1;
        violations.push(`Line ${lineNo}: ${getLineSnippet(content, lineNo)}`);
    };

    const visit = (node: ts.Node) => {
        // db.property / db?.property
        if (ts.isPropertyAccessExpression(node) && isDbIdentifier(node.expression)) {
            report(node);
        }
        // TypeScript 5.x: optional chaining은 PropertyAccessChain
        if (chainApi.isPropertyAccessChain?.(node) && isDbIdentifier(node.expression)) {
            report(node);
        }
        // db['property'] / db?.['property']
        if (ts.isElementAccessExpression(node) && isDbIdentifier(node.expression)) {
            report(node);
        }
        if (chainApi.isElementAccessChain?.(node) && isDbIdentifier(node.expression)) {
            report(node);
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
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
            const issues = findForbiddenDexieClientImports(filePath, content);
            
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
            const issues = findForbiddenDbAccessAst(filePath, content);
            
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
