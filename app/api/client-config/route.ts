import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const runtimeEnv = (name: string) => process.env[name]?.trim();
const noStore = { 'Cache-Control': 'no-store, private' };

export async function GET() {
  const url = runtimeEnv(['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_'));
  const anonKey = runtimeEnv(['NEXT', 'PUBLIC', 'SUPABASE', 'ANON', 'KEY'].join('_'));
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase public configuration is unavailable.' }, { status: 503, headers: noStore });
  }
  try {
    const parsedUrl = new URL(url);
    if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return NextResponse.json({ error: 'Supabase public configuration is invalid.' }, { status: 503, headers: noStore });
    }
  } catch {
    return NextResponse.json({ error: 'Supabase public configuration is invalid.' }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ url, anonKey }, { headers: noStore });
}
