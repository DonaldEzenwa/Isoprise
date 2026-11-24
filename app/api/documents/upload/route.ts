import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { extractDocumentText } from '@/lib/documents/extract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'career-documents';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowed: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const { data, error } = await supabase.from('documents').select('id,file_name,file_type,file_size,extraction_status,source_label,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
  if (error) return NextResponse.json({ error: 'Document storage is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  return NextResponse.json({ documents: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const form = await request.formData().catch(() => null);
  const files = form?.getAll('files').filter((value): value is File => value instanceof File) || [];
  if (files.length < 1 || files.length > 5) return NextResponse.json({ error: 'Upload between one and five files per request.' }, { status: 400 });
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: 'Apply the Supabase schema migration before uploading documents.' }, { status: 503 });
  if (!profile) return NextResponse.json({ error: 'Save your career profile before uploading documents.' }, { status: 409 });
  const { count, error: countError } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if (countError) return NextResponse.json({ error: 'Document storage is unavailable.' }, { status: 503 });
  if ((count || 0) + files.length > 5) return NextResponse.json({ error: 'Your account can store up to five career documents.' }, { status: 400 });
  for (const file of files) {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    if (!allowed[ext] || file.size < 1 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: `Unsupported file or size: ${file.name}. Use PDF, DOCX, PNG or JPEG up to 10 MB each.` }, { status: 400 });
    if (file.type && file.type !== allowed[ext]) return NextResponse.json({ error: `File content type does not match its extension: ${file.name}.` }, { status: 400 });
  }
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: 'Private storage server access is not configured.' }, { status: 503 });
  const created: Array<{ id: string; file_name: string; file_type: string; source_label: string; extraction_status: string }> = [];

  for (const file of files) {
    const safeName = file.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180);
    const ext = `.${safeName.split('.').pop()?.toLowerCase() || ''}`;
    const mime = allowed[ext];
    const objectPath = `${user.id}/${randomUUID()}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await service.storage.from(BUCKET).upload(objectPath, bytes, { contentType: mime, upsert: false });
    if (uploadError) return NextResponse.json({ error: 'Private storage upload failed. Confirm the storage bucket migration is applied.' }, { status: 503 });
    let extractedText = '';
    let extractionStatus = 'uploaded';
    try { extractedText = await extractDocumentText(bytes, mime, safeName); extractionStatus = extractedText ? 'extracted' : 'empty'; }
    catch { extractionStatus = 'extraction_failed'; }
    const { data, error: insertError } = await supabase.from('documents').insert({ user_id: user.id, file_name: safeName, file_path: objectPath, file_type: mime, file_size: file.size, extracted_text: extractedText || null, extraction_status: extractionStatus, source_label: safeName }).select('id,file_name,file_type,source_label,extraction_status').single();
    if (insertError || !data) {
      await service.storage.from(BUCKET).remove([objectPath]);
      return NextResponse.json({ error: 'Document metadata could not be saved. Confirm the Supabase migration.' }, { status: 503 });
    }
    created.push(data);
  }
  return NextResponse.json({ documents: created }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const documentId = typeof body?.document_id === 'string' ? body.document_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return NextResponse.json({ error: 'A valid document id is required.' }, { status: 400 });
  const { data: document, error: lookupError } = await supabase.from('documents').select('id,file_path').eq('id', documentId).eq('user_id', user.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Document storage is unavailable.' }, { status: 503 });
  if (!document) return NextResponse.json({ error: 'Document not found for this account.' }, { status: 404 });
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: 'Private storage server access is not configured.' }, { status: 503 });
  const { error: storageError } = await service.storage.from(BUCKET).remove([document.file_path]);
  if (storageError) return NextResponse.json({ error: 'The private document file could not be removed.' }, { status: 503 });
  const { error: deleteError } = await supabase.from('documents').delete().eq('id', documentId).eq('user_id', user.id);
  if (deleteError) return NextResponse.json({ error: 'Document metadata could not be removed.' }, { status: 503 });
  return NextResponse.json({ deleted: true });
}
