// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss()
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase';
            }
            if (id.includes('dexie')) {
              return 'dexie';
            }
            if (id.includes('html2canvas')) {
              return 'html2canvas';
            }
          }
        }
      }
    }
  },
});
