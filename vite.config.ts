import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// base './' lets the same build work at https://<user>.github.io/villagelink/ and on any other host.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  resolve: {
    // The e2e build swaps Supabase for an in-memory copy so the app can be tested offline.
    alias:
      mode === 'e2e'
        ? { '@supabase/supabase-js': fileURLToPath(new URL('./tests/fakeSupabase.ts', import.meta.url)) }
        : {},
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
