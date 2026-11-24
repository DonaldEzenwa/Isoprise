import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { isExpiredOpportunity, isOfficialDomainMatch, officialPageListsPortal, parseHttpUrl } from '@/lib/verification/rules';

export const dynamic = 'force-dynamic';
const tables = ['scholarships_cache', 'jobs_cache', 'learning_resources_cache'] as const;
const types = { scholarships_cache: 'scholarship', jobs_cache: 'job', learning_resources_cache: 'learning' } as const;

async function readBoundedPage(url: URL) {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(7000), headers: { Accept: 'text/html' } });
  if (!response.ok || !response.body) return '';
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '';
  while (text.length < 1_000_000) {
    const { done, value } = await reader.read(); if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length >= 1_000_000) { await reader.cancel(); break; }
  }
  return text.slice(0, 1_000_000);
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data: admin, error: adminError } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (adminError) return NextResponse.json({ error: 'Administrator authorization is unavailable.' }, { status: 503 });
  if (admin?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'A valid cached opportunity id is required.' }, { status: 400 });
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: 'Server verification is not configured.' }, { status: 503 });

  let found: { table: typeof tables[number]; type: string; item: Record<string, unknown> } | null = null;
  for (const table of tables) {
    const { data, error } = await service.from(table).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: 'Opportunity verification storage is unavailable. Apply the Supabase migration.' }, { status: 503 });
    if (data) { found = { table, type: types[table], item: data as Record<string, unknown> }; break; }
  }
  if (!found) return NextResponse.json({ error: 'Cached opportunity not found.' }, { status: 404 });
  const item = found.item;
  const now = new Date();
  let status: 'verified' | 'pending' | 'expired' = 'pending';
  let method: string | null = null;
  if (isExpiredOpportunity({ close_date: String(item.close_date || ''), created_at: String(item.created_at || ''), title: String(item.title || ''), description: String(item.description || '') }, now)) {
    status = 'expired'; method = 'official_deadline_or_closed_age';
  } else if (isOfficialDomainMatch(String(item.application_url || item.url || ''), String(item.official_domain || ''))) {
    status = 'verified'; method = 'official_domain_match';
  } else {
    const source = parseHttpUrl(String(item.official_source_url || ''));
    const officialDomain = String(item.official_domain || '');
    const authorized = parseHttpUrl(String(item.authorized_portal_url || item.application_url || item.url || ''));
    if (source && authorized && isOfficialDomainMatch(source.href, officialDomain)) {
      try {
        const html = await readBoundedPage(source);
        if (officialPageListsPortal(html, authorized.href)) { status = 'verified'; method = 'authorized_portal_list'; }
      } catch {
        status = 'pending';
      }
    }
  }

  const verifiedAt = status === 'verified' ? now.toISOString() : null;
  const { error: updateError } = await service.from(found.table).update({ verification_status: status, verification_method: method, verified_by: status === 'verified' ? user.id : null, last_verified_at: verifiedAt }).eq('id', id);
  if (updateError) return NextResponse.json({ error: 'Verification result could not be saved.' }, { status: 503 });
  const { error: queueError } = await service.from('verification_queue').upsert({ opportunity_type: found.type, opportunity_id: id, current_status: status, official_domain: item.official_domain || null, submitted_url: item.application_url || item.url || null, official_source_url: item.official_source_url || null, authorized_portal_url: item.authorized_portal_url || null, verification_method: method, last_checked_at: now.toISOString() }, { onConflict: 'opportunity_type,opportunity_id' });
  if (queueError) return NextResponse.json({ error: 'Verification status was updated, but the admin queue could not be refreshed.' }, { status: 503 });
  return NextResponse.json({ id, verification_status: status, verification_method: method, last_verified_at: verifiedAt, official_source_url: item.official_source_url || null });
}
