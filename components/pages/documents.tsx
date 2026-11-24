'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Check, FileArchive, FileText, LoaderCircle, ScanSearch, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Textarea } from '@/components/ui';

type UploadedDocument = { id: string; file_name: string; file_type?: string; source_label?: string; extraction_status?: string };
type Intelligence = { summary?: string; qualifications?: unknown[]; skills?: Record<string, unknown>; projects?: unknown[]; achievements?: unknown[]; missing_info?: string[]; transferable_skills?: unknown[]; source_documents?: string[] };
type EvidenceRow = { section: string; label: string; source: string };

function evidenceRows(value: Intelligence): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  const add = (section: string, list: unknown[] | undefined, label: (item: Record<string, unknown>) => string) => {
    (list || []).forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      const item = entry as Record<string, unknown>;
      const source = typeof item.source_doc === 'string' ? item.source_doc : 'Source not identified';
      const text = label(item).trim();
      if (text) rows.push({ section, label: text.slice(0, 240), source });
    });
  };
  add('Qualification', value.qualifications, (item) => [item.title, item.issuer, item.date, item.credential_id].filter((part) => typeof part === 'string' && part).join(' · '));
  add('Project', value.projects, (item) => [item.title, item.description, Array.isArray(item.technologies) ? item.technologies.join(', ') : ''].filter((part) => typeof part === 'string' && part).join(' · '));
  add('Achievement', value.achievements, (item) => [item.text, item.metric].filter((part) => typeof part === 'string' && part).join(' · '));
  add('Transferable skill', value.transferable_skills, (item) => `${String(item.from || '')} → ${String(item.to || '')}${Array.isArray(item.mapped_skills) ? ` · ${item.mapped_skills.join(', ')}` : ''}`);
  return rows;
}

