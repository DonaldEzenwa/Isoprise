import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Compass,
  FileUser,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

const principles = [
  {
    key: '01',
    title: 'ACCESS',
    text: 'Discover free and affordable learning opportunities, scholarships and funded programmes.',
    icon: Compass,
  },
  {
    key: '02',
    title: 'DEVELOPMENT',
    text: 'Assess your abilities, identify skill gaps and build a practical path forward.',
    icon: BookOpenCheck,
  },
  {
    key: '03',
    title: 'EMPLOYABILITY',
    text: 'Build a competitive professional profile, prepare a quality CV and find legitimate opportunities.',
    icon: BriefcaseBusiness,
  },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="brand-lockup" aria-label="Isoprise home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isoprise-logo.png" alt="Isoprise" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <span className="sr-only">Isoprise</span>
          <small style={{ padding: '2px 8px', background: 'var(--green-soft)', color: 'var(--green-dark)', borderRadius: 999, fontWeight: 750, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Career companion</small>
        </Link>
        <div className="landing-actions">
          <Link className="button button-quiet" href="/login">Sign in</Link>
          <Link className="button button-secondary button-small" href="/register">Create account</Link>
        </div>
      </nav>

      <div className="landing-main">
        <section className="hero-grid" aria-labelledby="hero-title">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> A 3MTT × Meta capstone</span>
            <h1 className="hero-title" id="hero-title">Your next step in tech, <span>within reach.</span></h1>
            <p className="hero-copy">
              Isoprise — Your AI-Powered Career and Employability Companion. From discovering opportunities and acquiring skills to building your professional profile and finding employment, your entire career journey comes together in one place.
            </p>
            <div className="hero-cta">
              <Link className="button" href="/register">Build your career path <ArrowRight size={16} /></Link>
              <Link className="button button-secondary" href="/login">I already have an account</Link>
            </div>
            <p className="inline-note" style={{ marginTop: 15 }}>A practical companion for young Nigerians overcoming barriers to digital education—not a commercial job board.</p>
          </div>

          <div className="demo-shell" aria-label="Career journey preview">
            <div className="demo-top">
              <div><div className="demo-title">One journey. Your next opportunity.</div><div className="demo-subtitle">A connected path from learning to work</div></div>
              <span className="pill"><Sparkles size={12} /> Built around you</span>
            </div>
            <div className="demo-path">
              {principles.map(({ key, title, text, icon: Icon }) => (
                <div className="demo-step" key={key}>
                  <span className="step-icon"><Icon size={14} /></span>
                  <strong>{title}</strong>
                  <small>{text.split('.')[0]}.</small>
                </div>
              ))}
            </div>
            <div className="path-line" />
            <div className="demo-foot"><span>Discover · Develop · Prepare</span><b><ShieldCheck size={13} style={{ verticalAlign: '-2px', color: 'var(--green)' }} /> Trust before apply</b></div>
          </div>
        </section>

        <section className="principles" aria-label="Our principles">
          {principles.map(({ key, title, text, icon: Icon }) => (
            <article className="principle" key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="principle-label">{key} / {title}</span>
                <Icon size={18} color="var(--green)" strokeWidth={1.8} />
              </div>
              <h2>{title === 'ACCESS' ? 'Open doors to learning' : title === 'DEVELOPMENT' ? 'Build skills with purpose' : 'Show what you can do'}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="landing-section" aria-labelledby="journey-heading">
          <span className="eyebrow"><Target size={13} /> Your career, connected</span>
          <h2 id="journey-heading">Turn ambition into a next step.</h2>
          <p>Assess your skills, discover opportunities with transparent verification, learn what employers ask for, and bring your professional story together in one place.</p>
          <div className="journey" aria-label="Career journey">
            {['Build your profile', 'Assess your skills', 'Find learning & funding', 'Prepare your CV', 'Track applications'].map((item, index) => (
              <span key={item} style={{ display: 'contents' }}>
                <span className="journey-item">{item}</span>
                {index < 4 && <ArrowRight className="journey-arrow" size={14} aria-hidden="true" />}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 30 }}>
            <Link className="button" href="/register">Start with your profile <FileUser size={15} /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
