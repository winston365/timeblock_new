import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/shared/utils/firebaseSanitizer.ts',
        'src/shared/services/sync/firebase/conflictResolver.ts',
        'src/shared/services/sync/firebase/syncCore.ts',
        'src/shared/services/sync/firebase/syncRetryQueue.ts',
        'src/shared/services/sync/syncLogger.ts',
        'src/shared/lib/eventBus/EventBus.ts',
        'src/shared/services/task/unifiedTaskService.ts',
        'src/shared/lib/storeUtils.ts',
        'src/shared/services/gameplay/taskCompletion/taskCompletionService.ts',
        'src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts',
        'src/shared/services/gameplay/taskCompletion/handlers/xpRewardHandler.ts',
        'src/shared/services/gameplay/taskCompletion/handlers/questProgressHandler.ts',
        'src/shared/services/gameplay/taskCompletion/handlers/waifuAffectionHandler.ts',
        'src/shared/services/gameplay/taskCompletion/handlers/blockCompletionHandler.ts',
      ],
      exclude: [
        'src/**/*.tsx',
        'src/app/**',
        'src/shared/types/**',
        'src/**/vite-env.d.ts',
        '**/*.d.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
