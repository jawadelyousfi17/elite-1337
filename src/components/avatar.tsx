'use client';

import React, { useState } from 'react';
import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function safeAvatarSrc(src?: string | null) {
  return src?.startsWith('/api/avatars/') || src?.startsWith('/api/photos/') ? src : null;
}

export function Avatar({ login, name, src, size = 40, className }: { login: string; name?: string | null; src?: string | null; size?: number; className?: string }) {
  const imageSrc = safeAvatarSrc(src);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(imageSrc ? 'loading' : 'error');
  const initials = Array.from((name?.trim() || login.trim()).toUpperCase()).slice(0, 2).join('');
  return <AvatarRoot className={cn('avatar', className)} style={{ width: size, height: size }} aria-label={`${login} avatar`}>
    {imageSrc && <AvatarImage src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" className="object-cover" onLoadingStatusChange={setStatus}/>}
    <AvatarFallback className={cn('avatar-fallback', imageSrc && status === 'loading' && 'is-loading')} style={{ fontSize: Math.round(size * 0.35) }}>
      <span aria-hidden="true">{initials}</span>
    </AvatarFallback>
  </AvatarRoot>;
}
