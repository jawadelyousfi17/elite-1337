import { neon, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * The app's one Neon HTTP client. On Vercel it talks to Neon directly. Self-hosted (see DOCKER.md), plain Postgres
 * sits behind Neon's local HTTP proxy, and DATABASE_HTTP_ENDPOINT points the driver at it.
 */
const endpoint = process.env.DATABASE_HTTP_ENDPOINT;
if (endpoint) neonConfig.fetchEndpoint = () => endpoint;

let client: NeonQueryFunction<false, false> | undefined;
export const sql = () => client ??= neon(process.env.DATABASE_URL!);
