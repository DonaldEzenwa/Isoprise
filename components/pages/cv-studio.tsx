'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowDownToLine, BadgeCheck, BriefcaseBusiness, FileCheck2, FileText, Sparkles, Target } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Textarea } from '@/components/ui';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';

type Readiness = { readiness_score: number; readiness_label: string; breakdown: { requirement: string; profile_evidence: string; status: 'matched' | 'partial' | 'gap' }[]; recommendations: string[]; disclaimer: string };

function toneFor(score: number) {
  if (score < 40) return '#dc2626';
  if (score < 70) return '#eab308';
  if (score < 85) return '#16a34a';
  return '#006b40';
}

export function CvStudioPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [professionalProfileId, setProfessionalProfileId] = useState('');
  const [cvId, setCvId] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [busy, setBusy] = useState<'analyze' | 'docx' | 'pdf' | 'cover' | null>(null);
  const [message, setMessage] = useState('');
  const [atsNotes, setAtsNotes] = useState<string[]>([]);

  useEffect(() => {
    const requestedJob = new URLSearchParams(window.location.search).get('job');
    if (requestedJob) setJobDescription(requestedJob.slice(0, 12000));
    fetch('/api/profile', { cache: 'no-store' }).then((response) => response.json()).then((data) => {
      if (data.professional_profile_id) setProfessionalProfileId(data.professional_profile_id);
      if (!data.schema_ready) setMessage(data.error || 'Apply the Supabase schema migration to save CVs and profiles.');
    }).catch(() => setMessage('Profile storage is not available.'));
  }, []);

  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    if (!jobDescription.trim()) { setMessage('Paste a job description so the readiness analysis has requirements to compare.'); return; }
    setBusy('analyze'); setMessage(''); setReadiness(null);
    try {
      const response = await fetch('/api/cv/analyze-jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cv_id: cvId || undefined, job_description: jobDescription }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Readiness analysis could not be completed.');
      setReadiness(result); setAtsNotes(result.ats_notes || []);
      if (result.demo) setMessage('DEMO DATA - Connect API keys for live results');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Readiness analysis could not be completed.'); }
    finally { setBusy(null); }
  }

  async function download(format: 'docx' | 'pdf') {
    setBusy(format); setMessage('');
    try {
      const response = await fetch('/api/cv/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ professional_profile_id: professionalProfileId || undefined, template: 'ats_clean', job_description: jobDescription, format }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'CV could not be generated.'); }
      const id = response.headers.get('x-cv-id'); if (id) setCvId(id);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = `isoprise-cv.${format}`; anchor.click(); URL.revokeObjectURL(href);
      setMessage(`${format.toUpperCase()} CV downloaded. Keep your original evidence accurate and quantified.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'CV could not be generated.'); }
    finally { setBusy(null); }
  }

  async function generateCoverLetter() {
    if (!cvId) { setMessage('Generate a CV first so the cover letter can use your saved profile and CV.'); return; }
    setBusy('cover'); setMessage('');
    try {
      const response = await fetch('/api/cv/cover-letter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cv_id: cvId, job_description: jobDescription }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Cover letter could not be generated.');
      setCoverLetter(result.content); if (result.demo) setMessage('DEMO DATA - Connect API keys for live results');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cover letter could not be generated.'); }
    finally { setBusy(null); }
  }

  const tone = readiness ? toneFor(readiness.readiness_score) : '#008751';
  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Employability</div><h1 className="page-title">AI CV Studio</h1><p className="page-description">Build a clear, single-column ATS CV from your professional profile and compare your evidence against a real role.</p></div><span className="tag"><FileCheck2 size={12} /> ATS-friendly</span></header>
      <div className="workspace-grid">
        <Card className="span-7">
          <CardHeader><div><CardTitle>Job description & readiness</CardTitle><div className="card-subtitle">Paste the role requirements to see evidence, gaps and practical actions.</div></div><Target size={17} color="#008751" /></CardHeader>
          <form onSubmit={analyze}>
            <div className="form-field"><label htmlFor="job-description">Job description</label><Textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={9} placeholder="Paste the responsibilities and requirements here…" maxLength={12000} /></div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={busy !== null}><Sparkles size={14} /> {busy === 'analyze' ? 'Analyzing…' : 'Analyze readiness'}</Button>
              <Button type="button" variant="secondary" onClick={() => void download('docx')} disabled={busy !== null}><ArrowDownToLine size={14} /> {busy === 'docx' ? 'Preparing…' : 'Download DOCX'}</Button>
              <Button type="button" variant="secondary" onClick={() => void download('pdf')} disabled={busy !== null}><ArrowDownToLine size={14} /> {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</Button>
            </div>
          </form>
          {message && <div className={message.startsWith('DEMO DATA') ? 'alert-success' : 'alert-error'} role="status" style={{ marginTop: 13 }}>{message}</div>}
          {atsNotes.length > 0 && <div style={{ marginTop: 16 }}><div className="stat-label">ATS ANALYSIS</div>{atsNotes.map((note) => <div className="list-meta" key={note}>• {note}</div>)}</div>}
        </Card>
        <Card className="span-5">
          <CardHeader><div><CardTitle>Estimated job readiness</CardTitle><div className="card-subtitle">Profile evidence matched to the role requirements.</div></div><BriefcaseBusiness size={17} color="#008751" /></CardHeader>
          {!readiness ? <div className="empty-state">Add a job description and analyze it to see a score. A score is an estimated skills match, not a hiring prediction.</div> : <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><RadialBarChart data={[{ score: readiness.readiness_score }]} innerRadius="78%" outerRadius="100%" startAngle={90} endAngle={-270}><PolarAngleAxis type="number" domain={[0, 100]} dataKey="score" tick={false} /><RadialBar dataKey="score" background={{ fill: '#e8efeb' }} fill={tone} cornerRadius={8} /></RadialBarChart></ResponsiveContainer><div className="ring-inner" style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'center', pointerEvents: 'none' }}><strong>{readiness.readiness_score}</strong><small>out of 100</small></div></div>
              <div><span className="tag" style={{ color: tone, borderColor: tone }}>{readiness.readiness_label}</span><p className="inline-note" style={{ maxWidth: 190, marginTop: 7 }}>Your profile compared with the requirements shown.</p></div>
            </div>
            <div className="stat-label" style={{ marginBottom: 8 }}>REQUIREMENT BREAKDOWN</div>
            {(readiness.breakdown || []).map((item, index) => <div className="list-row" key={`${item.requirement}-${index}`}><div><div className="list-title">{item.requirement}</div><div className="list-meta">Evidence: {item.profile_evidence || 'Not found in your profile'}</div></div><span className={`tag ${item.status === 'matched' ? 'tag-green' : item.status === 'partial' ? 'tag-amber' : 'tag-red'}`}>{item.status === 'matched' ? 'Good match' : item.status === 'partial' ? 'Partial' : 'Skill gap'}</span></div>)}
            {readiness.recommendations?.length > 0 && <div style={{ marginTop: 13 }}><div className="stat-label">NEXT ACTIONS</div>{readiness.recommendations.map((item, index) => <div className="list-meta" key={`${item}-${index}`}>• {item}</div>)}</div>}
            <p className="inline-note" style={{ borderTop: '1px solid #edf1ef', paddingTop: 12, marginTop: 13 }}>{readiness.disclaimer}</p>
          </>}
        </Card>
        <Card className="span-7">
          <CardHeader><div><CardTitle>Tailored cover letter</CardTitle><div className="card-subtitle">Generate a specific, evidence-based letter from your saved CV.</div></div><FileText size={17} color="#008751" /></CardHeader>
          <Button variant="secondary" onClick={generateCoverLetter} disabled={busy !== null || !cvId}><Sparkles size={14} /> {busy === 'cover' ? 'Drafting…' : 'Generate cover letter'}</Button>
          {coverLetter && <div className="form-field" style={{ marginTop: 14 }}><label htmlFor="cover-letter">Review and edit your draft</label><Textarea id="cover-letter" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows={10} /></div>}
        </Card>
        <Card className="span-5">
          <CardHeader><div><CardTitle>ATS format, by design</CardTitle><div className="card-subtitle">Readable by a recruiter and applicant tracking system.</div></div><BadgeCheck size={17} color="#008751" /></CardHeader>
          <div className="list-meta">Single-column layout · no tables or images in DOCX.</div><div className="list-meta">Standard headings: Summary, Experience, Education, Skills, Projects, Certificates.</div><div className="list-meta">Include role keywords and quantified achievements; one page for under five years of experience, two pages maximum.</div>
        </Card>
      </div>
    </>
  );
}
