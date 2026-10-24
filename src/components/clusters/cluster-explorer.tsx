'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Clock3, LayoutGrid, MapPin, Monitor, RefreshCw, Search, ZoomIn, ZoomOut } from '@/components/icons';
import { layoutFor } from '@/lib/cluster-layout';
import { searchWorkstations, type ClusterSnapshot, type Workstation } from '@/lib/cluster-core';

type Campus = { id: number; name: string };
const collator = new Intl.Collator('en', { numeric: true });

export function ClusterExplorer({ campuses, initialCampus }: { campuses: Campus[]; initialCampus: number }) {
  const [campusId, setCampusId] = useState(initialCampus);
  const [clusterId, setClusterId] = useState('all');
  const [snapshot, setSnapshot] = useState<ClusterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [findEmpty, setFindEmpty] = useState(false);
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
  const campusName = campuses.find((campus) => campus.id === campusId)?.name ?? 'Campus';
  const clusterSeats = clusterId === 'all' ? seats : seats.filter((seat) => seat.clusterId === clusterId);
  const shown = searchWorkstations(clusterSeats, query);
  const searchResults = query.trim() ? searchWorkstations(seats, query) : [];
  const selected = seats.find((seat) => seat.id === selectedId) ?? null;
  const count = (items: Workstation[]) => ({ occupied: items.filter((seat) => seat.state === 'occupied' && seat.enabled).length, available: items.filter((seat) => seat.state === 'available' && seat.enabled).length, unknown: items.filter((seat) => seat.state === 'unknown' && seat.enabled).length });
  const campusCount = count(seats), clusterCount = count(clusterSeats);
  const layout = clusterId === 'all' ? null : layoutFor(campusId, clusterId);
  const lastUpdated = snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'No successful update';
  const age = snapshot?.fetchedAt && now ? Math.max(0, Math.floor((now - Date.parse(snapshot.fetchedAt)) / 60_000)) : null;
  const selectSeat = (seat: Workstation) => {
    setClusterId(seat.clusterId);
    setSelectedId(seat.id);
    window.setTimeout(() => document.getElementById(`seat-${campusId}-${seat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 30);
  };

  return <main className="shell clusters-page">
    <header className="clusters-intro"><div><h1>Cluster Explorer<span className="green">.</span></h1></div><div className="cluster-intro-badge"><Monitor size={19}/><span>Anonymous occupancy</span></div></header>
    <section className="panel cluster-toolbar" aria-label="Cluster controls">
      <CampusSelector campuses={campuses} selected={campusId} onChange={setCampusId}/>
      <label className="cluster-field"><span>Cluster</span><select className="input" value={clusterId} onChange={(event) => { setClusterId(event.target.value); setSelectedId(null); }}><option value="all">All observed groups</option>{clusters.map((id) => <option key={id} value={id}>{id === 'other' ? 'Other hosts' : id.toUpperCase()}</option>)}</select></label>
      <WorkstationSearch query={query} onChange={setQuery} onSubmit={() => { if (searchResults[0]) selectSeat(searchResults[0]); }}/>
      <button className={`btn cluster-empty-button${findEmpty ? ' active' : ''}`} type="button" aria-pressed={findEmpty} onClick={() => setFindEmpty((value) => !value)}><Monitor size={17}/> Find Empty Seats</button>
      <RefreshIndicator loading={loading} lastUpdated={lastUpdated} age={age} stale={snapshot ? expired || !snapshot.fresh : !!problem} onRefresh={() => void refresh(campusId)}/>
    </section>

    <div className="clusters-layout">
      <section className="panel cluster-main" aria-label="Workstation directory or floor plan">
        <div className="cluster-main-head"><div><span className="eyebrow">{campusName} / {clusterId === 'all' ? 'all groups' : clusterId.toUpperCase()}</span><h2>{layout ? 'Verified floor plan' : 'Workstation directory'}</h2><p>{layout ? 'Drag or scroll to pan; use zoom controls to inspect seats.' : 'Hosts seen in recent campus sessions. No verified floor plan yet.'}</p></div><span className="cluster-count">{shown.length} shown</span></div>
        {problem && <div className="cluster-notice danger" role="alert">{problem}</div>}
        {snapshot?.notice && <div className="cluster-notice" role="status">{snapshot.notice}</div>}
        {expired && <div className="cluster-notice" role="status">The last snapshot is stale. States are shown as unknown until refresh succeeds.</div>}
        {findEmpty && campusCount.available === 0 && <div className="cluster-notice" role="status">No verified available seats are known. The 42 location API does not provide an enabled-seat inventory, so unoccupied observed hosts remain unknown.</div>}
        <AvailabilityLegend/>
        {loading && !snapshot ? <div className="cluster-loading" role="status">Loading campus workstation data…</div> : layout ? <FloorPlan seats={shown} campusId={campusId} width={layout.width} height={layout.height} zoom={zoom} setZoom={setZoom} selectedId={selectedId} findEmpty={findEmpty} onSelect={selectSeat}/> : <WorkstationDirectory seats={shown} campusId={campusId} selectedId={selectedId} findEmpty={findEmpty} onSelect={selectSeat}/>}
        {!loading && !shown.length && <div className="cluster-empty-state"><CircleHelp size={26}/><strong>No matching workstations</strong><p>Try another group or workstation ID. The directory contains only recently observed hosts.</p></div>}
      </section>
      <aside className="cluster-sidebar" aria-label="Occupancy details">
        <OccupancySummary title={campusName} subtitle="Campus · observed hosts" counts={campusCount}/>
        <OccupancySummary title={clusterId === 'all' ? 'All groups' : clusterId.toUpperCase()} subtitle="Selected view" counts={clusterCount}/>
        <section className="panel cluster-side-card"><h3>Search results</h3>{query.trim() ? <>{searchResults.length ? <div className="cluster-search-results">{searchResults.slice(0, 12).map((seat) => <button key={seat.id} type="button" onClick={() => selectSeat(seat)}><span>{seat.id}</span><small>{seat.clusterId} · {seat.state}</small></button>)}</div> : <p>No observed workstation matches “{query}”.</p>}</> : <p>Search a workstation ID to highlight it and inspect its state.</p>}</section>
        <section className="panel cluster-side-card"><h3>Data status</h3><p><Clock3 size={15}/> {lastUpdated}</p><p>{snapshot?.complete && !expired ? 'Complete active-location pages for this campus' : 'Availability cannot be established right now'}</p><p>Automatic checks every 60 seconds while this page is visible. 42 data is cached for up to 3 minutes.</p></section>
        {selected && <WorkstationDetails seat={selected} onClose={() => setSelectedId(null)}/>}
      </aside>
    </div>
  </main>;
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
  return <button id={`seat-${campusId}-${seat.id}`} type="button" className={`cluster-seat ${seat.state}${selected ? ' selected' : ''}${findEmpty && seat.state !== 'available' ? ' dimmed' : ''}`} onClick={() => onSelect(seat)} aria-pressed={selected} aria-label={`Workstation ${seat.id}, ${seat.enabled ? seat.state : 'disabled'}`}><Monitor size={16}/><span>{seat.id}</span></button>;
}
function WorkstationDirectory({ seats, campusId, selectedId, findEmpty, onSelect }: { seats: Workstation[]; campusId: number; selectedId: string | null; findEmpty: boolean; onSelect: (seat: Workstation) => void }) {
  const groups = [...new Set(seats.map((seat) => seat.clusterId))];
  return <div className="cluster-directory">{groups.map((id) => <section key={id} className="cluster-directory-group"><h3><LayoutGrid size={17}/>{id === 'other' ? 'Other hosts' : id.toUpperCase()}<span>{seats.filter((seat) => seat.clusterId === id).length} hosts</span></h3><div className="cluster-seat-grid">{seats.filter((seat) => seat.clusterId === id).map((seat) => <WorkstationSeat key={seat.id} seat={seat} campusId={campusId} selected={selectedId === seat.id} findEmpty={findEmpty} onSelect={onSelect}/>)}</div></section>)}</div>;
}
function FloorPlan({ seats, campusId, width, height, zoom, setZoom, selectedId, findEmpty, onSelect }: { seats: Workstation[]; campusId: number; width: number; height: number; zoom: number; setZoom: (value: number) => void; selectedId: string | null; findEmpty: boolean; onSelect: (seat: Workstation) => void }) {
  return <div className="cluster-floor-shell"><div className="cluster-zoom"><button type="button" aria-label="Zoom out" onClick={() => setZoom(Math.max(.6, zoom - .2))}><ZoomOut size={17}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => setZoom(Math.min(2, zoom + .2))}><ZoomIn size={17}/></button></div><div className="cluster-floor-scroll"><div className="cluster-floor" style={{ width: width * zoom, height: height * zoom }}>{seats.map((seat) => <div key={seat.id} style={{ position: 'absolute', left: (seat.x ?? 0) * zoom, top: (seat.y ?? 0) * zoom, transform: `rotate(${seat.rotation ?? 0}deg)` }}><WorkstationSeat seat={seat} campusId={campusId} selected={selectedId === seat.id} findEmpty={findEmpty} onSelect={onSelect}/></div>)}</div></div></div>;
}
function WorkstationDetails({ seat, onClose }: { seat: Workstation; onClose: () => void }) {
  return <section className="panel cluster-side-card cluster-details" aria-label="Workstation details"><button className="cluster-detail-close" type="button" onClick={onClose} aria-label="Close workstation details">×</button><h3>{seat.id}</h3><p><MapPin size={15}/> {seat.clusterId === 'other' ? 'Other host' : seat.clusterId.toUpperCase()}{seat.roomLabel ? ` · ${seat.roomLabel}` : ''}</p><span className={`cluster-state-pill ${seat.state}`}>{seat.enabled ? seat.state : 'Disabled'}</span><p>{seat.state === 'available' ? 'Enabled workstation with no active session in a complete, fresh snapshot.' : seat.state === 'occupied' ? 'An active session was reported for this host. Student identity is hidden.' : 'Availability cannot be verified for this workstation.'}</p></section>;
}
