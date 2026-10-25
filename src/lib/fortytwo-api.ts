import { z } from 'zod';
import { INTRA_CDN, MAX_PHOTO_BYTES, intraPhotoPath, validPhotoPath } from './avatars/intra-photo';

const campusSchema = z.object({ id: z.number().int(), name: z.string(), city: z.string().nullish(), country: z.string().nullish() });
export const summarySchema = z.object({
  id: z.number().int(), login: z.string().min(1), displayname: z.string().nullish(),
  pool_year: z.string().nullish(), pool_month: z.string().nullish(),
  kind: z.string().nullish(), active: z.boolean().optional(), 'active?': z.boolean().optional(),
  'staff?': z.boolean().optional(), 'alumni?': z.boolean().optional(), alumni: z.boolean().optional(), alumnized_at: z.string().nullish(),
  image: z.unknown().transform(intraPhotoPath).optional(),
});
export const meSchema = summarySchema.extend({ campus: z.array(campusSchema).default([]), campus_users: z.array(z.object({ campus_id: z.number().int(), is_primary: z.boolean().nullish() })).default([]) });
export const cursusUserSchema = z.object({
  id: z.number().int(), cursus_id: z.number().int(), level: z.number().finite().nullish(),
  begin_at: z.string().nullish(), end_at: z.string().nullish(), blackholed_at: z.string().nullish(),
  grade: z.string().nullish(), user: summarySchema,
});
export const campusLocationSchema = z.object({
  id: z.number().int(), campus_id: z.number().int(), host: z.string().nullish(),
  begin_at: z.string().nullish(), end_at: z.string().nullish(),
  user: z.object({ id: z.number().int() }).nullish(),
});
export const projectUserSchema = z.object({
  id: z.number().int(), status: z.string(), updated_at: z.string(), created_at: z.string().nullish(),
  cursus_ids: z.array(z.number().int()).default([]), occurrence: z.number().int().nullish(),
  'validated?': z.boolean().nullish(), marked_at: z.string().nullish(),
  // Each attempt is a team; a finished team's closed_at is when its evaluation ended.
  teams: z.array(z.object({ id: z.number().int(), status: z.string().nullish(), 'validated?': z.boolean().nullish(), closed_at: z.string().nullish() })).default([]),
  project: z.object({ id: z.number().int(), name: z.string(), slug: z.string() }),
  user: z.object({ id: z.number().int(), login: z.string() }),
});
export type ApiProjectUser = z.infer<typeof projectUserSchema>;
/** A peer evaluation; the corrector is an object for people (a string marks automated or hidden correctors). */
export const scaleTeamSchema = z.object({
  id: z.number().int(), filled_at: z.string().nullish(),
  corrector: z.union([z.object({ id: z.number().int(), login: z.string() }), z.string()]).nullish(),
  flag: z.object({ name: z.string(), positive: z.boolean() }).nullish(),
});
export type ApiScaleTeam = z.infer<typeof scaleTeamSchema>;
export type ApiCampus = z.infer<typeof campusSchema>;
export type ApiCursusUser = z.infer<typeof cursusUserSchema>;
export type ApiMe = z.infer<typeof meSchema>;
export type ApiUserSummary = z.infer<typeof summarySchema>;
export type ApiCampusLocation = z.infer<typeof campusLocationSchema>;

const API = 'https://api.intra.42.fr';
const PAGE_SIZE = 100;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export class IncompletePopulationError extends Error { constructor(message: string) { super(message); this.name = 'IncompletePopulationError'; } }
export class RateBudgetError extends Error { constructor() { super('The 42 API hourly request budget is temporarily exhausted. Try again later.'); this.name = 'RateBudgetError'; } }

export class RequestPacer {
  private tail = Promise.resolve();
  private nextAt = 0;
  private hour: number[] = [];
  constructor(private spacingMs = 600, private maxPerHour = 1180, private now = () => Date.now(), private sleep = delay) {}
  async acquire() {
    const run = this.tail.then(async () => {
      const now = this.now();
      this.hour = this.hour.filter((time) => now - time < 3_600_000);
      if (this.hour.length >= this.maxPerHour) throw new RateBudgetError();
      await this.sleep(Math.max(0, this.nextAt - now));
      const at = this.now();
      this.nextAt = at + this.spacingMs;
      this.hour.push(at);
    });
    this.tail = run.catch(() => {});
    return run;
  }
}

