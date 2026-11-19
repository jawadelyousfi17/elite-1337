import { z } from 'zod';
import layouts from './cluster-layouts.json';

export type LayoutSeat = {
  campusId: number;
  clusterId: string;
  workstationId: string;
  x: number;
  y: number;
  rotation?: number;
  roomLabel?: string;
  enabled: boolean;
};

export type ClusterLayout = {
  campusId: number;
  clusterId: string;
  width: number;
  height: number;
  seats: LayoutSeat[];
  source: string;
  verifiedAt: string;
};

// No authoritative 1337 coordinates or enabled-seat inventory has been supplied.
// Keep this empty until campus staff or another authoritative source provides one.
const seatSchema = z.object({ campusId: z.number().int().positive(), clusterId: z.string().regex(/^[a-z]\d{1,3}$/), workstationId: z.string().regex(/^[a-z]\d{1,3}r\d{1,3}p\d{1,3}$/), x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative(), rotation: z.number().finite().optional(), roomLabel: z.string().optional(), enabled: z.boolean() });
const layoutSchema = z.object({ campusId: z.number().refine((id) => [16, 21, 55, 75].includes(id)), clusterId: z.string().regex(/^[a-z]\d{1,3}$/), width: z.number().finite().positive(), height: z.number().finite().positive(), seats: z.array(seatSchema).min(1), source: z.string().trim().min(1), verifiedAt: z.string().datetime() });
/** Reject ambiguous or out-of-bounds inventories before they claim seat availability. */
export function parseClusterLayouts(input: unknown): ClusterLayout[] {
  const parsed = z.array(layoutSchema).parse(input), clusters = new Set<string>(), hosts = new Set<string>();
  for (const layout of parsed) {
    const key = `${layout.campusId}:${layout.clusterId}`;
    if (clusters.has(key)) throw new Error('Duplicate cluster');
    clusters.add(key);
    for (const seat of layout.seats) {
      const host = `${seat.campusId}:${seat.workstationId}`;
      if (hosts.has(host) || seat.campusId !== layout.campusId || seat.clusterId !== layout.clusterId || !seat.workstationId.startsWith(`${layout.clusterId}r`) || seat.x >= layout.width || seat.y >= layout.height) throw new Error('Invalid or duplicate seat');
      hosts.add(host);
    }
  }
  return parsed;
}
export const verifiedClusterLayouts: readonly ClusterLayout[] = parseClusterLayouts(layouts);

export function layoutFor(campusId: number, clusterId: string): ClusterLayout | null {
  return verifiedClusterLayouts.find((item) => item.campusId === campusId && item.clusterId === clusterId) ?? null;
}

export function inventoryFor(campusId: number): LayoutSeat[] {
  return verifiedClusterLayouts.filter((item) => item.campusId === campusId).flatMap((item) => item.seats);
}
