import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';
const types = ['scholarship', 'job', 'learning', 'cv'];

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data, error } = await supabase.from('saved_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Saved items are unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const item_type = String(body?.item_type || ''); const item_id = String(body?.item_id || '');
  if (!types.includes(item_type) || !/^[0-9a-f-]{36}$/i.test(item_id)) return NextResponse.json({ error: 'A valid item type and identifier are required.' }, { status: 400 });
  const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 1200) : null;
  const { data, error } = await supabase.from('saved_items').upsert({ user_id: user.id, item_type, item_id, notes }, { onConflict: 'user_id,item_type,item_id' }).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Item could not be saved. Apply the Supabase schema migration.' }, { status: 503 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Saved item id is required.' }, { status: 400 });
  const { error } = await supabase.from('saved_items').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Saved item could not be removed.' }, { status: 503 });
  return NextResponse.json({ deleted: true });
}
