import 'next-auth';
declare module 'next-auth' {
  interface User { login?: string }
  interface Session { user: { id: string; login: string; name?: string | null; email?: string | null; image?: string | null } }
}
