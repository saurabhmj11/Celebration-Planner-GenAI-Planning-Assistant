# ✨ Celebration & Event Planner

> **A GenAI-powered planning assistant** that helps users organize **weddings 💍, birthdays 🎂, and community events 🤝** with **budgets, timelines, vendor checklists, and personalized AI ideas** — built on Next.js 16, TypeScript, and Tailwind CSS 4 with a server-side GLM engine (z-ai-web-dev-sdk) and a triple-tier AI fallback.

---

## 🎯 Problem Statement Alignment

Planning a celebration is fragmented: budgets live in spreadsheets, vendors in chat apps, tasks in notebooks, and creative ideas on scattered Pinterest boards. **Celebration & Event Planner** unites the entire lifecycle in a single, high-fidelity web application:

| Problem Requirement | Delivered |
|---|---|
| GenAI-powered planning assistant | **Seven live GenAI capabilities across every module** via `/api/ai/themes` + `/api/ai/assist` (z-ai-web-dev-sdk / GLM): AI Theme Studio, Budget Copilot, Milestone Planner, Vendor Advisor & inquiry drafts, **AI Venue Finder venue scout (with a deterministic recommendation algorithm + interactive photo map)**, Plan Review, and the floating Planning Assistant chat |
| Weddings · Birthdays · Community events | Type-aware presets, per-type hero gradients, tailored sample blueprints for each of the three event categories |
| Budgets | Smart budget planner with 8 expense categories, allocated-vs-spent math, live over-budget warnings, per-guest cost analytics |
| Timelines | Phased milestone timeline (3+ months → day-of → wrap-up) with urgency badges, completion tracking, and **type-aware starter checklists** — every new celebration seeds a per-type milestone plan dated for the event date, and changing the celebration type offers a one-click timeline rebuild (6 dedicated checklists: wedding, birthday, anniversary, community, gala, baby shower) |
| Vendor checklists | Vendor directory with pipeline statuses, contact shortcuts, committed-cost ledger, category filters |
| Personalized ideas | AI Theme Studio: 3 tailored concepts per generation, one-click "Apply to Event" writes palette + decor milestones |

---

## 🌟 Key Features

### 1. Multi-Event Command Center
- Specialized presets for Weddings, Milestone Birthdays, and Community Events, each with distinct visual theming.
- Concurrent celebration switcher, duplication, deletion, JSON export/import, and reset-to-samples.
- Live countdown banner with per-type gradient heroes (rose/fuchsia weddings · violet birthdays · emerald community).

### 2. Smart Budget Planner
- Real-time math for **Total Budget / Allocated / Spent / Remaining** with instant over-budget alerts.
- 8 core expense categories, category distribution chart, per-guest investment metric, paid/pending toggles.

### 3. Phased Timeline & Milestones
- 5 structured planning phases from early planning to post-event wrap-up.
- Color-coded due-date urgency (Overdue / Due Today / Due Soon), priority filters, confetti on completion.

### 4. Vendor Directory & Pipeline
- Stage-based pipeline (Researching → Contacted → Quoted → Deposit Paid → Booked).
- Committed-cost roll-up, category filters, inline status changes, click-to-contact links.

### 5. AI Theme Studio (GenAI)
- Enter a vibe → receive **3 personalized theme concepts**, each with a 4-swatch palette, decor highlights, music direction, catering ideas, and a budget tip.
- One-click **Apply to Event** writes the theme palette and injects 4 decor milestones into the timeline.
- **Triple-tier resilience**: built-in server GLM engine → optional user-supplied Gemini key → instant curated offline engine. The app never fails closed.

