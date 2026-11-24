import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const supabase = createSupabaseServerClient();
  if (!code || !supabase) {
    return new Response(null, { status: 303, headers: { Location: '/login?error=callback' } });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return new Response(null, { status: 303, headers: { Location: '/login?error=callback' } });
  }
  return new Response(null, { status: 303, headers: { Location: '/overview' } });
}
