import path from 'path';
import { defineConfig } from 'vitest/config';

const coverageInclude = [
  'src/lib/crypto.ts',
  'src/lib/error-utils.ts',
  'src/lib/folder-utils.ts',
  'src/lib/markdown-linter/types.ts',
  'src/lib/markdown-linter/rules.ts',
  'src/lib/markdown-linter/registry.ts',
  'src/lib/search/types.ts',
  'src/lib/server-auth.ts',
  'src/lib/storage-path.ts',
  'src/services/apiClient.ts',
  'src/services/dashboardDocUtils.ts',
  'src/services/dashboardPersistence.ts',
  'src/services/dashboardUtils.ts',
  'src/services/editorSemanticStore.ts',
  'src/services/searchApi.ts',
  'src/services/snippetApi.ts',
  'src/services/subscriptionApi.ts',
  'src/store/dashboard.selectors.ts',
  'src/store/dashboardSlice.ts',
  'src/types/documents.ts',
  'src/types/payments.ts',
  'src/types/subscription.ts',
  'src/types/workspace.ts'
];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: coverageInclude,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
