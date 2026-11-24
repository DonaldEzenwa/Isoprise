'use client';

import { createBrowserClient } from '@supabase/ssr';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;
type PublicSupabaseConfig = { url?: unknown; anonKey?: unknown };

let client: BrowserSupabaseClient | null = null;
let pendingClient: Promise<BrowserSupabaseClient> | null = null;

export function createBrowserSupabase(): Promise<BrowserSupabaseClient> {
  if (client) return Promise.resolve(client);
  if (!pendingClient) {
    pendingClient = fetch('/api/client-config', { cache: 'no-store' })
      .then(async (response) => {
        const config = (await response.json().catch(() => null)) as PublicSupabaseConfig | null;
        if (!response.ok || typeof config?.url !== 'string' || typeof config.anonKey !== 'string') {
          throw new Error('Supabase public configuration is unavailable.');
        }
        const parsedUrl = new URL(config.url);
        if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
          throw new Error('Supabase public configuration is invalid.');
        }
        client = createBrowserClient(config.url, config.anonKey, {
          cookieOptions: { sameSite: 'none', secure: true, path: '/' },
        });
        return client;
      })
      .catch((error: unknown) => {
        pendingClient = null;
        throw error;
      });
  }
  return pendingClient;
}
