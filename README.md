# StudyPulse Web

Browser client for StudyPulse, served at **https://app.pulsestudios.app**.

Static Vite + React + TypeScript SPA, deployed to GitHub Pages by GitHub Actions. It talks to the
same Supabase project (Auth + RLS, anon key only) and the same Railway API as the phone app. There is
no server of its own and **no service-role key anywhere**.

Scope so far: sign-in / sign-up / password reset, library list, plan + minutes, settings (slice 1);
result viewer with media playback, transcript, summary, flashcards, quiz, chat, mind map and share
links (slice 2). Not on the web: recording, uploads, focus music, purchases (billing shows the plan and
"Manage on your phone"), spaced-repetition review (`/review` is a stub).

## Develop

```bash
npm ci
cp .env.example .env.local   # fill in the public values
npm run dev                  # http://localhost:5173
```

Local dev reaches Railway through the Vite proxy (`VITE_BACKEND_URL=/backend`), so the backend needs
no `localhost` CORS entry. Supabase auth redirects need `http://localhost:5173/auth/callback` and
`http://localhost:5173/auth/reset` in the Supabase redirect allow-list.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc -b` (app, tests, tooling) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest: auth callback parsing, next-path sanitizing, pagination/search, plan math, privacy scrubbing, CSP, token drift |
| `npm run build` | Typecheck + production build to `dist/` (fails if required `VITE_*` vars are missing) |

## Configuration

All config is **public** and compiled into the bundle (same posture as `pulsestudios.app/upload`):
Supabase URL + anon key, Railway URL, the `x-app-key` value, PostHog project key, Sentry DSN.
See [.env.example](.env.example). CI reads them from GitHub **repository Variables** (not Secrets).

## Routes

| Path | Auth |
| --- | --- |
| `/auth/sign-in`, `/auth/sign-up` | public (redirects to the app if signed in) |
| `/auth/reset` | public — request a reset link, or set a new password when opened with `?code=` |
| `/auth/callback` | public — Google OAuth + email-confirmation landing (PKCE code exchange) |
| `/library`, `/settings`, `/results/:id`, `/review` | session required |

## Result viewer (`/results/:id`)

Desktop: media player + transcript on the left, study tabs (`#summary`, `#flashcards`, `#quiz`,
`#chat`, `#mindmap`) on the right; under 960px everything stacks and the transcript becomes a tab.

- **Row** — one `saved_results` row via RLS with an explicit column list (`src/results/resultParse.ts`);
  every JSON column is parsed per element with the phone's tolerances (string `correctIndex`,
  `sub_branches`, null columns, empty-segment synthesis).
- **Media** — `source_media_uri` is classified (`recording://`, `uploads/…` key, persisted storage URL,
  phone-local path, YouTube) and signed directly with Supabase Storage for an hour, like the phone.
  Phone-local files show "Audio is on your phone". YouTube plays in a `youtube-nocookie.com` iframe
  driven over the IFrame API postMessage protocol — no YouTube script is loaded (CSP stays
  `script-src 'self'`).
- **Transcript** — grouped bubbles, speaker colours, `m:ss` timestamps that seek the player, active
  bubble + karaoke word highlighting from `word_timings` (phone math, copied in `src/shared`).
- **Generation** — same `POST /v1/…` endpoints and bodies as the phone; plan gates are the server's
  403s plus the phone's tab copy. Generated quiz, flashcards, mind map and regenerated summary are
  written back to the row (`persist*` in `generationApi.ts`) so phone and web read the same data.
- **Chat** — `POST /v1/chat`, non-streaming; hydrated from `conversation_history` (server-written,
  client writes are reverted by a trigger). The free limit is the server's `CHAT_LIMIT_REACHED`.
- **Share** — `POST /v1/shares` (summary / flashcards / quiz), URL copied to the clipboard.

Auth is Supabase PKCE with `detectSessionInUrl: false`; the callback/reset pages exchange the code
explicitly. PKCE means a reset or confirmation link must be opened **in the same browser** that
requested it.

Sign-out is local to this browser (the phone stays signed in) and clears the query cache, analytics
identity, Sentry user, every `studypulse.web.*` storage key (except the analytics opt-out preference)
and sessionStorage, then hard-navigates to `/auth/sign-in`.

## Data sources (mirrors the phone)

- **Library** — `saved_results` via RLS: `user_id = me`, `deleted_at is null`, `order created_at desc`,
  offset pages of 50 (`SAVED_RESULTS_PAGE_SIZE`). Leaner select than the phone (no transcript/quiz).
  Title search is server-side `ilike` with LIKE metacharacters escaped.
- **Plan + minutes** — the user's `profiles` row via RLS; if the billing cycle has ended the app calls
  `POST /v1/profile/billing-cycle/ensure` first (same as the phone), then computes plan/limit/used with
  the copied `profilePlan.ts` + `billingCycle.ts`.

## Code copied from the phone app

`src/shared/*` are copies from `pulsestudios-app/StudyPulse` (branch `launch-ota`, the client source of
truth). Each file's header names the source path and commit. There is deliberately no monorepo
coupling — when the phone changes plan logic, types, theme tokens or the privacy denylist, re-copy the
file and bump the header. `src/styles/tokens.test.ts` fails if `tokens.css` drifts from `shared/theme.ts`.

## Privacy

- **PostHog**: same project and posture as the phone — no autocapture, pageviews, replay or surveys;
  identified-only person profiles keyed by the Supabase user id (never email); the phone's property
  denylist. Web additions: `before_send` strips query strings/fragments and redacts ids in URL
  properties, remote config/flags disabled, no external scripts, Do Not Track respected, `platform: web`
  on every event. Events: `web_session_started`, `web_sign_in {method}`. Opt-out lives in Settings.
- **Sentry**: the phone's project with `environment: web`; `sendDefaultPii: false`, 20% traces, the
  phone's scrubber plus URL/query redaction for requests, breadcrumbs, spans and exception messages.
  `tracePropagationTargets: []` so no tracing headers are sent to Supabase/Railway.
- **CSP** is injected as a `<meta>` tag at build time (`tooling/csp.ts`): scripts from self only;
  connections only to Supabase, Railway, PostHog and Sentry; images from self + `img.youtube.com`.

## Deploy

Push to `main` → Actions runs typecheck, lint, tests, build, then deploys `dist/` to GitHub Pages.
Pull requests run the same checks without deploying. `dist/404.html` is a copy of `index.html` so deep
links work on Pages.

The custom domain is configured in the repo's Pages settings (`app.pulsestudios.app`). `public/CNAME`
records it too, but for Actions-based deployments GitHub uses the Pages setting, not the file.

DNS (Cloudflare): `CNAME app → pulsestudios-app.github.io`, **DNS only** (grey cloud) so GitHub can
issue the TLS certificate. Enable "Enforce HTTPS" in Pages settings once the certificate is issued.

The Railway backend must allow the origin `https://app.pulsestudios.app` in CORS (StudyPulse repo,
`railway/backend/src/app.ts`). Until it does, backend calls from the browser fail; the library and plan
display still work because they read Supabase directly.