### 6. AI Everywhere — six more GenAI copilots
- **AI Budget Copilot** (Budget tab): a personalized allocation plan with % bars, dollar amounts and saving tips — applicable as real budget lines in one click.
- **AI Milestone Planner** (Timeline tab): drafts a full task plan sized to the real runway (dates clamped to the event date), previewed with per-task checkboxes before anything is saved.
- **Type-aware starter timelines** (`src/lib/planning/starterPlan.js`): creating a celebration seeds a per-type milestone checklist dated for the event date (deterministic + offline-safe, reusing the Smart Offline Planning Engine's compressed templates); editing an event's celebration type surfaces a rebuild prompt so the plan always matches the type — with an explicit opt-out that preserves existing tasks.
- **AI Vendor Advisor** (Vendors tab): vendor-gap analysis with realistic cost ranges, the six must-ask questions, one-click "add as vendor rows", and AI-drafted outreach emails per vendor with copy-to-clipboard.
- **AI Plan Review** (Dashboard): a 0–100 readiness audit — strengths, risks, and prioritized next actions computed from the real budget, task and vendor data.
- **AI Planning Assistant** (floating, every tab): a context-aware chat that knows the active event's budget, runway, tasks and vendors, with suggested follow-ups and multi-turn memory.

### 7. AI Venue Finder (GenAI + recommendation algorithm + map) 🗺️
- **Deterministic recommendation algorithm** (`src/lib/venues/recommender.ts`, pure & unit-tested) ranks **16 curated venues** for the active event with a weighted multi-factor score: event-type affinity (30%), capacity fit with overflow warnings (22%), budget-fit against a configurable venue budget slice (22%), style preference matching (16%, adaptive up to 28% when the user states an explicit wish), and rating boost (8%) — every score shows its factor breakdown on the card, so nothing is a black box.
- **Natural-language preference parsing**: type "a lakeside hotel resort near the water" and the parser expands keyword synonym families (lake → lakeside/waterfront/marina/beach…) into matchable concepts; matching venues light up on the map while non-matches dim.
- **Interactive venue map** (Leaflet + OpenStreetMap, no API key): every pin embeds the venue's real photo; hovering a pin opens an image card (photo, match %, estimated cost, warnings), clicking selects the venue and syncs the card list; hovering a card enlarges its pin.
- **Photo galleries on hover**: each venue card reveals its 2-photo gallery with quick facts and actions on hover (and on keyboard focus — fully accessible).
- **Live GenAI venue scout** (`venue-recommend` task): the algorithm's top-5 shortlist is sent to the server GLM engine, which writes a personalized why-it-fits rationale, a per-venue negotiation tip and three booking tips — grounded, because the normalizer drops any hallucinated venue id that wasn't in the shortlist.
- **Booking writes the plan**: one click sets the event location and venue fields, adds the venue as a vendor row, and creates the matching budget line — venue, budget and vendor tabs update instantly.
- **Booking flow integration**: while creating a new event, the modal's "Smart venue matches" panel re-ranks 3 live suggestions as you change celebration type, guest count or budget; picking one auto-fills the location and persists the venue + estimated cost on the event.

---

## 🤖 GenAI Services Utilized (and where)

| Service | Where it is used |
|---|---|
| **z-ai-web-dev-sdk (GLM, server-side only)** | `src/app/api/ai/themes/route.ts` — AI Theme Studio (strict-JSON theme concepts, per-event personalization, single-retry on malformed output) · `src/app/api/ai/assist/route.ts` — the unified assist engine powering **seven capabilities**: `budget-plan`, `timeline-plan`, `vendor-plan`, `vendor-inquiry`, `venue-recommend` (AI Venue Finder's live venue scout — grounded on the algorithm's shortlist, hallucinated venue ids are dropped), `plan-review`, `assistant-chat` |
| **Google Gemini API (optional, BYO key)** | `src/services/geminiService.js` — users can plug their own Gemini key in AI Settings; the app calls it directly from the server layer |
| **Smart Offline Planning Engines** | `src/services/assistOffline.js` + curated theme catalog — parameter-driven fallbacks for every AI surface when live generation is unavailable, so no AI panel ever fails closed |
| **ZAI Image Search (venue photography)** | Real venue photos sourced via the ZAI image-search service and bundled as compressed WebP galleries + map pins in `public/venues/` (2.4 MB total) |
| **Venue recommendation algorithm (deterministic)** | `src/lib/venues/recommender.ts` — explainable multi-factor scoring (event-type fit, capacity, budget, style synonyms, rating) over the 16-venue curated catalog (`src/data/venues.js`); feeds the GenAI shortlist so recommendations are grounded, testable and never hallucinated |
| **Leaflet + OpenStreetMap (no API key)** | `src/components/venues/VenueMap.jsx` — interactive map with photo pins, hover image popups, preference dimming and selection sync |

The AI service is **never called from the client**; all GenAI traffic flows through validated server routes.

---

## 🏗️ Architecture & Tech Stack

```
Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui patterns
React 19 · Lucide icons · canvas-confetti · localStorage persistence
Server routes: /api/ai/themes + /api/ai/assist → z-ai-web-dev-sdk (GLM)
```

- **`src/lib/ai/`** — `jsonExtractor.ts` (fence-stripping + balanced-brace LLM output parser), `themeNormalizer.ts` (strict normalization of untrusted AI output), `assist/tasks.ts` (prompt builders + normalizers for the six assist capabilities), `engine.ts` (injectable LLM seam).
- **`src/lib/security/`** — `rateLimit.ts` (in-memory sliding-window limiter), `sanitize.ts` (control-char stripping, length caps, date validation).
- **`src/lib/validation/`** — Zod schemas for every request body.
- **`src/utils/calculator.js`** — pure, fully-tested budget/timeline/vendor math.

---

## 🛡️ Security

- **Layered API hardening**: method allowlist → per-client rate limiting (8 req/min, `429 + Retry-After`) → 50KB payload cap (`413`) → strict Zod validation (`400` with field map) → prompt-bound sanitization (control chars, zero-width & bidi injection chars stripped) → response normalization before the client sees anything.
- **No secrets in the client**: the GenAI SDK runs server-side only; an optional user Gemini key is stored client-side by the user's own choice.
- **Hardened import pipeline**: JSON backups are size-capped, count-capped, field-normalized, and control-char-stripped before touching app state.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) applied to every response.
- **No `dangerouslySetInnerHTML`**, no eval, no raw stack traces in error responses.

