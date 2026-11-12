import type { ApiCampusLocation } from './fortytwo-api';
import type { LayoutSeat } from './cluster-layout';

export type WorkstationState = 'occupied' | 'available' | 'unknown';
export type WorkstationOccupant = { login: string; displayName: string | null; avatar: string | null; since: string };
export type Workstation = {
  id: string; clusterId: string; state: WorkstationState;
  inventoryVerified: boolean; enabled: boolean;
  occupant?: WorkstationOccupant;
  row?: number; position?: number;
  x?: number; y?: number; rotation?: number; roomLabel?: string;
};
export type ActiveHostSource = { id: string; state: 'occupied' | 'unknown'; occupant?: { id: number; login: string; displayName: string | null; photo: string | null; since: string } };
export type ActiveHost = { id: string; state: 'occupied' | 'unknown'; occupant?: WorkstationOccupant };
export type ClusterSnapshot = {
  campusId: number; fetchedAt: string | null; ageSeconds: number | null;
  complete: boolean; fresh: boolean; observedSample: boolean;
  seats: Workstation[];
  counts: { occupied: number; available: number; unknown: number; disabled: number };
  notice: string | null;
};
const sorter = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function normalizeWorkstationId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  // Only observed 1337 workstation-shaped hosts are shown. Other host values
  // may identify personal machines and must not enter the public directory.
  return /^[a-z]\d{1,3}r\d{1,3}p\d{1,3}$/.test(normalized) ? normalized : null;
}

export type WorkstationAddress = { clusterId: string; row: number; position: number };

/** Derives the logical seat address exposed by 42 hostnames without assuming a campus-specific prefix. */
export function workstationAddress(host: string): WorkstationAddress | null {
  const normalized = normalizeWorkstationId(host);
  const match = normalized?.match(/^([a-z]\d{1,3})r(\d{1,3})p(\d{1,3})$/);
  if (!match) return null;
  return { clusterId: match[1], row: Number(match[2]), position: Number(match[3]) };
}

export function clusterFromHost(_campusId: number, host: string): string {
  return workstationAddress(host)?.clusterId ?? 'other';
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

export function summarizeActiveLocations(campusId: number, locations: ApiCampusLocation[], nowMs: number): ActiveHostSource[] {
  const groups = new Map<string, { users: Map<number, NonNullable<ActiveHostSource['occupant']>>; uncertain: boolean }>();
  for (const item of locations) {
    if (item.campus_id !== campusId) continue;
    const host = normalizeWorkstationId(item.host);
    if (!host) continue;
    const group = groups.get(host) ?? { users: new Map(), uncertain: false };
    const start = Date.parse(item.begin_at ?? '');
    if ((item.end_at !== null && item.end_at !== undefined) || !Number.isFinite(start) || start > nowMs + 300_000 || nowMs - start > 86_400_000 || !item.user?.id || !item.user.login) group.uncertain = true;
    else group.users.set(item.user.id, { id: item.user.id, login: item.user.login, displayName: item.user.displayname ?? null, photo: item.user.image ?? null, since: item.begin_at! });
    groups.set(host, group);
  }
  return [...groups].map(([id, group]) => {
    const occupied = !group.uncertain && group.users.size === 1;
    return { id, state: occupied ? 'occupied' as const : 'unknown' as const, ...(occupied ? { occupant: [...group.users.values()][0] } : {}) };
  });
}

export function buildClusterSnapshot(args: {
  campusId: number; observedHosts: string[]; activeHosts: ActiveHost[];
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
  const activeByHost = new Map<string, ActiveHost>();
  for (const item of activeHosts) {
    const host = normalizeWorkstationId(item.id);
    if (!host) continue;
    observed.add(host);
    activeByHost.set(host, item);
  }
  const allHosts = new Set([...observed, ...inventoryByHost.keys()]);
  const seats = [...allHosts].map((id): Workstation => {
    const entry = inventoryByHost.get(id);
    const active = activeByHost.get(id);
    const address = workstationAddress(id);
    let state: WorkstationState = 'unknown';
    if (fresh && entry?.enabled !== false) {
      if (active) state = active.state;
      else if (entry?.enabled) state = 'available';
    }
    return { id, clusterId: entry?.clusterId ?? address?.clusterId ?? 'other', state,
      inventoryVerified: !!entry, enabled: entry?.enabled !== false,
      ...(state === 'occupied' && active?.occupant ? { occupant: active.occupant } : {}),
      ...(address ? { row: address.row, position: address.position } : {}),
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