export class FortyTwoClient {
  private token?: { value: string; expiresAt: number };
  private tokenPromise?: Promise<string>;
  constructor(private pace = new RequestPacer(), private fetcher: typeof fetch = fetch) {}
  private async appToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = this.fetchToken();
    try { return await this.tokenPromise; }
    finally { this.tokenPromise = undefined; }
  }
  private async fetchToken() {
    const id = process.env.FORTYTWO_CLIENT_ID, secret = process.env.FORTYTWO_CLIENT_SECRET;
    if (!id || !secret) throw new Error('42 API credentials are not configured');
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.pace.acquire();
      let response: Response;
      try { response = await this.fetcher(`${API}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }), signal: AbortSignal.timeout(15_000), cache: 'no-store' }); }
      catch (error) { if (attempt === 4) throw error; await delay(1000 * 2 ** attempt); continue; }
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 4) throw new Error(`42 token request failed (${response.status})`);
        await delay(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`42 token request failed (${response.status})`);
      const token = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await response.json());
      this.token = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
      return token.access_token;
    }
    throw new Error('42 token retry limit reached');
  }
  async request<T>(path: string, schema: z.ZodType<T>, params: Record<string, string> = {}): Promise<{ data: T; total: number | null }> {
    const url = new URL(`/v2/${path.replace(/^\//, '')}`, API);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = await this.appToken();
      await this.pace.acquire();
      let response: Response;
      try { response = await this.fetcher(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), cache: 'no-store' }); }
      catch (error) { if (attempt === 4) throw error; await delay(500 * 2 ** attempt); continue; }
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 4) throw new Error(`42 API unavailable (${response.status})`);
        const retry = Number(response.headers.get('retry-after'));
        await delay(Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 60_000) : 1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`42 API request failed (${response.status})`);
      const totalHeader = response.headers.get('x-total');
      const total = totalHeader === null ? null : Number(totalHeader);
      return { data: schema.parse(await response.json()), total: total !== null && Number.isInteger(total) && total >= 0 ? total : null };
    }
    throw new Error('42 API retry limit reached');
  }
  // CDN photo downloads are not 42 API calls, so they skip the API request pacer.
  async cdnPhoto(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
    if (!validPhotoPath(path)) return null;
    const token = await this.appToken();
    const response = await this.fetcher(new URL(path, INTRA_CDN), { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) return null;
    if (Number(response.headers.get('content-length') ?? 0) > MAX_PHOTO_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
  }
  async waitingForCorrection(campusId: number, from: string, to: string): Promise<ApiProjectUser[]> {
    const path = 'projects_users';
    const base = { 'filter[campus]': String(campusId), 'filter[status]': 'waiting_for_correction', [`range[updated_at]`]: `${from},${to}`, sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Pending corrections omitted their total count');
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 10) throw new IncompletePopulationError('Pending corrections exceed the bounded request budget');
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': String(i + 2) })));
    if (rest.some((page) => page.total !== first.total)) throw new IncompletePopulationError('Pending corrections changed during pagination');
    const all = [first.data, ...rest.map((page) => page.data)].flat();
    if (all.length !== first.total || new Set(all.map((item) => item.id)).size !== first.total) throw new IncompletePopulationError('Pending corrections are incomplete');
    return all;
  }
  /** Project enrollments marked (graded) at a campus within a time window. */
  async markedProjects(campusId: number, from: string, to: string): Promise<ApiProjectUser[]> {
    const path = 'projects_users';
    const base = { 'filter[campus]': String(campusId), 'filter[marked]': 'true', 'range[marked_at]': `${from},${to}`, sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Marked projects omitted their total count');
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 30) throw new IncompletePopulationError('Marked projects exceed the bounded request budget');
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': String(i + 2) })));
    if (rest.some((page) => page.total !== first.total)) throw new IncompletePopulationError('Marked projects changed during pagination');
    const all = [first.data, ...rest.map((page) => page.data)].flat();
    // 42's total counts a few rows it never serves (about 1% here), so accept a small shortfall but never duplicates.
    if (new Set(all.map((item) => item.id)).size !== all.length || all.length > first.total || all.length < first.total * .98) throw new IncompletePopulationError('Marked projects are incomplete');
    return all;
  }
  /** Peer evaluations filled at a campus within a time window, optionally for one cursus. */
  async scaleTeams(campusId: number, from: string, to: string, cursus?: number): Promise<ApiScaleTeam[]> {
    const path = 'scale_teams';
    const base = { 'filter[campus_id]': String(campusId), ...(cursus ? { 'filter[cursus_id]': String(cursus) } : {}), 'range[filled_at]': `${from},${to}`, sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(scaleTeamSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Evaluations omitted their total count');
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 30) throw new IncompletePopulationError('Evaluations exceed the bounded request budget');
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request(path, z.array(scaleTeamSchema), { ...base, 'page[number]': String(i + 2) })));
    const all = [first.data, ...rest.map((page) => page.data)].flat();
    // Evaluations keep arriving while we page, so accept a small drift but never duplicates.
    if (new Set(all.map((item) => item.id)).size !== all.length || all.length < first.total * .97) throw new IncompletePopulationError('Evaluations are incomplete');
    return all;
  }
  /** Enrollments in the given projects, 100 users per batch; batches run concurrently under the request pacer and are checked for completeness. */
  async projectsUsersFor(userIds: number[], projectIds: number[]): Promise<ApiProjectUser[]> {
    const path = 'projects_users';
    const batches = Array.from({ length: Math.ceil(userIds.length / PAGE_SIZE) }, (_, index) => userIds.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE));
    const results = await Promise.all(batches.map(async (batch) => {
      const base = { 'filter[project_id]': projectIds.join(','), 'filter[user_id]': batch.join(','), sort: 'id', 'page[size]': String(PAGE_SIZE) };
      const first = await this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': '1' });
      if (first.total === null) throw new IncompletePopulationError('Project progress omitted its total count');
      const pages = Math.ceil(first.total / PAGE_SIZE);
      if (pages > 5) throw new IncompletePopulationError('Project progress exceeds the bounded request budget');
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request(path, z.array(projectUserSchema), { ...base, 'page[number]': String(i + 2) })));
      if (rest.some((page) => page.total !== first.total)) throw new IncompletePopulationError('Project progress changed during pagination');
      const chunk = [first.data, ...rest.map((page) => page.data)].flat();
      if (chunk.length !== first.total || new Set(chunk.map((item) => item.id)).size !== first.total) throw new IncompletePopulationError('Project progress is incomplete');
      return chunk;
    }));
    return results.flat();
  }
  async campus(id: number) { return (await this.request(`campus/${id}`, campusSchema)).data; }
  async campusActiveLocations(campusId: number): Promise<ApiCampusLocation[]> {
    const path = `campus/${campusId}/locations`;
    const base = { 'filter[active]': 'true', sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(campusLocationSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Active campus locations omitted their total count');
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 20) throw new IncompletePopulationError('Active campus locations exceed the bounded request budget');
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request(path, z.array(campusLocationSchema), { ...base, 'page[number]': String(i + 2) })));
    if (rest.some((page) => page.total !== first.total)) throw new IncompletePopulationError('Active campus locations changed during pagination');
    const all = [first.data, ...rest.map((page) => page.data)].flat();
    if (all.length !== first.total || new Set(all.map((item) => item.id)).size !== first.total) throw new IncompletePopulationError('Active campus locations are incomplete');
    if (all.some((item) => item.campus_id !== campusId)) throw new IncompletePopulationError('Active campus locations include another campus');
    return all;
  }
  async campusObservedHosts(campusId: number): Promise<string[]> {
    // This is a bounded 100-record recent-use sample, never an enabled-seat inventory.
    const path = `campus/${campusId}/locations`;
    const base = { sort: '-begin_at', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(campusLocationSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Recent campus locations omitted their total count');
    if (first.data.some((item) => item.campus_id !== campusId)) throw new IncompletePopulationError('Recent campus locations include another campus');
    return first.data.map((item) => item.host).filter((host): host is string => !!host);
  }
  async usersByPiscine(campusId: number, year: string, month?: string): Promise<ApiUserSummary[]> {
    const base = { 'filter[primary_campus_id]': String(campusId), 'filter[pool_year]': year, ...(month ? { 'filter[pool_month]': month } : {}), sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request('users', z.array(summarySchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError('Piscine list omitted its total count');
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 30) throw new IncompletePopulationError('Piscine list exceeds the bounded request budget; select a month');
    const remaining = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => this.request('users', z.array(summarySchema), { ...base, 'page[number]': String(i + 2) })));
    if (remaining.some((page) => page.total !== first.total)) throw new IncompletePopulationError('Piscine list changed during pagination');
    const all = [first.data, ...remaining.map((page) => page.data)].flat();
    if (all.length !== first.total || new Set(all.map((user) => user.id)).size !== first.total) throw new IncompletePopulationError('Piscine list is incomplete');
    return all;
  }
  async cursusUsers(campusId: number, cursusId: number): Promise<ApiCursusUser[]> {
    const path = 'cursus_users';
    const base = { 'filter[cursus_id]': String(cursusId), 'filter[campus_id]': String(campusId), sort: 'id', 'page[size]': String(PAGE_SIZE) };
    const first = await this.request(path, z.array(cursusUserSchema), { ...base, 'page[number]': '1' });
    if (first.total === null) throw new IncompletePopulationError(`Campus ${campusId}: the 42 API omitted its total count`);
    if (first.total === 0) {
      if (first.data.length) throw new IncompletePopulationError(`Campus ${campusId}: API count and page disagree`);
      return [];
    }
    const pages = Math.ceil(first.total / PAGE_SIZE);
    if (pages > 100) throw new IncompletePopulationError(`Campus ${campusId}: result exceeds the bounded request budget`);
    const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => this.request(path, z.array(cursusUserSchema), { ...base, 'page[number]': String(i + 2) })));
    if (remaining.some((page) => page.total !== first.total)) throw new IncompletePopulationError(`Campus ${campusId}: API result count changed during pagination`);
    const all = [first.data, ...remaining.map((page) => page.data)].flat();
    if (all.length !== first.total || new Set(all.map((item) => item.id)).size !== first.total) throw new IncompletePopulationError(`Campus ${campusId}: paginated result is incomplete`);
    return all;
  }
}

// Dev hot reloads share one pacer so the hourly budget is tracked across reloads,
// while the client is rebuilt so edited API methods take effect without a restart.
const globalForApi = globalThis as unknown as { fortyTwoPacer?: RequestPacer };
const pacer = globalForApi.fortyTwoPacer ?? new RequestPacer();
if (process.env.NODE_ENV !== 'production') globalForApi.fortyTwoPacer = pacer;
export const fortyTwoApi = new FortyTwoClient(pacer);
