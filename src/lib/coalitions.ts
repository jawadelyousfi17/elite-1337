import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { cursusId } from './config';
import { fortyTwoApi } from './fortytwo-api';

export type CoalitionStanding = { id: number; name: string; color: string | null; score: number; rank: number; total: number };

const coalitionSchema = z.object({ id: z.number().int(), name: z.string(), color: z.string().nullish(), score: z.number().nullish() });
const blocSchema = z.object({ cursus_id: z.number().int().nullish(), coalitions: z.array(coalitionSchema).default([]) });
const memberSchema = z.object({ coalition_id: z.number().int() });
const hex = /^#[0-9a-f]{3,8}$/i;

/** Ranks a campus's coalitions by score; ties share a rank, like the leaderboard. */
export function rankCoalitions(coalitions: z.infer<typeof coalitionSchema>[]): CoalitionStanding[] {
  return coalitions.map((coalition) => ({
    id: coalition.id, name: coalition.name, color: coalition.color && hex.test(coalition.color) ? coalition.color : null, score: coalition.score ?? 0,
    rank: 1 + coalitions.filter((other) => (other.score ?? 0) > (coalition.score ?? 0)).length, total: coalitions.length,
  })).sort((a, b) => a.rank - b.rank);
}

/** The Common Core coalitions of one campus, shared by every student there (1 request). Cached for 30 minutes. */
const loadCampusCoalitions = singleFlight(unstable_cache(async (campus: number) => {
  const { data } = await fortyTwoApi.request('blocs', z.array(blocSchema), { 'filter[campus_id]': String(campus) });
  return rankCoalitions(data.find((bloc) => bloc.cursus_id === cursusId())?.coalitions ?? []);
}, ['1337-coalitions-v1'], { revalidate: 1800 }));

/** Which coalitions a student belongs to (1 request); membership rarely changes, so it is cached for a day. */
const loadMemberships = singleFlight(unstable_cache(async (userId: number) => {
  const { data } = await fortyTwoApi.request(`users/${userId}/coalitions_users`, z.array(memberSchema));
  return data.map((member) => member.coalition_id);
}, ['1337-coalition-member-v1'], { revalidate: 86_400 }));

/** The student's Common Core coalition and where it stands on their campus; null when unknown or 42 is unavailable. */
export async function loadOwnCoalition(userId: number, campus: number): Promise<CoalitionStanding | null> {
  try {
    const [standings, memberships] = await Promise.all([loadCampusCoalitions(campus), loadMemberships(userId)]);
    return standings.find((coalition) => memberships.includes(coalition.id)) ?? null;
  } catch {
    return null;
  }
}
