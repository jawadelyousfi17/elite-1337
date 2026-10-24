'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="shell empty"><h1>Rankings are temporarily unavailable</h1><p className="muted">Please try again shortly.</p><button className="btn" onClick={reset}>Try again</button></main>; }
