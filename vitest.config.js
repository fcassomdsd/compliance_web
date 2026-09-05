import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom', // For Vue component testing
    globals: true,
    setupFiles: ['./tests/setup/i18n.js'],
    include: ['tests/unit/**/*.test.js', 'tests/server/**/*.test.js', 'tests/e2e/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura'],
      reportOnFailure: true,
      all: true,
      include: ['src/**/*.{js,vue}'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/main.js',
      ],
    },
  },
});
