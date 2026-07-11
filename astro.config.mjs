// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: true,
    imageService: true,
    skewProtection: false
  }),
  integrations: [react()],
  server: { port: 4323 },
  security: {
    // Magic-link form posts come from same-origin browser. Disable the strict
    // checkOrigin guard so Supabase signInWithOtp via POST works.
    checkOrigin: false
  },
  vite: {
    ssr: {
      noExternal: ['recharts']
    }
  }
});