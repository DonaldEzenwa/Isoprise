import { NextResponse } from 'next/server';
import { getIntegrationStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getIntegrationStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
