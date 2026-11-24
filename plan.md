# Isoprise — Implementation Plan

## Mission and product boundaries

Isoprise is a mission-centered AI career and employability companion for young Nigerians overcoming barriers to digital education. It is a 3MTT x Meta capstone, not a commercial job board.

**Tagline:** “Isoprise — Your AI-Powered Career and Employability Companion.”

**Supporting copy:** “From discovering opportunities and acquiring skills to building your professional profile and finding employment, Isoprise brings your entire career development journey into one platform.”

The dashboard and README will foreground:

- **ACCESS:** Help people discover free and affordable learning opportunities, scholarships and funded programmes.
- **DEVELOPMENT:** Help people assess their abilities, identify skill gaps and develop professionally.
- **EMPLOYABILITY:** Help people build competitive professional profiles, prepare quality CVs and discover legitimate employment opportunities.

The end-to-end journey is Register → Build Profile → Assess Skills (15 questions) → Discover Scholarships (verified only) → Learn → Build CV (Profile Intelligence) → Check Readiness → Find Jobs → Track Applications.

## Design direction

Reuse the supplied React HTML prototype’s restrained Tailwind dashboard vocabulary, card surfaces, generous whitespace, dark-slate text/surfaces and green progress/status accents, and refine it into a premium civic-tech product interface.

- **Design movement:** Mission-centered civic-tech editorial design with the clarity and restraint of a polished SaaS workspace.
- **Core principles:** Dignity for early-career users; practical next steps over vanity metrics; trust visible at every opportunity; mobile-first performance and clarity.
- **Color philosophy:** Nigerian green `#008751` signals agency and forward motion; dark slate `#0f172a` anchors focus; white provides breathing room; green/yellow/red remain reserved for meaningful status and verification states.
- **Layout paradigm:** A clear desktop side rail and focused workspace, with the main page organized around a single next action and supporting detail rather than an undifferentiated card grid. On mobile, use compact drawer/navigation patterns and stack decision-critical information first.
- **Signature elements:** A three-stage Access → Development → Employability pathway; circular career/readiness progress indicators; official-source verification badges with visible source links.
- **Interaction philosophy:** Controls must produce a clear state change; distinguish live data from demo data; keep review-before-save on extracted professional information; make expired application actions impossible.
- **Animation:** Short, restrained transitions for navigation, progress and feedback; respect `prefers-reduced-motion`; no animation that delays a form or hides a status.
- **Typography system:** Use a crisp sans-serif hierarchy (Manrope for display/headings and Inter for UI/body text), with legible small-text sizes and clear distinction between headings, metadata and verification copy.
- **Brand essence:** An AI-powered career companion for young Nigerians that connects learning access, skill development and employability in one trustworthy journey. Personality: supportive, credible, ambitious.
- **Brand voice:** Encouraging, direct, specific, never overpromising. Example lines: “Your next step is within reach.” “Build evidence for the role you want.”
- **Wordmark & logo:** A compact “IP” mark built from three ascending connected forms to represent Access, Development and Employability; pair it with the full wordmark. Avoid implying an official 3MTT or Meta endorsement beyond the capstone description.
- **Signature brand color:** Nigerian green `#008751`.

## Implementation approach

### Application and serving

Build a Vercel-compatible Next.js 14 App Router application with TypeScript and Tailwind, using the initialized managed project’s server capability for the live Preview and production container. Keep the requested Supabase service external; the initialized Manus managed database remains disabled. Organize server APIs as Next.js route handlers and use relative browser-facing URLs. The root Dockerfile uses Node 22 and pinned `pnpm@11.25.0`, performs a frozen dependency install and production build without `.env` or private credentials, then starts the existing server on `0.0.0.0:${PORT:-3000}`; expose port 3000 and use unauthenticated `/api/health`. The browser receives only runtime Supabase URL/anon-key configuration through no-store `/api/client-config`; service-role and other private values stay in server-only runtime environment. The current `auto_publish` preference is false; after the accepted canonical checkpoint, submit one explicit publish request as authorized by the user, preserve that preference and all secret scopes, and respect the platform’s default visibility and any confirmation card.

