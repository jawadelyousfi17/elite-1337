'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { CircleHelp, LayoutGrid, MapPin, Monitor, RefreshCw, Search, ZoomIn, ZoomOut } from '@/components/icons';
import { layoutFor } from '@/lib/cluster-layout';
import { searchWorkstations, type ClusterSnapshot, type Workstation } from '@/lib/cluster-core';
import { timeAgo } from '@/lib/time';

type Campus = { id: number; name: string };
const collator = new Intl.Collator('en', { numeric: true });

/** Keeps live occupancy readable while deriving each campus topology from its observed 42 hostnames. */
export function ClusterExplorer({ campuses, initialCampus }: { campuses: Campus[]; initialCampus: number }) {
  const [campusId, setCampusId] = useState(initialCampus);
  const [clusterId, setClusterId] = useState('all');
  const [snapshot, setSnapshot] = useState<ClusterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [zoom, setZoom] = useState(1);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const lastAttempt = useRef(0);

  const refresh = useCallback(async (id: number) => {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    const current = ++sequence.current;
    lastAttempt.current = Date.now();
    setLoading(true);
    try {
      const response = await fetch(`/api/clusters?campus=${id}`, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Cluster data is unavailable.');
      if (current !== sequence.current) return;
      setSnapshot(data as ClusterSnapshot);
      setProblem(null);
      setNow(Date.now());
    } catch (error) {
      if (controller.signal.aborted || current !== sequence.current) return;
      setSnapshot(null);
      setProblem(error instanceof Error ? error.message : 'Cluster data is unavailable.');
    } finally {
      if (current === sequence.current) { busy.current = false; setLoading(false); request.current = null; }
    }
  }, []);

  useEffect(() => {
    request.current?.abort();
    busy.current = false;
    sequence.current++;
    setSnapshot(null); setProblem(null); setClusterId('all'); setSelectedId(null);
    void refresh(campusId);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(campusId); }, 60_000);
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= 60_000) void refresh(campusId);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); window.clearInterval(clock); document.removeEventListener('visibilitychange', onVisibility); request.current?.abort(); busy.current = false; sequence.current++; };
  }, [campusId, refresh]);

  const expired = !!snapshot?.fetchedAt && !!now && now - Date.parse(snapshot.fetchedAt) > 240_000;
  const seats = useMemo(() => snapshot?.seats.map((seat) => expired ? { ...seat, state: 'unknown' as const } : seat) ?? [], [snapshot, expired]);
  const clusters = useMemo(() => [...new Set(seats.map((seat) => seat.clusterId))].sort(collator.compare), [seats]);
  useEffect(() => { if (clusters.length && !clusters.includes(clusterId)) setClusterId(clusters[0]); }, [clusterId, clusters]);
  const campusName = campuses.find((campus) => campus.id === campusId)?.name ?? 'Campus';
  const clusterSeats = clusterId === 'all' ? seats : seats.filter((seat) => seat.clusterId === clusterId);
  const shown = searchWorkstations(clusterSeats, query);
  const searchResults = query.trim() ? searchWorkstations(seats, query) : [];
  const selected = seats.find((seat) => seat.id === selectedId) ?? null;
  const live = seats.filter((seat) => seat.state === 'occupied' && seat.occupant).sort((a, b) => Date.parse(b.occupant!.since) - Date.parse(a.occupant!.since));
  const layout = clusterId === 'all' ? null : layoutFor(campusId, clusterId);
  const lastUpdated = snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'No successful update';
  const age = snapshot?.fetchedAt && now ? Math.max(0, Math.floor((now - Date.parse(snapshot.fetchedAt)) / 60_000)) : null;
  const selectSeat = (seat: Workstation) => {
    setClusterId(seat.clusterId);
    setSelectedId(seat.id);
    window.setTimeout(() => document.getElementById(`seat-${campusId}-${seat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 30);
  };

  return <main className="clusters-page"><section className="cluster-intra">
    <header className="cluster-intra-head"><div><span className="eyebrow">{campusName} · live campus</span><h1>Clusters</h1></div><div className="cluster-intra-tools"><CampusSelector campuses={campuses} selected={campusId} onChange={setCampusId}/><WorkstationSearch query={query} onChange={setQuery} onSubmit={() => { if (searchResults[0]) selectSeat(searchResults[0]); }}/><RefreshIndicator loading={loading} lastUpdated={lastUpdated} age={age} stale={snapshot ? expired || !snapshot.fresh : !!problem} onRefresh={() => void refresh(campusId)}/></div></header>
    {problem && <div className="cluster-notice danger" role="alert">{problem}</div>}{snapshot?.notice && <div className="cluster-notice" role="status">{snapshot.notice}</div>}{expired && <div className="cluster-notice" role="status">The last snapshot is stale. Workstation states are unknown until refresh succeeds.</div>}
    <div className="cluster-intra-grid">
      <section className="cluster-intra-map" aria-label={`${clusterId.toUpperCase()} workstation map`}>
        <div className="cluster-map-tabs" role="tablist" aria-label="Clusters">{clusters.map((id) => <button key={id} type="button" role="tab" aria-selected={clusterId === id} className={clusterId === id ? 'active' : undefined} onClick={() => { setClusterId(id); setSelectedId(null); setQuery(''); }}>{id === 'other' ? 'Other' : id.toUpperCase()}</button>)}</div>
        <p className="cluster-pan-hint">Swipe the floor map to explore every workstation.</p>
        {loading && !snapshot ? <div className="cluster-loading" role="status">Loading campus workstation data…</div> : layout ? <FloorPlan seats={shown} campusId={campusId} width={layout.width} height={layout.height} zoom={zoom} setZoom={setZoom} selectedId={selectedId} findEmpty={false} onSelect={selectSeat}/> : <WorkstationDirectory seats={shown} campusId={campusId} selectedId={selectedId} findEmpty={false} onSelect={selectSeat}/>}
        {!loading && !shown.length && <div className="cluster-empty-state"><CircleHelp size={26}/><strong>No matching workstations</strong><p>Try another cluster or workstation ID.</p></div>}
      </section>
      <aside className="cluster-intra-side" aria-label="Live cluster activity">
        <section className="cluster-intra-totals" aria-label="Cluster totals">{clusters.map((id) => { const group = seats.filter((seat) => seat.clusterId === id), occupied = group.filter((seat) => seat.state === 'occupied').length; return <button key={id} type="button" className={clusterId === id ? 'active' : undefined} onClick={() => { setClusterId(id); setSelectedId(null); }}><span>{id.toUpperCase()}</span><strong>{occupied} live</strong><small>{group.length} observed posts</small></button>; })}</section>
        {selected && <WorkstationDetails seat={selected} onClose={() => setSelectedId(null)}/>}
        <section className="cluster-live"><h2>Live</h2>{live.length ? <ol>{live.map((seat) => <li key={seat.id}><button type="button" onClick={() => selectSeat(seat)}><Avatar login={seat.occupant!.login} name={seat.occupant!.displayName} src={seat.occupant!.avatar} size={42}/><span><strong>{seat.occupant!.login}</strong><small>logged on · {timeAgo(seat.occupant!.since)}</small></span><b>{seat.id}</b></button></li>)}</ol> : <p>Nobody is logged on to an observed workstation.</p>}</section>
        <footer className="cluster-intra-status"><span className={`cluster-refresh-dot${snapshot && !expired && snapshot.fresh ? '' : ' stale'}`}/>{lastUpdated}<small>Refreshes every minute</small></footer>
      </aside>
    </div>
  </section></main>;
}

function CampusSelector({ campuses, selected, onChange }: { campuses: Campus[]; selected: number; onChange: (id: number) => void }) {
  return <label className="cluster-field"><span>Campus</span><select className="input" value={selected} onChange={(event) => onChange(Number(event.target.value))}>{campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>;
}
function WorkstationSearch({ query, onChange, onSubmit }: { query: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return <form className="cluster-search cluster-field" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><label htmlFor="cluster-host-search">Workstation ID</label><div><Search size={17}/><input id="cluster-host-search" className="input" value={query} onChange={(event) => onChange(event.target.value)} placeholder="e1r3p12" maxLength={32}/></div></form>;
}
function RefreshIndicator({ loading, lastUpdated, age, stale, onRefresh }: { loading: boolean; lastUpdated: string; age: number | null; stale: boolean; onRefresh: () => void }) {
  return <div className="cluster-refresh"><span className={`cluster-refresh-dot${stale ? ' stale' : ''}`}/><span>{stale ? 'Unknown or stale' : age === null ? 'Loading' : age < 1 ? 'Updated recently' : `Updated ${age}m ago`}<small>{lastUpdated}</small></span><button className="cluster-icon-button" type="button" aria-label="Refresh occupancy" title="Refresh occupancy" onClick={onRefresh} disabled={loading}><RefreshCw size={17} className={loading ? 'spinning' : ''}/></button></div>;
}
function OccupancySummary({ title, subtitle, counts }: { title: string; subtitle: string; counts: { occupied: number; available: number; unknown: number } }) {
  return <section className="panel cluster-side-card"><span className="eyebrow">{subtitle}</span><h3>{title}</h3><div className="cluster-stats"><div><strong>{counts.occupied}</strong><span>Occupied</span></div><div><strong>{counts.available}</strong><span>Verified empty</span></div><div><strong>{counts.unknown}</strong><span>Unknown</span></div></div></section>;
}
function AvailabilityLegend() {
  return <div className="cluster-legend" aria-label="Workstation states"><span><i className="occupied"/>Occupied</span><span><i className="available"/>Verified available</span><span><i className="unknown"/>Unknown</span></div>;
}
function WorkstationSeat({ seat, campusId, selected, findEmpty, onSelect }: { seat: Workstation; campusId: number; selected: boolean; findEmpty: boolean; onSelect: (seat: Workstation) => void }) {
  const person = seat.occupant;
  return <button id={`seat-${campusId}-${seat.id}`} type="button" className={`cluster-seat ${seat.state}${person ? ' has-occupant' : ''}${selected ? ' selected' : ''}${findEmpty && seat.state !== 'available' ? ' dimmed' : ''}`} onClick={() => onSelect(seat)} aria-pressed={selected} aria-label={`Workstation ${seat.id}, ${person ? `occupied by ${person.login}` : seat.enabled ? seat.state : 'disabled'}`} title={person ? `${person.login} · ${seat.id}` : seat.id}>{person ? <Avatar login={person.login} name={person.displayName} src={person.avatar} size={42}/> : <><Monitor size={16}/><span>{seat.position ? `P${seat.position}` : seat.id}</span></>}</button>;
}
function WorkstationDirectory({ seats, campusId, selectedId, findEmpty, onSelect }: { seats: Workstation[]; campusId: number; selectedId: string | null; findEmpty: boolean; onSelect: (seat: Workstation) => void }) {
  const groups = [...new Set(seats.map((seat) => seat.clusterId))];
  return <div className="cluster-directory">{groups.map((id) => {
    const grouped = seats.filter((seat) => seat.clusterId === id);
    const rows = [...new Set(grouped.map((seat) => seat.row).filter((row): row is number => row !== undefined))].sort((a, b) => b - a);
    const loose = grouped.filter((seat) => seat.row === undefined);
    const positions = Math.max(1, ...grouped.map((seat) => seat.position ?? 1));
    return <section key={id} className="cluster-directory-group"><h3><LayoutGrid size={17}/>{id === 'other' ? 'Other hosts' : id.toUpperCase()}<span>{grouped.length} hosts · {rows.length} rows</span></h3><div className="cluster-topology"><span className="cluster-watermark" aria-hidden="true">{id.toUpperCase()}</span>
      {rows.map((row) => <div key={row} className="cluster-row"><div className="cluster-seat-line" style={{ '--cluster-columns': positions } as React.CSSProperties}>{grouped.filter((seat) => seat.row === row).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((seat) => <span key={seat.id} style={{ gridColumn: seat.position }}><WorkstationSeat seat={seat} campusId={campusId} selected={selectedId === seat.id} findEmpty={findEmpty} onSelect={onSelect}/></span>)}</div><strong>R{row}</strong></div>)}
      {!!loose.length && <div className="cluster-row"><div className="cluster-seat-grid">{loose.map((seat) => <WorkstationSeat key={seat.id} seat={seat} campusId={campusId} selected={selectedId === seat.id} findEmpty={findEmpty} onSelect={onSelect}/>)}</div><strong>Observed</strong></div>}
    </div></section>;
  })}</div>;
}
function FloorPlan({ seats, campusId, width, height, zoom, setZoom, selectedId, findEmpty, onSelect }: { seats: Workstation[]; campusId: number; width: number; height: number; zoom: number; setZoom: (value: number) => void; selectedId: string | null; findEmpty: boolean; onSelect: (seat: Workstation) => void }) {
  return <div className="cluster-floor-shell"><div className="cluster-zoom"><button type="button" aria-label="Zoom out" onClick={() => setZoom(Math.max(.6, zoom - .2))}><ZoomOut size={17}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => setZoom(Math.min(2, zoom + .2))}><ZoomIn size={17}/></button></div><div className="cluster-floor-scroll"><div className="cluster-floor" style={{ width: width * zoom, height: height * zoom }}>{seats.map((seat) => <div key={seat.id} style={{ position: 'absolute', left: (seat.x ?? 0) * zoom, top: (seat.y ?? 0) * zoom, transform: `rotate(${seat.rotation ?? 0}deg)` }}><WorkstationSeat seat={seat} campusId={campusId} selected={selectedId === seat.id} findEmpty={findEmpty} onSelect={onSelect}/></div>)}</div></div></div>;
}
function WorkstationDetails({ seat, onClose }: { seat: Workstation; onClose: () => void }) {
  return <section className="panel cluster-side-card cluster-details" aria-label="Workstation details"><button className="cluster-detail-close" type="button" onClick={onClose} aria-label="Close workstation details">×</button><h3>{seat.id}</h3><p><MapPin size={15}/> {seat.clusterId === 'other' ? 'Other host' : seat.clusterId.toUpperCase()}{seat.row !== undefined ? ` · Row ${seat.row}` : ''}{seat.position !== undefined ? ` · Seat ${seat.position}` : ''}{seat.roomLabel ? ` · ${seat.roomLabel}` : ''}</p>{seat.occupant && <div className="cluster-occupant"><Avatar login={seat.occupant.login} name={seat.occupant.displayName} src={seat.occupant.avatar} size={46}/><div><strong>{seat.occupant.login}</strong><span>{seat.occupant.displayName ?? '1337 student'}</span></div></div>}<span className={`cluster-state-pill ${seat.state}`}>{seat.enabled ? seat.state : 'Disabled'}</span><p>{seat.state === 'available' ? 'Enabled workstation with no active session in a complete, fresh snapshot.' : seat.state === 'occupied' ? `${seat.occupant?.login ?? 'A student'} has an active session on this workstation.` : 'Availability cannot be verified for this workstation.'}</p></section>;
}
