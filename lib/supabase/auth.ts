import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './server';

export async function getUserOrResponse() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { user: null, supabase: null, response: NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 }) };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, supabase, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  return { user: data.user, supabase, response: null };
}
