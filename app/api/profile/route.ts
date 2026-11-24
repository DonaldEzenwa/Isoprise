import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';
const levels = ['beginner', 'intermediate', 'advanced'];

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ profile: null, schema_ready: false, error: 'Apply the Supabase schema migration to enable profile storage.' }, { status: 503 });
  const { data: professionalProfile } = await supabase.from('professional_profiles').select('id').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ profile: data, professional_profile_id: professionalProfile?.id || null, schema_ready: true });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({ error: 'Invalid profile payload.' }, { status: 400 });
  const body = input as Record<string, unknown>;
  if (body.career_level && !levels.includes(String(body.career_level))) return NextResponse.json({ error: 'Career level must be beginner, intermediate or advanced.' }, { status: 400 });
  const trimmed = (key: string, limit: number, fallback: string | null = null) => typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, limit) || fallback : fallback;
  const profile = {
    id: user.id,
    full_name: trimmed('full_name', 120),
    career_interest: trimmed('career_interest', 120),
    career_level: body.career_level ? String(body.career_level) : 'beginner',
    career_goal: trimmed('career_goal', 1200),
    location: trimmed('location', 120, 'Nigeria'),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' }).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Profile could not be saved. Confirm the Supabase schema is applied.' }, { status: 503 });
  const { data: professionalProfile } = await supabase.from('professional_profiles').select('id').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ profile: data, professional_profile_id: professionalProfile?.id || null });
}
