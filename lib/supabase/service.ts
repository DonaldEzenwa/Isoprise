import 'server-only';
import { createClient } from '@supabase/supabase-js';

const runtimeEnv = (name: string) => process.env[name]?.trim();

export function createSupabaseServiceClient() {
  const url = runtimeEnv(['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_'));
  const serviceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'isoprise-server' } },
  });
}