export function DocumentsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [analysis, setAnalysis] = useState<Intelligence | null>(null);
  const [edited, setEdited] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/documents/upload', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (active && result?.documents) setDocuments(result.documents);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 5 || documents.length + selected.length > 5) { setMessage('Your account can store no more than five documents. Remove an existing file before adding more.'); setFiles([]); return; }
    setMessage(''); setFiles(selected); setAnalysis(null); setConfirmed(false);
  }

  async function reloadDocuments(fallback: UploadedDocument[] = []) {
    try {
      const response = await fetch('/api/documents/upload', { cache: 'no-store' });
      const result = await response.json();
      if (response.ok) setDocuments(result.documents || fallback);
      else if (fallback.length) setDocuments(fallback);
    } catch { if (fallback.length) setDocuments(fallback); }
  }

  async function upload() {
    if (files.length < 1 || files.length > 5) { setMessage('Choose between one and five files.'); return; }
    setBusy(true); setMessage(''); setAnalysis(null); setConfirmed(false);
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      const response = await fetch('/api/documents/upload', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload could not be completed.');
      await reloadDocuments(result.documents || []);
      setMessage(result.demo ? 'DEMO DATA - Connect API keys for live results' : `${(result.documents || []).length} private document(s) uploaded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload could not be completed.'); }
    finally { setBusy(false); }
  }

  async function retryExtraction(documentId: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/documents/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: documentId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Extraction could not be retried.');
      await reloadDocuments();
      setMessage(`Extraction ${result.extraction_status}; ${result.character_count} characters available for review.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Extraction could not be retried.'); }
    finally { setBusy(false); }
  }

  async function removeDocument(document: UploadedDocument) {
    if (!window.confirm(`Delete ${document.file_name} and its private stored copy?`)) return;
    setBusy(true); setMessage(''); setAnalysis(null); setConfirmed(false);
    try {
      const response = await fetch('/api/documents/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: document.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Document could not be removed.');
      await reloadDocuments(); setMessage('Document removed. You can add another file.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Document could not be removed.'); }
    finally { setBusy(false); }
  }

  async function analyze() {
    if (!documents.length) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/profile-intelligence/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_ids: documents.map((doc) => doc.id) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Document analysis could not be completed.');
      const intelligence = result.profile_intelligence as Intelligence;
      setAnalysis(intelligence); setEdited(JSON.stringify(intelligence, null, 2));
      if (result.demo) setMessage('DEMO DATA - Connect API keys for live results');
      else setMessage('Review the extracted fields and sources before confirming the merge.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Document analysis could not be completed.'); }
    finally { setBusy(false); }
  }

  async function confirmMerge() {
    let profile_intelligence: Intelligence;
    try { profile_intelligence = JSON.parse(edited) as Intelligence; }
    catch { setMessage('Edit the JSON so it is valid before confirming.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/documents/merge-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_ids: documents.map((doc) => doc.id), profile_intelligence }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Profile merge could not be saved.');
      setConfirmed(true); setMessage('Profile Intelligence saved to your professional profile.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Profile merge could not be saved.'); }
    finally { setBusy(false); }
  }

  const demoLabel = message.startsWith('DEMO DATA');
  const extractedEvidence = analysis ? evidenceRows(analysis) : [];
  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Professional Profile Intelligence</div><h1 className="page-title">Career Documents</h1><p className="page-description">Bring up to five documents together, review what they say about your experience, then decide what to save.</p></div><span className="tag tag-green"><ShieldCheck size={12} /> Private storage</span></header>
      <div className="workspace-grid">
        <Card className="span-5">
          <CardHeader><div><CardTitle>Upload your evidence</CardTitle><div className="card-subtitle">PDF, DOCX, PNG or JPEG · up to five files total.</div></div><UploadCloud size={17} color="var(--green)" /></CardHeader>
          <label htmlFor="career-documents" className="empty-state" style={{ display: 'block', cursor: 'pointer', padding: 24 }}>
            <FileArchive size={22} color="var(--green)" />
            <p style={{ margin: '9px 0 3px', color: '#334239', fontWeight: 750 }}>Choose files from your device</p>
            <span className="inline-note">Documents remain private to your account.</span>
          </label>
          <input id="career-documents" type="file" multiple accept=".pdf,.docx,image/png,image/jpeg" onChange={chooseFiles} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          {files.length > 0 && <div style={{ marginTop: 14 }}>{files.map((file) => <div className="list-row" key={`${file.name}-${file.size}`}><span className="list-title"><FileText size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />{file.name}</span><span className="list-meta">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>)}</div>}
          <Button onClick={upload} disabled={busy || files.length === 0} style={{ width: '100%', marginTop: 15 }}>{busy ? <LoaderCircle size={14} className="spin" /> : <UploadCloud size={14} />} Upload privately</Button>
          {message && <div className={demoLabel || confirmed ? 'alert-success' : 'alert-error'} role="status" style={{ marginTop: 12 }}>{message}</div>}
          {documents.length > 0 && <div style={{ marginTop: 16 }}><div className="stat-label" style={{ marginBottom: 7 }}>SOURCE DOCUMENTS ({documents.length}/5)</div>{documents.map((doc) => <div className="list-row" key={doc.id}><div><div className="list-title">{doc.file_name}</div><div className="list-meta">From: {doc.file_name} · {doc.extraction_status || 'uploaded'}</div></div><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span className="tag">Private</span>{doc.extraction_status !== 'extracted' && <Button size="sm" variant="secondary" onClick={() => void retryExtraction(doc.id)} disabled={busy}>Retry extraction</Button>}<Button size="sm" variant="quiet" onClick={() => void removeDocument(doc)} disabled={busy} aria-label={`Delete ${doc.file_name}`}><Trash2 size={13} /></Button></div></div>)}<Button variant="secondary" onClick={analyze} disabled={busy} style={{ marginTop: 13, width: '100%' }}><ScanSearch size={14} /> Analyze and merge profile</Button></div>}
          <p className="inline-note" style={{ marginTop: 14 }}>Supported extraction: PDF and Word text; image OCR runs only when the configured OCR runtime is available.</p>
        </Card>
        <Card className="span-7">
          <CardHeader><div><CardTitle>Profile Intelligence review</CardTitle><div className="card-subtitle">Qualifications, projects, technologies, achievements, gaps and transferable skills.</div></div><ScanSearch size={17} color="var(--green)" /></CardHeader>
          {!analysis && <div className="empty-state">Upload at least one document and analyze it. Nothing is merged into your profile until you review and confirm.</div>}
          {analysis && <>
            <p style={{ fontSize: 12, lineHeight: 1.65, color: '#526158' }}>{analysis.summary || 'Review the extracted fields below.'}</p>
            <div className="chip-row" style={{ margin: '12px 0' }}>{documents.map((doc) => <span className="tag tag-green" key={doc.id}>From: {doc.file_name}</span>)}</div>
            <p className="inline-note">Combined source summary: {documents.length} document(s) · {(analysis.qualifications || []).length} qualifications · {(analysis.projects || []).length} projects · {(analysis.achievements || []).length} quantified achievements · {(analysis.transferable_skills || []).length} transferable-skill mappings.</p>
            {extractedEvidence.length > 0 && <div style={{ marginTop: 10, maxHeight: 240, overflowY: 'auto' }}>{extractedEvidence.slice(0, 40).map((row, index) => <div className="list-row" key={`${row.section}-${row.source}-${index}`}><div><div className="list-title">{row.section}: {row.label}</div><div className="list-meta">From: {row.source}</div></div><span className="tag tag-green">Source linked</span></div>)}</div>}
            {Array.isArray(analysis.missing_info) && analysis.missing_info.length > 0 && <div className="alert-error" role="status" style={{ margin: '13px 0' }}><strong>Information to review</strong><ul style={{ margin: '5px 0 0', paddingLeft: 18 }}>{analysis.missing_info.slice(0, 8).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
            <div className="form-field"><label htmlFor="profile-intelligence-json">Edit extracted profile JSON (each field should keep its source document)</label><Textarea id="profile-intelligence-json" value={edited} onChange={(event) => setEdited(event.target.value)} rows={14} style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10 }} /></div>
            <div className="alert-success" style={{ marginBottom: 13 }}><strong>Nothing is saved until you confirm.</strong> Check qualification dates, credential IDs and achievement metrics before merging.</div>
            <Button onClick={confirmMerge} disabled={busy || confirmed}><Check size={14} /> {busy ? 'Saving…' : confirmed ? 'Profile saved' : 'Confirm and save to my profile'}</Button>
          </>}
        </Card>
      </div>
    </>
  );
}
