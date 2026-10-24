import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'next/server': fileURLToPath(new URL('./node_modules/next/server.js', import.meta.url)), 'next/headers': fileURLToPath(new URL('./node_modules/next/headers.js', import.meta.url)) } }, test: { include: ['src/**/*.test.ts'], server: { deps: { inline: ['next-auth'] } } } });
