import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { parseHttpUrl } from '@/lib/verification/rules';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
const validTypes = ['scholarship', 'job', 'learning'];

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const opportunity_type = String(body?.opportunity_type || '');
  const opportunity_id = String(body?.opportunity_id || '');
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1200) : '';
  const evidence = typeof body?.evidence_url === 'string' ? parseHttpUrl(body.evidence_url) : null;
  if (!validTypes.includes(opportunity_type) || !/^[0-9a-f-]{36}$/i.test(opportunity_id) || !reason) return NextResponse.json({ error: 'Provide an opportunity type, valid id and report reason.' }, { status: 400 });
  const { data, error } = await supabase.from('reported_opportunities').insert({ user_id: user.id, opportunity_type, opportunity_id, reason, evidence_url: evidence?.href || null }).select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Report could not be stored. Apply the Supabase schema migration.' }, { status: 503 });
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ report_id: data.id, status: 'open', queue_status: 'unavailable', message: 'Report saved, but the verification queue needs the server Supabase credential.' }, { status: 201 });
  const { error: queueError } = await service.from('verification_queue').upsert({ opportunity_type, opportunity_id, current_status: 'pending', submitted_url: evidence?.href || null, last_checked_at: new Date().toISOString(), notes: `Reported opportunity ${data.id}` }, { onConflict: 'opportunity_type,opportunity_id' });
  return NextResponse.json({ report_id: data.id, status: 'open', queue_status: queueError ? 'unavailable' : 'pending', ...(queueError ? { message: 'Report saved, but the admin verification queue could not be updated.' } : {}) }, { status: 201 });
}
