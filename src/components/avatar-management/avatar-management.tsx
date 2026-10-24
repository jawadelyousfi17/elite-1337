'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/avatar';

export function AvatarManagement({ userId, login, initialSrc, configured }: { userId: number; login: string; initialSrc: string | null; configured: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(initialSrc);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => setSrc(initialSrc), [initialSrc]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file || busy) return;
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.set('image', file);
      const response = await fetch('/api/avatars', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Upload failed.');
      setSrc(result.src); setFile(null); if (input.current) input.current.value = ''; setMessage('Avatar saved.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/avatars', { method: 'DELETE' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? 'Removal failed.'); }
      setSrc(null); setFile(null); if (input.current) input.current.value = ''; setMessage('Avatar removed.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Removal failed.'); }
    finally { setBusy(false); }
  }

  return <section className="panel avatar-management" aria-labelledby="avatar-management-title">
    <div className="avatar-management-preview">{preview ? <img src={preview} alt="Selected avatar preview" width={72} height={72}/> : <Avatar login={login} src={src} size={72}/>}</div>
    <div className="avatar-management-body"><h2 id="avatar-management-title">Your avatar</h2><p className="muted">JPEG, PNG or WebP · up to 4 MB</p>
      {configured ? <><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Choose an avatar image" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(''); }}/><div className="avatar-management-actions"><button type="button" className="btn" disabled={!file || busy} onClick={upload}>{busy ? 'Saving…' : src ? 'Replace avatar' : 'Upload avatar'}</button>{src && <button type="button" className="btn btn-subtle" disabled={busy} onClick={remove}>Remove avatar</button>}</div></> : <p className="muted">Avatar storage is not configured yet.</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </section>;
}
