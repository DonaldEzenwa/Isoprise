'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, BookOpen, CircleHelp, Compass, FileText, LoaderCircle, RefreshCw, Save, Target } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Input, Textarea } from '@/components/ui';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';

type Profile = { full_name?: string | null; career_interest?: string | null; career_level?: string | null; career_goal?: string | null; location?: string | null; proficiency_score?: number | null; job_readiness_avg?: number | null };
type Question = { id: string; q: string; options: string[]; topic?: string; level?: string };

function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const result = await response.json();
      if (response.ok) { setProfile(result.profile); setMessage(''); }
      else { setMessage(result.error || 'Profile storage is not available yet.'); }
    } catch { setMessage('Could not reach profile storage.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return { profile, setProfile, loading, message, setMessage, reload: load };
}

export function OverviewPage() {
  const { profile, loading, message } = useProfile();
  const [summary, setSummary] = useState<{ career_progress: { score: number; completed: number; total: number; available: boolean }; alerts: { pending_verification: number | null; expired_opportunities: number | null; open_reports: number | null; verification_schema_ready: boolean; verification_counts_complete: boolean; saved_items_scanned: number; saved_items_total: number | null } } | null>(null);
  useEffect(() => {
    fetch('/api/dashboard/summary', { cache: 'no-store' }).then(async (response) => response.ok ? response.json() : null).then((data) => { if (data?.career_progress) setSummary(data); }).catch(() => undefined);
  }, []);
  const score = Math.max(0, Math.min(100, profile?.proficiency_score ?? 0));
  const readiness = Math.max(0, Math.min(100, profile?.job_readiness_avg ?? 0));
  const progress = Math.max(0, Math.min(100, summary?.career_progress.score ?? 0));
  const incomplete = !profile?.career_interest || !profile?.career_goal;
  const actions = [
    { title: profile?.career_interest ? 'Assess your skills' : 'Choose a career direction', text: profile?.career_interest ? `Map your current skills against ${profile.career_interest}.` : 'Tell us what work you want to build toward.', href: '/career', icon: Compass },
    { title: 'Find learning & funding', text: 'Explore programmes and scholarships with transparent status.', href: '/learning', icon: BookOpen },
    { title: 'Build your professional profile', text: 'Bring evidence from your CV, certificates and projects together.', href: '/documents', icon: FileText },
  ];
  return (
    <>
      <header className="page-heading">
        <div><div className="page-eyebrow">Your career companion</div><h1 className="page-title">Overview</h1><p className="page-description">A clear view of where you are and the next step you can take.</p></div>
        <Link href="/career" className="button button-small">Continue your profile <ArrowRight size={14} /></Link>
      </header>
      <section className="workspace-grid" aria-label="Career dashboard">
        <Card className="span-12" style={{ background: 'linear-gradient(115deg,#5406ba,#6b20cd 10%,#9446fa)', color: 'white', border: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 20, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.14em', fontWeight: 800, color: '#bdebd0' }}>ACCESS · DEVELOPMENT · EMPLOYABILITY</div>
              <h2 className="font-display" style={{ fontSize: 'clamp(22px,3vw,32px)', margin: '11px 0 8px', letterSpacing: '-.055em' }}>{profile?.full_name ? `Keep moving, ${profile.full_name.split(' ')[0]}.` : 'Your next step is within reach.'}</h2>
              <p style={{ maxWidth: 620, color: '#d5e8dd', fontSize: 12, lineHeight: 1.7, margin: 0 }}>Discover opportunity, develop evidence of your skills, and prepare for employment through one connected journey.</p>
              {incomplete && <Link href="/career" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, color: '#fff', fontSize: 11, fontWeight: 750 }}>Complete your career profile <ArrowRight size={13} /></Link>}
            </div>
            <div className="ring" style={{ '--ring-value': `${score * 3.6}deg`, background: `conic-gradient(#73d39e ${score * 3.6}deg,rgba(255,255,255,.18) 0)` } as React.CSSProperties} aria-label={`Proficiency score ${score} out of 100`}>
              <div className="ring-inner"><strong style={{ color: '#0f172a' }}>{loading ? '—' : score}</strong><small>proficiency</small></div>
            </div>
          </div>
        </Card>

        <Card className="span-4">
          <div className="stat-label">CAREER DIRECTION</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{loading ? 'Loading…' : profile?.career_interest || 'Not set yet'}</div>
          <div className="stat-caption">{profile?.career_level ? `${profile.career_level} level` : 'Add an interest to personalize your path.'}</div>
        </Card>
        <Card className="span-4">
          <div className="stat-label">JOB READINESS ESTIMATE</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{profile?.job_readiness_avg != null ? `${readiness}%` : 'Not assessed'}</div>
          <div className="stat-caption">Estimated skills match—not a prediction of hiring success.</div>
        </Card>
        <Card className="span-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div><div className="stat-label">CAREER PROGRESS</div><div className="stat-value" style={{ fontSize: 20 }}>{summary ? `${summary.career_progress.completed} of ${summary.career_progress.total} steps` : '—'}</div><div className="stat-caption">{summary && !summary.career_progress.available ? 'Some profile records are unavailable.' : 'Profile → evidence → applications'}</div></div>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: `conic-gradient(var(--green) ${progress * 3.6}deg,#ede6f6 0)`, display: 'grid', placeItems: 'center', flexShrink: 0 }} role="img" aria-label={summary?.career_progress.available ? `Career progress ${progress}%` : 'Career progress is partially available'}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'white', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: summary?.career_progress.available ? 12 : 9, color: '#0f172a' }}>{summary?.career_progress.available ? `${progress}%` : summary ? 'Partial' : '—'}</div>
            </div>
          </div>
        </Card>
        <div className="span-12 inline-note" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BadgeCheck size={14} color="var(--green)" />
          {summary?.alerts.verification_schema_ready && summary.alerts.verification_counts_complete ? `${summary.alerts.pending_verification} saved opportunities awaiting verification · ${summary.alerts.expired_opportunities} expired/archived · ${summary.alerts.open_reports == null ? 'Report count unavailable' : `${summary.alerts.open_reports} open reports`}` : summary && !summary.alerts.verification_schema_ready ? `Opportunity verification alerts require the Supabase schema migration · ${summary.alerts.open_reports == null ? 'Report count unavailable' : `${summary.alerts.open_reports} open reports`}` : summary && summary.alerts.saved_items_total != null && summary.alerts.saved_items_total > summary.alerts.saved_items_scanned ? `Verification counts cover only the latest ${summary.alerts.saved_items_scanned} saved items; exact totals are unavailable · ${summary.alerts.open_reports == null ? 'Report count unavailable' : `${summary.alerts.open_reports} open reports`}` : summary ? `Verification alert counts are unavailable right now · ${summary.alerts.open_reports == null ? 'Report count unavailable' : `${summary.alerts.open_reports} open reports`}` : 'Checking verification alerts for your saved opportunities…'}
          <Link href="/applications" style={{ fontWeight: 750 }}>Review saved items <ArrowRight size={12} style={{ verticalAlign: '-2px' }} /></Link>
        </div>

        <Card className="span-7">
          <CardHeader><div><CardTitle>Recommended next actions</CardTitle><div className="card-subtitle">A small, useful next step beats a long checklist.</div></div><Target size={17} color="var(--green)" /></CardHeader>
          {message && <div className="alert-error" role="status" style={{ marginBottom: 14 }}>{message} The app will not invent a profile or sample progress.</div>}
          {actions.map(({ title, text, href, icon: Icon }) => (
            <div className="list-row" key={title}>
              <div style={{ display: 'flex', gap: 11 }}><span className="step-icon" style={{ width: 31, height: 31, flexShrink: 0 }}><Icon size={15} /></span><div><div className="list-title">{title}</div><div className="list-meta">{text}</div></div></div>
              <Link href={href} aria-label={title} className="button button-quiet button-small"><ArrowRight size={14} /></Link>
            </div>
          ))}
        </Card>
        <Card className="span-5">
          <CardHeader><div><CardTitle>Your journey</CardTitle><div className="card-subtitle">Connect each stage to the next.</div></div></CardHeader>
          <div className="journey-steps">
            {[['01','Build Profile','career'],['02','Assess Skills','career'],['03','Discover & Learn','learning'],['04','Prepare CV','cv-studio'],['05','Track Applications','applications']].map(([n, title, href], index) => (
              <div key={n} style={{ display: 'flex', gap: 12, paddingBottom: index === 4 ? 0 : 15, position: 'relative' }}>
                <div style={{ width: 25, height: 25, borderRadius: 99, background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{n}</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, fontWeight: 700 }}>{title}</span><Link href={`/${href}`} className="inline-note">Open <ArrowRight size={11} style={{ verticalAlign: '-2px' }} /></Link></div>
              </div>
            ))}
          </div>
          <div className="divider" />
          <p className="inline-note"><BadgeCheck size={13} style={{ verticalAlign: '-3px', color: 'var(--green)' }} /> Verified opportunities are based on official-source evidence.</p>
        </Card>
      </section>
    </>
  );
}

export function CareerPage() {
  const { profile, setProfile, loading, message, setMessage, reload } = useProfile();
  const [saving, setSaving] = useState(false);
  const [career, setCareer] = useState('');
  const [level, setLevel] = useState('beginner');
  const [goal, setGoal] = useState('');
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessmentMessage, setAssessmentMessage] = useState('');
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<{ score: number; skill_gaps: string[]; topic_breakdown: Record<string, number> } | null>(null);
  const radarData = useMemo(() => Object.entries(assessmentResult?.topic_breakdown || {}).map(([topic, score]) => ({ topic, score: Number(score) || 0 })), [assessmentResult]);

  useEffect(() => {
    if (!profile) return;
    setCareer(profile.career_interest || ''); setLevel(profile.career_level || 'beginner'); setGoal(profile.career_goal || ''); setName(profile.full_name || '');
  }, [profile]);

  useEffect(() => {
    fetch('/api/assessment/latest', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (result?.assessment) setAssessmentResult({ score: result.assessment.score || 0, skill_gaps: result.assessment.skill_gaps || [], topic_breakdown: result.assessment.topic_breakdown || {} });
    }).catch(() => undefined);
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name, career_interest: career, career_level: level, career_goal: goal, location: 'Nigeria' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Profile could not be saved.');
      setProfile(result.profile); setMessage('Profile saved. Your next steps can now use this context.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Profile could not be saved.'); }
    finally { setSaving(false); }
  }

  async function generateAssessment() {
    if (!career.trim()) { setAssessmentMessage('Choose your career interest and save your profile before creating the assessment.'); return; }
    setAssessmentBusy(true); setAssessmentMessage(''); setAssessmentResult(null);
    try {
      const response = await fetch('/api/assessment/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ career, level }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Assessment could not be generated.');
      setAssessmentId(result.assessment_id); setQuestions(result.questions || []); setAnswers({});
      if (result.demo) setAssessmentMessage('DEMO DATA - Connect API keys for live results');
    } catch (error) { setAssessmentMessage(error instanceof Error ? error.message : 'Assessment could not be generated.'); }
    finally { setAssessmentBusy(false); }
  }

  async function scoreAssessment() {
    if (Object.keys(answers).length !== questions.length) { setAssessmentMessage('Answer every question before scoring.'); return; }
    setAssessmentBusy(true);
    try {
      const response = await fetch('/api/assessment/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assessment_id: assessmentId, answers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Assessment could not be scored.');
      setAssessmentResult(result); setAssessmentMessage('Assessment saved to your career profile.'); await reload();
    } catch (error) { setAssessmentMessage(error instanceof Error ? error.message : 'Assessment could not be scored.'); }
    finally { setAssessmentBusy(false); }
  }

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Development</div><h1 className="page-title">My Career</h1><p className="page-description">Set your direction, then assess the skills you already have and the ones to build.</p></div></header>
      <div className="workspace-grid">
        <Card className="span-5">
          <CardHeader><div><CardTitle>Career profile</CardTitle><div className="card-subtitle">This context personalizes recommendations and assistant guidance.</div></div></CardHeader>
          {message && <div className="alert-success" role="status" style={{ marginBottom: 14 }}>{message}</div>}
          <form onSubmit={saveProfile}>
            <div className="form-field"><label htmlFor="career-name">Full name</label><Input id="career-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Your full name" /></div>
            <div className="form-field"><label htmlFor="career-interest">Career interest</label><Input id="career-interest" value={career} onChange={(event) => setCareer(event.target.value)} required placeholder="e.g. Data Analyst" maxLength={120} /></div>
            <div className="form-field"><label htmlFor="career-level">Current level</label><select className="select" id="career-level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div className="form-field"><label htmlFor="career-goal">Career goal</label><Textarea id="career-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What role or outcome are you working toward?" maxLength={1200} /></div>
            <p className="inline-note">Location is set to Nigeria for opportunity eligibility filtering.</p>
            <Button type="submit" disabled={saving || loading} style={{ marginTop: 14 }}><Save size={14} /> {saving ? 'Saving…' : 'Save profile'}</Button>
            {message && message.includes('migration') && <p className="inline-note" style={{ marginTop: 10 }}>{message}</p>}
          </form>
        </Card>
        <Card className="span-7">
          <CardHeader><div><CardTitle>15-question skills assessment</CardTitle><div className="card-subtitle">Questions adapt to your selected career and experience level.</div></div><CircleHelp size={17} color="var(--green)" /></CardHeader>
          {!questions.length ? (
            <div className="empty-state"><p>Save your career profile, then generate an assessment that checks the skills relevant to your direction.</p><Button onClick={generateAssessment} disabled={assessmentBusy || !career}><RefreshCw size={14} /> {assessmentBusy ? 'Preparing assessment…' : 'Generate assessment'}</Button>{assessmentMessage && <p style={{ marginTop: 12 }}>{assessmentMessage}</p>}</div>
          ) : (
            <div>
              {assessmentMessage && <div className={assessmentResult ? 'alert-success' : 'alert-error'} role="status" style={{ marginBottom: 12 }}>{assessmentMessage}</div>}
              {assessmentResult && <div className="alert-success" role="status" style={{ marginBottom: 13 }}>Score: {assessmentResult.score}% {assessmentResult.skill_gaps.length > 0 && <>· Skill gaps: {assessmentResult.skill_gaps.join(', ')}</>}</div>}
              <div style={{ maxHeight: 510, overflow: 'auto', paddingRight: 5 }}>
                {questions.map((question, index) => <fieldset key={question.id} style={{ border: 0, borderTop: '1px solid #edf1ef', padding: '14px 0', margin: 0 }}><legend style={{ fontSize: 11, fontWeight: 750, lineHeight: 1.5, padding: '0 0 8px' }}>{index + 1}. {question.q}</legend><div style={{ display: 'grid', gap: 7 }}>{question.options.map((option) => <label key={option} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 10, color: '#536158', cursor: 'pointer' }}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</div></fieldset>)}
              </div>
              <Button onClick={scoreAssessment} disabled={assessmentBusy || Boolean(assessmentResult)} style={{ marginTop: 12 }}>{assessmentBusy ? <LoaderCircle size={14} /> : <Target size={14} />} Submit assessment</Button>
            </div>
          )}
        </Card>
        <Card className="span-12"><CardHeader><div><CardTitle>Skills-gap radar</CardTitle><div className="card-subtitle">Topic scores from your latest saved assessment; higher scores indicate stronger demonstrated knowledge.</div></div></CardHeader>{radarData.length ? <><div style={{ width: '100%', height: 270 }}><ResponsiveContainer><RadarChart data={radarData} outerRadius="72%"><PolarGrid stroke="#dfe8e2" /><PolarAngleAxis dataKey="topic" tick={{ fill: '#64746b', fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#94a39a', fontSize: 8 }} axisLine={false} /><Radar dataKey="score" name="Topic score" stroke="#6339b2" fill="#6339b2" fillOpacity={0.22} /></RadarChart></ResponsiveContainer></div><div className="chip-row">{radarData.map(({ topic, score }) => <span className="tag tag-green" key={topic}>{topic}: {score}%</span>)}</div>{assessmentResult?.skill_gaps?.length ? <p className="inline-note" style={{ marginTop: 10 }}>Focus areas: {assessmentResult.skill_gaps.join(', ')}</p> : null}</> : <div className="empty-state">Complete a 15-question assessment to see your topic-level skill profile here.</div>}</Card>
      </div>
    </>
  );
}