Use Supabase Auth (email/password plus Google and GitHub providers when enabled), Supabase Postgres and private Supabase Storage. Use session-aware browser/server Supabase clients, verify the session and authorization on every protected API, and use `SUPABASE_SERVICE_ROLE_KEY` only in server-only code after authenticating/authorizing the caller. Configure user/session cookies for the HTTPS cross-site Preview context (`SameSite=None; Secure`) where application-owned cookies are used. Use the actual browser-visible origin for OAuth redirects; do not derive it from an internal request host. `/api/status` checks Supabase Auth's read-only settings response and each social-login button is shown only when its corresponding `external.google` or `external.github` setting is true; the latest Preview check confirms both Google and GitHub are enabled.

Use a versioned Supabase SQL migration for enums, tables, indexes, private storage policies and RLS. The supplied schema is the basis, with stricter `admin_users`/`verification_queue` access policies and write checks where needed. Read-only checks confirm Supabase auth/table connectivity and the private `career-documents` bucket, but `jobs_cache` and `learning_resources_cache` lack required official-verification/date columns, while the existing report table has legacy `status` instead of required `report_status`; an idempotent additive migration preserves old report-state values and supplies these fields. The app reports that schema gap until applied. The uploaded `.env` did not contain a database password or management token; therefore application of DDL to the external Supabase project still requires SQL Editor access or an authorized database/management credential. Do not claim the schema is complete until that step succeeds.

### Data and integrations

Use Groq Llama 3 70B through the requested Vercel AI SDK path for assessment generation, profile intelligence, CV/cover-letter assistance and streaming assistant responses. Use Tavily with SerpAPI fallback for discovery. Implement a single provider/status layer used by `/api/status` and page banners. If a required credential is absent, report the missing dependency, expose only an honest development-mode state, label simulated content exactly `DEMO DATA - Connect API keys for live results`, and never treat a discovery whitelist or demo record as verified.

Compute `CURRENT_YEAR = new Date().getFullYear()` and `NEXT_YEAR = CURRENT_YEAR + 1` at runtime. Use these in scholarship queries. Use `window.location.origin` for OAuth callback origins rather than a hardcoded `NEXT_PUBLIC_APP_URL`.

### Feature modules

Implement all ten routes: `/overview`, `/career`, `/learning`, `/opportunities`, `/assistant`, `/documents`, `/cv-studio`, `/transition`, `/applications`, `/settings`, plus protected `/admin`. Build the exact dashboard features and end-to-end journey described in the approved TODO.

Implement opportunity verification as a shared server-side rule: VERIFIED only for an official-domain match or an authorized application portal explicitly linked from the official organization site. Whitelist is discovery-only. EXPIRED when official deadline has passed or the specified 45+ day/closed indicator rule applies. Only an `admin_users` administrator may invoke the service-role verification mutation; ordinary users can report a listing but cannot change shared cache or verification-queue state. All cards show status and evidence; expired apply actions are disabled. Overview alert counts must either cover the whole saved set or clearly disclose a bounded/incomplete scope.

Implement document intake for up to five PDF/DOCX/image files with validation, extraction and per-user ownership. Combine extracted qualifications, issuers, skills, projects, technologies, quantified achievements, missing information and transferable skills into editable profile intelligence with source-document tags. Require explicit user confirmation before saving.

Compute job readiness as `((matched_required * 1) + (partial * 0.5)) / total_required * 100`; show evidence breakdown, category label, next recommendations and the exact disclaimer in the TODO. Generate ATS-oriented single-column DOCX and PDF, analyze job-description fit, and generate cover letters.

The assistant loads actual account profile, latest assessment/gaps, top skills, experience, certificates, projects, learning history, saved items, generated CVs and recent conversation/search context. It provides the seven specified prompt suggestions, source citations, streaming when Groq is available, and a save action for opportunities. If the profile is incomplete, it asks the user to complete it.

### Credentials and privacy

