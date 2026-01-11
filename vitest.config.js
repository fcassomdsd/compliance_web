import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // For Vue component testing
    globals: true,
    include: ['tests/*.test.js'],
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
