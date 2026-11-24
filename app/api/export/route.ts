import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';
const tables = ['profiles','assessments','documents','certificates','projects','experiences','professional_profiles','generated_cvs','cover_letters','saved_items','application_tracker','assistant_conversations'] as const;

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const queries = await Promise.all(tables.map(async (table) => {
    const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
    const { data, error } = await supabase.from(table).select('*').eq(ownerColumn, user.id);
    return { table, data, error };
  }));
  const failed = queries.find((query) => query.error);
  if (failed) return NextResponse.json({ error: 'Data export is unavailable until the Supabase schema is applied and reachable.' }, { status: 503 });
  const payload = { exported_at: new Date().toISOString(), account_id: user.id, records: Object.fromEntries(queries.map((query) => [query.table, query.data || []])) };
  return new NextResponse(JSON.stringify(payload, null, 2), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="isoprise-data-export.json"', 'Cache-Control': 'private, no-store' } });
}
