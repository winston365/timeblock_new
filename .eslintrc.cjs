module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'dist-electron', 'node_modules', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // ⚠️ localStorage 사용 금지 규칙
    'no-restricted-globals': [
      'error',
      {
        name: 'localStorage',
        message: '❌ localStorage 사용 금지! Dexie systemState를 사용하세요. 예외: theme 키만 허용. 자세한 내용은 CLAUDE.md 참고.',
      },
    ],
    // window.localStorage도 금지
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'localStorage',
        message: '❌ localStorage 사용 금지! Dexie systemState를 사용하세요. 예외: theme 키만 허용. 자세한 내용은 CLAUDE.md 참고.',
      },
    ],
    // 기존 프로젝트 규칙
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  // theme 관련 파일에서만 localStorage 허용
  overrides: [
    {
      files: ['src/main.tsx', 'src/features/settings/components/tabs/AppearanceTab.tsx'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-properties': 'off',
      },
    },
    // 기존 localStorage 사용 파일 (마이그레이션 완료 시 제거)
    {
      files: [
        'src/shared/lib/utils.ts', // deprecated 헬퍼 함수
      ],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-properties': 'off',
      },
    },
  ],
};
