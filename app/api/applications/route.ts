import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';
const statuses = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'];

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data, error } = await supabase.from('application_tracker').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Application tracker is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const role_or_title = typeof body?.role_or_title === 'string' ? body.role_or_title.trim().slice(0, 160) : '';
  const company_or_org = typeof body?.company_or_org === 'string' ? body.company_or_org.trim().slice(0, 160) : null;
  const item_type = typeof body?.item_type === 'string' ? body.item_type.slice(0, 40) : null;
  const item_id = typeof body?.item_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.item_id) ? body.item_id : null;
  if (!role_or_title) return NextResponse.json({ error: 'Role, programme or opportunity title is required.' }, { status: 400 });
  const { data, error } = await supabase.from('application_tracker').insert({ user_id: user.id, role_or_title, company_or_org, item_type, item_id, status: 'saved' }).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Application could not be saved.' }, { status: 503 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.includes(status)) return NextResponse.json({ error: 'A valid item id and status are required.' }, { status: 400 });
  const patch: Record<string, unknown> = { status };
  if (typeof body?.notes === 'string') patch.notes = body.notes.slice(0, 2000);
  if (typeof body?.next_action === 'string') patch.next_action = body.next_action.slice(0, 500);
  if (status === 'applied') patch.applied_at = typeof body?.applied_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.applied_at) ? body.applied_at : new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('application_tracker').update(patch).eq('id', id).eq('user_id', user.id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: 'Application status could not be updated.' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'Application record not found.' }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Application id is required.' }, { status: 400 });
  const { error, count } = await supabase.from('application_tracker').delete({ count: 'exact' }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Application could not be removed.' }, { status: 503 });
  if (!count) return NextResponse.json({ error: 'Application record not found.' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
