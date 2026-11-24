import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data: admin, error: adminError } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (adminError) return NextResponse.json({ error: 'Apply the admin schema migration before using the verification queue.' }, { status: 503 });
  if (admin?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const { data, error } = await supabase.from('verification_queue').select('*').eq('current_status', 'pending').order('last_checked_at', { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: 'Verification queue is unavailable.' }, { status: 503 });
  return NextResponse.json({ items: data || [] });
}