The uploaded env file’s variable names are known, but its values will not be read, echoed, committed or copied into source. Use the project’s protected secret-input flow for Supabase and provider credentials. Required runtime integration keys are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY` and `SERPAPI_API_KEY`. `NEXT_PUBLIC_APP_URL` is unnecessary when the actual browser origin is used; `NEXT_PUBLIC_CURRENT_YEAR` is unnecessary because the year is dynamic. Keep `.env.example` limited to blank or clearly fake placeholders. Google sign-in additionally depends on the Google provider being configured in Supabase.

## Project structure

```text
/home/ubuntu/isoprise/
├── Dockerfile                  # Clean production image; PORT-aware entrypoint
├── app/
│   ├── (auth)/                 # Sign-in, registration, OAuth return
│   ├── (workspace)/            # Shared authenticated dashboard shell
│   │   ├── overview/           # Career progress and actions
│   │   ├── career/             # Profile editor and assessment
│   │   ├── learning/           # Scholarship and learning discovery
│   │   ├── opportunities/      # Jobs and readiness entry points
│   │   ├── assistant/          # Contextual streaming chat
│   │   ├── documents/          # Private upload and intelligence review
│   │   ├── cv-studio/          # CV, JD analysis, cover letters
│   │   ├── transition/         # Transferable skill pathways
│   │   ├── applications/       # Opportunity tracking
│   │   ├── settings/           # Account, privacy and export
│   │   └── admin/              # Protected future-ready placeholder
│   └── api/                    # Route handlers plus public runtime config and health endpoints
├── components/
│   ├── app-shell.tsx            # Authenticated shell, sidebar, chat bubble, status banner
│   ├── auth-form.tsx            # Supabase sign-in and registration forms
│   ├── ui.tsx                   # Shared accessible UI primitives
│   └── pages/                   # Feature page modules for career, discovery, assistant,
│       ├── overview-career.tsx  # Overview, profile editor and skills assessment
│       ├── discovery.tsx        # Learning and opportunity discovery
│       ├── assistant.tsx        # Profile-grounded streaming chat
│       ├── documents.tsx        # Private upload and Profile Intelligence
│       ├── cv-studio.tsx        # CV, readiness and cover-letter workflows
│       └── misc.tsx             # Transition map, applications, settings and admin UI
├── lib/
│   ├── supabase/               # Browser/server clients and auth guards
│   ├── providers/              # Groq, Tavily and SerpAPI clients
│   ├── verification/           # Official-domain and portal-link rules
│   ├── readiness/              # Matching/scoring rules
│   ├── documents/              # PDF/DOCX extraction and merge helpers
│   ├── cv/                     # ATS analysis and DOCX/PDF generation
│   ├── assistant/              # Owner-scoped recent search history
│   ├── status.ts               # Secret-free integration and schema readiness
│   └── utils.ts                # Dynamic scholarship years and shared helpers
├── supabase/migrations/        # Versioned schema, RLS and storage policies
├── public/manus-routes.json    # Route manifest for Preview tooling
├── app.config.ts               # Project logo metadata
├── README.md                   # Mission, principles, setup and integration state
├── .env.example                # Names and placeholders only
├── plan.md
└── TODO.md
```

## Dependencies and delivery constraints

Pin the Node package manager in `package.json`; add the package-manager lifecycle permissions in the appropriate checked-in configuration before installation. Include compatible versions of Next.js, React, TypeScript, Tailwind, Supabase SSR/client libraries, Vercel AI SDK/provider, Groq, Tavily/SerpAPI clients as needed, Recharts, lucide icons, `docx`, `@react-pdf/renderer`, `pdf-parse`, `mammoth`, and validation/markdown rendering libraries. Add only dependencies actually used.

Before the first application-code batch, register TypeScript (and relevant JSON/CSS) diagnostics through `webdev.config` and confirm the registration. Before the first dev-server start, create `public/manus-routes.json` listing all page routes (not APIs/assets), then keep it synchronized. Start the server on the configured port 3000 and confirm it responds. Validate code/build and the route manifest, resolve confirmed defects, and conduct one read-only requirements review. Prepare the site wordmark/logo as a durable HTTPS asset and place its literal URL in project-root `app.config.ts` before checkpointing. Commit/push the finished project to the canonical managed project history and confirm its checkpoint; leave public deployment off unless requested.
