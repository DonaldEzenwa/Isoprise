# Isoprise

**Isoprise — Your AI-Powered Career and Employability Companion.** From discovering opportunities and acquiring skills to building your professional profile and finding employment, Isoprise brings your entire career development journey into one platform.

Isoprise is a 3MTT x Meta capstone for young Nigerians overcoming barriers to digital education—not a commercial job board.

## Our three principles

- **ACCESS:** Help people discover free and affordable learning opportunities, scholarships and funded programmes.
- **DEVELOPMENT:** Help people assess their abilities, identify skill gaps and develop professionally.
- **EMPLOYABILITY:** Help people build competitive professional profiles, prepare quality CVs and discover legitimate employment opportunities.

## Product journey

Register → build a career profile → take the adaptive 15-question assessment → discover verified scholarships → learn → build an ATS-ready CV from Profile Intelligence → check job readiness → find jobs → track applications.

## Stack

Next.js 14 App Router, TypeScript, Tailwind CSS, local shadcn-style accessible UI primitives, Supabase Auth/Postgres/Storage, Groq through the Vercel AI SDK, Tavily with SerpAPI fallback, Recharts, `docx`, `@react-pdf/renderer`, `pdf-parse`, `mammoth`, and Tesseract.js for image OCR where supported.

## Production container and runtime configuration

The root `Dockerfile` performs a clean install with the pinned `pnpm@11.25.0`, builds the Next.js application, and runs the existing production start script. The listener binds to `0.0.0.0`, honors `PORT`, and defaults to 3000; `/api/health` is a dependency-free, unauthenticated readiness endpoint. The image does not copy `.env` or bake protected values into the build. The browser obtains only the Supabase project URL and anon/publishable key from same-origin `/api/client-config` at runtime; the service-role key remains server-only.

## Local development

1. Install dependencies using the package manager pinned in `package.json`.
2. Provide Supabase, Groq, Tavily and SerpAPI variables through a protected environment store; never commit real values. `.env.example` contains fake placeholders only.
3. For a new Supabase project, review and apply `202610300001_initial_schema.sql`. For an existing project with the core tables already created, apply only the idempotent additive `202610310001_verification_fields.sql` migration; do not rerun the initial `CREATE TABLE` migration. It adds the official verification evidence and date fields required by the jobs and learning caches, adds `reported_opportunities.report_status`, and maps legacy report states without deleting records.
4. Run `pnpm dev` and open the app at port 3000. The app uses real Supabase authentication; it does not invent a Preview user.

Google and GitHub sign-in require their respective providers to be enabled in Supabase Auth settings. The app displays each provider button only when `/api/status` confirms it is enabled; email/password sign-in remains available otherwise. Public data discovery and AI features report provider availability through `/api/status`. When keys or required provider configuration are missing, the app shows DEVELOPMENT MODE and any mock content is labeled exactly `DEMO DATA - Connect API keys for live results`; mock content is never presented as live or verified.

Current environment note: Supabase Auth, the private `career-documents` bucket, and both Google and GitHub Auth providers are reachable/enabled. The existing `jobs_cache` and `learning_resources_cache` are missing verification-evidence/date fields, and the existing report table has a legacy `status` column rather than `report_status`. The additive migration adds the expected fields and maps known legacy report states. Until it is applied, `/api/status` reports `schema_ready: false` and the dashboard remains in DEVELOPMENT MODE. The managed project does not have a database password or Supabase management token for applying external DDL automatically.

## Trust and scoring

Opportunity verification is based only on an official-domain match or an application portal explicitly linked from the organization’s official site. A discovery whitelist alone is not verification. Only an `admin_users` administrator can mutate shared verification state; signed-in users can report questionable listings. The Overview does not present bounded saved-item counts as complete. Readiness is an estimated skills match, not a prediction of hiring success; the full disclaimer appears beside every score.

## Project notes

See [`plan.md`](./plan.md) for the implementation architecture and [`TODO.md`](./TODO.md) for the requirement-preserving scope. Checkpoint creation and production publication are separate states; report a production URL only after successful publication is confirmed.
