import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { campusIds } from './config';
import { buildClusterSnapshot, normalizeWorkstationId, summarizeActiveLocations } from './cluster-core';
import { inventoryFor } from './cluster-layout';
import { fortyTwoApi } from './fortytwo-api';
import { getStudentProfile } from './student-overview';

const cachedActive = singleFlight(unstable_cache(async (campusId: number) => {
  const locations = await fortyTwoApi.campusActiveLocations(campusId);
  const fetchedAt = new Date().toISOString();
  return { fetchedAt, hosts: summarizeActiveLocations(campusId, locations, Date.parse(fetchedAt)) };
}, ['1337-anonymous-active-hosts-v1'], { revalidate: 180 }));

const cachedObserved = singleFlight(unstable_cache(async (campusId: number) => {
  const hosts = await fortyTwoApi.campusObservedHosts(campusId);
  return [...new Set(hosts.map(normalizeWorkstationId).filter((host): host is string => !!host))];
}, ['1337-observed-campus-hosts-v1'], { revalidate: 86_400 }));

export async function clusterMembership(userId: string): Promise<{ memberships: number[]; primary: number | null }> {
  const profile = await getStudentProfile(userId);
  const permitted = new Set(campusIds());
  const memberships = [...new Set(profile.campus_users.map((entry) => entry.campus_id).filter((id) => permitted.has(id)))];
  const primary = profile.campus_users.find((entry) => entry.is_primary && memberships.includes(entry.campus_id))?.campus_id ?? memberships[0] ?? null;
  return { memberships, primary };
}

export async function getClusterSnapshot(campusId: number) {
  if (!campusIds().includes(campusId)) throw new Error('Unsupported campus');
  const [active, observed] = await Promise.allSettled([cachedActive(campusId), cachedObserved(campusId)]);
  const complete = active.status === 'fulfilled';
  const observedSample = observed.status === 'fulfilled';
  return buildClusterSnapshot({
    campusId,
    activeHosts: complete ? active.value.hosts : [],
    observedHosts: observedSample ? observed.value : [],
    inventory: inventoryFor(campusId),
    fetchedAt: complete ? active.value.fetchedAt : null,
    complete, observedSample, nowMs: Date.now(),
    notice: !complete ? '42 occupancy is unavailable or incomplete. Workstation states are unknown.'
      : !observedSample ? 'Recent workstation discovery is unavailable; only currently observed hosts are listed.'
      : null,
  });
}
