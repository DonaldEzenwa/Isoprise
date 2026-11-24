import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const runtimeEnv = (name: string) => process.env[name]?.trim();

export function createSupabaseServerClient() {
  const url = runtimeEnv(['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_'));
  const anonKey = runtimeEnv(['NEXT', 'PUBLIC', 'SUPABASE', 'ANON', 'KEY'].join('_'));
  if (!url || !anonKey) return null;

  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookieOptions: { sameSite: 'none', secure: true, path: '/' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, sameSite: 'none', secure: true });
          });
        } catch {
          // Server components may not mutate cookies; route handlers can refresh sessions.
        }
      },
    },
  });
}
