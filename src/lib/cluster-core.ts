import type { ApiCampusLocation } from './fortytwo-api';
import type { LayoutSeat } from './cluster-layout';

export type WorkstationState = 'occupied' | 'available' | 'unknown';
export type Workstation = {
  id: string; clusterId: string; state: WorkstationState;
  inventoryVerified: boolean; enabled: boolean;
  x?: number; y?: number; rotation?: number; roomLabel?: string;
};
export type AnonymousActiveHost = { id: string; state: 'occupied' | 'unknown' };
export type ClusterSnapshot = {
  campusId: number; fetchedAt: string | null; ageSeconds: number | null;
  complete: boolean; fresh: boolean; observedSample: boolean;
  seats: Workstation[];
  counts: { occupied: number; available: number; unknown: number; disabled: number };
  notice: string | null;
};
const hostPatterns: Record<number, RegExp> = {
  16: /^(e\d+)r\d+p\d+$/,
  21: /^([ec]\d+)r\d+p\d+$/,
  55: /^(c\d+)r\d+p\d+$/,
  75: /^(c\d+)r\d+p\d+$/,
};
const sorter = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function normalizeWorkstationId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  // Only observed 1337 workstation-shaped hosts are shown. Other host values
  // may identify personal machines and must not enter the public directory.
  return /^[a-z]\d{1,3}r\d{1,3}p\d{1,3}$/.test(normalized) ? normalized : null;
}
export function clusterFromHost(campusId: number, host: string): string {
  return host.match(hostPatterns[campusId] ?? /$^/)?.[1] ?? 'other';
}
export function searchWorkstations(seats: Workstation[], query: string): Workstation[] {
  const normalized = query.trim().toLowerCase();
  return normalized ? seats.filter((seat) => seat.id.includes(normalized)) : seats;
}
export function isSnapshotFresh(fetchedAt: string | null, nowMs: number, maxAgeMs = 240_000): boolean {
  if (!fetchedAt) return false;
  const age = nowMs - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

export function summarizeActiveLocations(campusId: number, locations: ApiCampusLocation[], nowMs: number): AnonymousActiveHost[] {
  const groups = new Map<string, { users: Set<number>; uncertain: boolean }>();
  for (const item of locations) {
    if (item.campus_id !== campusId) continue;
    const host = normalizeWorkstationId(item.host);
    if (!host) continue;
    const group = groups.get(host) ?? { users: new Set<number>(), uncertain: false };
    const start = Date.parse(item.begin_at ?? '');
    if ((item.end_at !== null && item.end_at !== undefined) || !Number.isFinite(start) || start > nowMs + 300_000 || nowMs - start > 86_400_000 || !item.user?.id) group.uncertain = true;
    else group.users.add(item.user.id);
    groups.set(host, group);
  }
  return [...groups].map(([id, group]) => ({ id, state: !group.uncertain && group.users.size === 1 ? 'occupied' : 'unknown' }));
}

export function buildClusterSnapshot(args: {
  campusId: number; observedHosts: string[]; activeHosts: AnonymousActiveHost[];
  inventory: LayoutSeat[]; fetchedAt: string | null; complete: boolean;
  observedSample: boolean; nowMs: number; notice?: string | null;
}): ClusterSnapshot {
  const { campusId, observedHosts, activeHosts, inventory, fetchedAt, complete, observedSample, nowMs } = args;
  const fresh = complete && isSnapshotFresh(fetchedAt, nowMs);
  const inventoryByHost = new Map<string, LayoutSeat>();
  for (const seat of inventory) {
    const host = normalizeWorkstationId(seat.workstationId);
    if (seat.campusId === campusId && host) inventoryByHost.set(host, seat);
  }
  const observed = new Set<string>();
  for (const value of observedHosts) {
    const host = normalizeWorkstationId(value);
    if (host) observed.add(host);
  }
  const activeByHost = new Map<string, AnonymousActiveHost['state']>();
  for (const item of activeHosts) {
    const host = normalizeWorkstationId(item.id);
    if (!host) continue;
    observed.add(host);
    activeByHost.set(host, item.state);
  }
  const allHosts = new Set([...observed, ...inventoryByHost.keys()]);
  const seats = [...allHosts].map((id): Workstation => {
    const entry = inventoryByHost.get(id);
    const active = activeByHost.get(id);
    let state: WorkstationState = 'unknown';
    if (fresh && entry?.enabled !== false) {
      if (active) state = active;
      else if (entry?.enabled) state = 'available';
    }
    return { id, clusterId: entry?.clusterId ?? clusterFromHost(campusId, id), state,
      inventoryVerified: !!entry, enabled: entry?.enabled !== false,
      ...(entry ? { x: entry.x, y: entry.y, rotation: entry.rotation, roomLabel: entry.roomLabel } : {}) };
  }).sort((a, b) => sorter.compare(a.clusterId, b.clusterId) || sorter.compare(a.id, b.id));
  const counts = {
    occupied: seats.filter((seat) => seat.enabled && seat.state === 'occupied').length,
    available: seats.filter((seat) => seat.enabled && seat.state === 'available').length,
    unknown: seats.filter((seat) => seat.enabled && seat.state === 'unknown').length,
    disabled: seats.filter((seat) => !seat.enabled).length,
  };
  return {
    campusId, fetchedAt, ageSeconds: fetchedAt ? Math.max(0, Math.floor((nowMs - Date.parse(fetchedAt)) / 1000)) : null,
    complete, fresh, observedSample, seats, counts,
    notice: args.notice ?? (!complete ? 'Campus occupancy is incomplete; workstation states are unknown.' : !fresh ? 'Campus occupancy is stale; workstation states are unknown.' : null),
  };
}
