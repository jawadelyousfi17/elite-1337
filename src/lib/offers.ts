/** Student offers. Terms change often: re-check each source before editing, and bump OFFERS_CHECKED. */
export const OFFERS_CHECKED = 'October 24, 2026';

export type Offer = {
  id: string; name: string; company: string; value: string; summary: string; cta: string;
  steps?: string[]; note?: string; card?: boolean; url: string; brand: string; logo: string; featured?: boolean;
};

export const OFFERS: Offer[] = [
  { id: 'github', name: 'GitHub Student Pack', company: 'GitHub', value: 'Free', featured: true,
    summary: 'Build your next project with Copilot and a pack of developer tools.',
    cta: 'Explore the pack',
    url: 'https://education.github.com/pack', brand: '#181717', logo: '/assets/offers/github-3d.webp' },
  { id: 'gemini', card: true, name: 'Google AI Plus', company: 'Google', value: '1 year free',
    summary: 'Study with Gemini and get more space for your files.',
    cta: 'View the student plan',
    url: 'https://gemini.google/students/', brand: '#8E75B2', logo: '/assets/offers/gemini-3d.webp' },
  { id: 'azure', name: 'Azure for Students', company: 'Microsoft', value: '$100 credit',
    summary: 'Put your projects in the cloud with 12 months of credit. No card needed.',
    cta: 'Start with Azure',
    url: 'https://azure.microsoft.com/free/students', brand: '#0078D4', logo: '/assets/offers/azure-3d.webp' },
  { id: 'jetbrains', name: 'JetBrains IDEs', company: 'JetBrains', value: 'Free',
    summary: 'Code, debug and build with CLion, IntelliJ, PyCharm and more.',
    cta: 'Get the student pack',
    url: 'https://www.jetbrains.com/community/education/#students', brand: '#000000', logo: '/assets/offers/jetbrains-3d.webp' },
  { id: 'namecom', card: true, name: 'Free domain', company: 'name.com', value: '1 year free',
    summary: 'Give your next project its own address with a .dev, .app or another eligible domain.',
    cta: 'Find your domain',
    url: 'https://www.name.com/partner/github-students', brand: '#1F6FEB', logo: '/assets/offers/namecom-3d.webp' },
  { id: 'youtube', card: true, name: 'YouTube Premium', company: 'YouTube', value: 'Student price',
    summary: 'Watch without ad breaks and keep your music playing with YouTube Music.',
    cta: 'View the student plan',
    url: 'https://www.youtube.com/premium/student', brand: '#FF0000', logo: '/assets/offers/youtube-3d.webp' },
  { id: 'spotify', card: true, name: 'Spotify Premium', company: 'Spotify', value: '23 MAD/month',
    summary: 'Keep your playlists going, ad-free and offline, at the student rate.',
    cta: 'View the student plan',
    url: 'https://www.spotify.com/student/', brand: '#1DB954', logo: '/assets/offers/spotify-3d.webp' },
];
