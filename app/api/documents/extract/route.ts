import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { extractDocumentText } from '@/lib/documents/extract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const BUCKET = 'career-documents';

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.document_id === 'string' ? body.document_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
  const { data: document, error } = await supabase.from('documents').select('id,file_name,file_path,file_type').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Document database is unavailable.' }, { status: 503 });
  if (!document) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: 'Private storage server access is not configured.' }, { status: 503 });
  const { data: blob, error: downloadError } = await service.storage.from(BUCKET).download(document.file_path);
  if (downloadError || !blob) return NextResponse.json({ error: 'Private document could not be retrieved.' }, { status: 503 });
  try {
    const text = await extractDocumentText(Buffer.from(await blob.arrayBuffer()), document.file_type || '', document.file_name);
    const status = text ? 'extracted' : 'empty';
    const { error: updateError } = await supabase.from('documents').update({ extracted_text: text || null, extraction_status: status }).eq('id', id).eq('user_id', user.id);
    if (updateError) return NextResponse.json({ error: 'Extracted text could not be saved.' }, { status: 503 });
    return NextResponse.json({ document_id: id, extraction_status: status, character_count: text.length });
  } catch {
    await supabase.from('documents').update({ extraction_status: 'extraction_failed' }).eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ error: 'Document text extraction failed. Retry with a readable PDF, DOCX, PNG or JPEG.' }, { status: 422 });
  }
}
