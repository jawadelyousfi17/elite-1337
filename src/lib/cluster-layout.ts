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
export const verifiedClusterLayouts: readonly ClusterLayout[] = [];

export function layoutFor(campusId: number, clusterId: string): ClusterLayout | null {
  return verifiedClusterLayouts.find((item) => item.campusId === campusId && item.clusterId === clusterId) ?? null;
}

export function inventoryFor(campusId: number): LayoutSeat[] {
  return verifiedClusterLayouts.filter((item) => item.campusId === campusId).flatMap((item) => item.seats);
}
