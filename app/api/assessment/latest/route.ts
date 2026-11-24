import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data, error } = await supabase.from('assessments').select('id,career_track,score,topic_breakdown,skill_gaps,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: 'Assessment history is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  return NextResponse.json({ assessment: data || null });
}
