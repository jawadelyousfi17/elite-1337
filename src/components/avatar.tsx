import React from 'react';
import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function safeAvatarSrc(src?: string | null) {
  return src?.startsWith('/api/avatars/') || src?.startsWith('/api/photos/') ? src : null;
}

export function Avatar({ login, src, size = 40, className }: { login: string; src?: string | null; size?: number; className?: string }) {
  const imageSrc = safeAvatarSrc(src);
  return <AvatarRoot className={cn('avatar', className)} style={{ width: size, height: size }} aria-label={`${login} avatar`}>
    {imageSrc && <AvatarImage src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" className="object-cover"/>}
    <AvatarFallback className="bg-transparent">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
  </AvatarRoot>;
}
