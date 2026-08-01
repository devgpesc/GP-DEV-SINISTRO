import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
  },
}));
