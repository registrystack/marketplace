import { defineConfig } from 'astro/config';
export default defineConfig({ site: 'https://marketplace.registrystack.org', output: 'static', vite: { build: { assetsInlineLimit: 0 } }, trailingSlash: 'always', server: { host: '127.0.0.1', port: 4317 } });