## ♿ Accessibility (WCAG 2.1)

- **Skip-to-content link**, semantic landmarks (`header` / `main` / `footer` / `nav` / `section`).
- **All interactive stat cards are real `<button>`s** with descriptive `aria-label`s (previously clickable divs).
- **Modal dialogs**: `role="dialog"`, `aria-modal`, `aria-labelledby`, shared **focus-trap + Escape-close + focus-restore** hook (`useModalFocus`).
- **Keyboard-complete navigation**: dropdowns close on Escape and restore focus; all controls expose visible `focus-visible` rings.
- **`prefers-reduced-motion`** respected globally; decorative icons hidden from screen readers; progress bars announce `role="progressbar"` values.
- Sticky footer with mobile safe-area insets.

## ⚡ Efficiency

- `React.memo` on hero/stat cards/dashboard, `useMemo` for derived metrics, and a **memoized context value** so consumers only re-render on real state changes.
- **Lazy-loaded** heavy print/summary surface via `next/dynamic` with a loading state.
- Optimistic local-first persistence (localStorage) — instant UI, zero network on the critical path.

## 🧪 Testing — 170 tests, all passing

```bash
bun test        # 170 unit + integration tests across 14 suites
bun run lint    # ESLint (Next.js + TypeScript rules)
```

Coverage includes:

| Suite | What it locks down |
|---|---|
| `tests/budget.test.ts` | Budget math, over-budget flags, string-number coercion, zero-division guards |
| `tests/timeline.test.ts` | Progress stats, urgency bands with deterministic reference dates, calendar-overflow rejection |
| `tests/vendor.test.ts` | Booked counting (booked + deposit_paid), cost aggregation, negative-value immunity |
| `tests/api/themes-route.test.ts` | **Full AI route pipeline** via an injected fake engine: happy path, retry-on-malformed, upstream failure, 400/413/429, per-client rate limits, stack-trace leak prevention |
| `tests/api/assist-route.test.ts` | **All seven assist tasks** through the full pipeline: per-task happy paths, normalization (percent rescale, date clamping, score clamping, venue-id anti-hallucination), 400/405/413/429, retry-on-garbage, stack-leak prevention |
| `tests/venues/recommender.test.ts` | **Venue recommendation algorithm**: cost estimation (base + per-guest + fee), capacity overflow warnings, budget falloff, NL synonym parsing ("hotel resort near the lake" → lakeside resorts), concept-level style matching, adaptive weights, deterministic ranking, catalog integrity, and the exact user stories the feature promises |
| `tests/ai/assistOffline.test.ts` | Smart Offline Engines: allocation sums, date-window safety, category-overlap exclusion, coordinator fallback, score bounds, venue-scout rationale + over-budget flags, chat intent routing |
| `tests/ai/*` | LLM JSON extraction (fences, prose, escapes), theme normalization (hex repair, control-char stripping, list caps) |
| `tests/security/*` | Rate limiter (allow/block/reset/per-client), sanitization helpers |
| `tests/storageService.test.ts` | Persistence resilience + hostile-import rejection |
| `tests/geminiService.test.ts` | Every AI failure mode maps to an actionable user diagnostic |

---

## 🚀 Getting Started

```bash
# 1. Install
bun install        # or npm install

# 2. Run the dev server
bun run dev        # or npm run dev

# 3. Open http://localhost:3000

# 4. Run the test suite
bun test
```

The app ships with rich sample celebrations (a wedding, a birthday, a community festival) so every feature is explorable instantly. All planning data persists in your browser's localStorage — export a JSON backup anytime from the header.

---

## 📸 Feature Walkthrough

1. **Dashboard** — countdown hero, KPI stat cards, quick actions, budget distribution, upcoming milestones.
2. **Budget Planner** — category ledger with allocated vs spent, over-budget alerts.
3. **Timeline & Tasks** — phased milestones, urgency badges, completion confetti.
4. **Vendor Checklist** — pipeline stages, committed costs, contact shortcuts.
5. **AI Theme Studio** — generate personalized GenAI concepts and apply them to your event in one click.
6. **Summary Sheet** — printable master plan with export/import.

---

Made with 💜 for celebrations.
