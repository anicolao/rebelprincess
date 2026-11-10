import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting({ autoCleanup: false, noExternal: false })],
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    include: ['src/**/*.test.ts']
  }
});
