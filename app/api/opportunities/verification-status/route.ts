import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { parseHttpUrl } from '@/lib/verification/rules';
import { isExpiredOpportunity } from '@/lib/verification/rules';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, response } = await getUserOrResponse();
  if (response || !supabase) return response;
  const urlValue = new URL(request.url).searchParams.get('url');
  const target = parseHttpUrl(urlValue);
  if (!target) return NextResponse.json({ error: 'A valid public HTTP(S) URL is required.' }, { status: 400 });
  const queries = await Promise.all([
    supabase.from('scholarships_cache').select('id,title,application_url,authorized_portal_url,official_source_url,official_domain,verification_method,verification_status,last_verified_at,close_date,created_at,description').eq('application_url', target.href).limit(1),
    supabase.from('jobs_cache').select('id,title,application_url,authorized_portal_url,official_source_url,official_domain,verification_method,verification_status,last_verified_at,close_date,created_at,description').eq('application_url', target.href).limit(1),
    supabase.from('learning_resources_cache').select('id,title,url,authorized_portal_url,official_source_url,official_domain,verification_method,verification_status,last_verified_at,open_date,close_date,created_at').eq('url', target.href).limit(1),
  ]);
  const failed = queries.find((query) => query.error);
  if (failed) return NextResponse.json({ error: 'Verification status storage is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  const record = queries[0].data?.[0] || queries[1].data?.[0] || queries[2].data?.[0];
  if (!record) return NextResponse.json({ verification_status: 'pending', matched: false });
  const expired = isExpiredOpportunity({ close_date: 'close_date' in record ? String(record.close_date || '') : null, created_at: 'created_at' in record ? String(record.created_at || '') : null, title: 'title' in record ? String(record.title || '') : null, description: 'description' in record ? String(record.description || '') : null });
  return NextResponse.json({ ...record, verification_status: expired ? 'expired' : record.verification_status, matched: true });
}
