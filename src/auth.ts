import NextAuth from 'next-auth';
import type { OAuthConfig } from 'next-auth/providers';
import { z } from 'zod';

type FortyTwoProfile = Record<string, unknown>;
const identitySchema = z.object({ id: z.number().int().positive(), login: z.string().min(1) });
const provider: OAuthConfig<FortyTwoProfile> = {
  id: '42', name: '42 Intra', type: 'oauth',
  authorization: { url: 'https://api.intra.42.fr/oauth/authorize', params: { scope: 'public' } },
  token: {
    url: 'https://api.intra.42.fr/oauth/token',
    async conform(response: Response) {
      const contentType = response.headers.get('content-type');
      if (!contentType?.toLowerCase().startsWith('application/json')) {
        const reader = response.clone().body?.getReader();
        const firstChunk = await reader?.read();
        await reader?.cancel();
        const preview = firstChunk?.value ? new TextDecoder().decode(firstChunk.value.subarray(0, 4096)) : '';
        const htmlTitle = preview.match(/<title[^>]*>([^<]{1,100})<\/title>/i)?.[1]?.replace(/[\r\n]/g, ' ').trim() ?? 'none';
        const server = response.headers.get('server') ?? 'unknown';
        const ray = response.headers.get('cf-ray') ?? 'none';
        throw new Error(`42 OAuth token response was not JSON (status ${response.status}, content type ${contentType ?? 'missing'}, redirected ${response.redirected}, host ${response.url ? new URL(response.url).host : 'unknown'}, server ${server}, cf-ray ${ray}, html title ${htmlTitle})`);
      }
      return response;
    }
  },
  userinfo: 'https://api.intra.42.fr/v2/me',
  clientId: process.env.FORTYTWO_CLIENT_ID, clientSecret: process.env.FORTYTWO_CLIENT_SECRET,
  client: { token_endpoint_auth_method: 'client_secret_post' },
  checks: ['state'],
  profile(profile) {
    const user = identitySchema.parse(profile);
    return { id: String(user.id), name: user.login, email: null, image: null, login: user.login };
  }
};
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [provider], session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/', error: '/denied' },
  callbacks: {
    jwt({ token, user, account }) { if (user && account?.provider === '42') { token.fortyTwoId = account.providerAccountId; token.login = user.login; } return token; },
    session({ session, token }) { session.user.id = String(token.fortyTwoId); session.user.login = String(token.login); return session; }
  }
});
