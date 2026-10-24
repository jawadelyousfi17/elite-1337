import Link from 'next/link';
import { requireStudent } from '@/lib/guard';
import { clusterMembership } from '@/lib/cluster-service';
import { ClusterExplorer } from '@/components/clusters/cluster-explorer';

export const metadata = { title: 'Cluster Explorer' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const campuses = [
  { id: 16, name: 'Khouribga' },
  { id: 21, name: 'Benguerir' },
  { id: 55, name: 'Tétouan' },
  { id: 75, name: 'Rabat' },
];

export default async function ClustersPage() {
  const user = await requireStudent();
  let membership: Awaited<ReturnType<typeof clusterMembership>>;
  try { membership = await clusterMembership(user.id); }
  catch { return <main className="shell empty"><h1>Campus membership unavailable</h1><p className="muted">We could not verify your 1337 campus right now. Please try again shortly.</p></main>; }
  if (!membership.memberships.length || !membership.primary) return <main className="shell empty"><h1>1337 campus membership required</h1><p className="muted">Your 42 account does not currently show a verified membership in the supported 1337 campuses.</p><Link className="btn btn-subtle" href="/leaderboard">Back to leaderboard</Link></main>;
  return <ClusterExplorer campuses={campuses} initialCampus={membership.primary}/>;
}
