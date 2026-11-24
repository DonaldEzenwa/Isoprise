import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.document_ids) ? [...new Set(body.document_ids.filter((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))] as string[] : [];
  const profile = body?.profile_intelligence;
  if (ids.length < 1 || ids.length > 5 || !profile || typeof profile !== 'object' || Array.isArray(profile)) return NextResponse.json({ error: 'Valid source documents and a reviewed profile object are required.' }, { status: 400 });
  const { data: docs, error: docsError } = await supabase.from('documents').select('id,file_name').in('id', ids).eq('user_id', user.id);
  if (docsError || !docs || docs.length !== ids.length) return NextResponse.json({ error: 'One or more source documents are not owned by this account.' }, { status: 403 });
  const allowedSources = new Set(docs.map((doc) => doc.file_name));
  const sanitizeSources = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 80).map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const row = { ...(item as Record<string, unknown>) };
      if ('source_doc' in row && typeof row.source_doc === 'string' && !allowedSources.has(row.source_doc)) row.source_doc = null;
      return row;
    });
  };
  const qualifications = sanitizeSources(profile.qualifications);
  const projects = sanitizeSources(profile.projects);
  const achievements = sanitizeSources(profile.achievements);
  const transferable = sanitizeSources(profile.transferable_skills);
  const missing = Array.isArray(profile.missing_info) ? profile.missing_info.filter((item: unknown) => typeof item === 'string').slice(0, 40) : [];
  const merged = {
    user_id: user.id,
    merged_from_document_ids: ids,
    summary: typeof profile.summary === 'string' ? profile.summary.slice(0, 2000) : '',
    qualifications,
    skills: profile.skills && typeof profile.skills === 'object' ? profile.skills : {},
    transferable_skills: transferable,
    missing_info: missing,
    achievements: { projects, achievements },
    completeness_score: Math.max(0, Math.min(100, Number(profile.completeness_score) || 0)),
    last_merged_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('professional_profiles').upsert(merged, { onConflict: 'user_id' }).select('id,user_id,last_merged_at').single();
  if (error || !data) return NextResponse.json({ error: 'Profile Intelligence could not be saved. Confirm the migration and review input.' }, { status: 503 });
  return NextResponse.json({ professional_profile: data, message: 'Profile Intelligence merged after user confirmation.' });
}
