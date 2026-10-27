import type { NextConfig } from 'next';
// Docker builds (see DOCKER.md) set NEXT_OUTPUT=standalone for a small self-contained server; Vercel ignores it.
const config: NextConfig = { poweredByHeader: false, ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}) };
export default config;
