# ✨ Celebration & Event Planner

> **An enterprise-grade, GenAI-powered planning platform** that helps users organize **weddings 💍, birthdays 🎂, and community celebrations 🤝** with **intelligent budgets, timelines, vendor directories, guest & seating management, day-of run sheets, photo memory walls, and an autonomous multi-agent workforce** — built on Next.js 16, TypeScript, and Tailwind CSS 4 with a server-side GLM engine (`z-ai-web-dev-sdk`), triple-tier fallback resilience, and 531 automated tests.

[![Live Demo](https://img.shields.io/badge/Live_Demo-ecpsl.space--z.ai-7c3aed?style=for-the-badge&logo=vercel&logoColor=white)](https://ecpsl.space-z.ai/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/saurabhmj11/Celebration-Planner-GenAI-Planning-Assistant)

🔗 **Live Deployment**: [https://ecpsl.space-z.ai/](https://ecpsl.space-z.ai/)  
📂 **Source Code**: [https://github.com/saurabhmj11/Celebration-Planner-GenAI-Planning-Assistant](https://github.com/saurabhmj11/Celebration-Planner-GenAI-Planning-Assistant)

---

## 🎯 Problem Statement Alignment

Planning life's milestone celebrations is traditionally fragmented: budgets live in complex spreadsheets, vendor contracts in email chains, guest lists in messaging apps, day-of cues in frantic notebooks, and ideas scattered across Pinterest boards. **Celebration & Event Planner** consolidates the entire celebration lifecycle into a cohesive, high-fidelity command center:

| Problem Requirement | Delivered Solution |
|---|---|
| **GenAI-Powered Planning Platform** | **12+ unified GenAI copilots** across every workflow via `/api/ai/themes` & `/api/ai/assist` (powered by `z-ai-web-dev-sdk` / GLM) plus **Agent Force** (an autonomous 4-agent specialist workforce) and a natural-language **AI Event Intake Prompter**. |
| **Weddings · Birthdays · Community Events** | Type-aware presets, per-type hero styling, dynamic Celebration Mood Engine, and tailored starter blueprints for each of the core event categories. |
| **Intelligent Budgets & Payments** | Real-time expense ledger across 8 categories, allocated vs. spent math, live over-budget warnings, per-guest seat investment metrics, **multi-currency conversion (7 currencies)**, and a **scheduled payment milestone ledger** with overdue detection. |
| **Timelines & Day-Of Coordination** | Phased milestone timeline (3+ months → day-of → wrap-up) with urgency badges, completion tracking, **type-aware starter checklists**, and a **minute-by-minute Day-Of Run Sheet** with an MC/vendor print mode. |
| **Vendor Directory & Quote Comparison** | Pipeline stages (Researching → Booked), committed-cost tracking, AI vendor gap advisor, AI-drafted inquiry emails, and **cross-vendor Quote Comparison** with best-value highlighting. |
| **Personalized Creative Ideas** | **AI Theme Studio** with 3 tailored concepts per prompt (palettes, decor, catering, music) with one-click timeline integration, plus an interactive **Visual Mood Board** supporting color swatches, images, and notes. |
| **Guest List, Invitations & Seating** | Full RSVP pipeline, AI-written printable invitations, `.csv` import/export, RFC-5545 `.ics` calendar generation with deadline alarms, and an **intelligent Seating Chart** with capacity meters and party-cohesion auto-arrange. |
| **Photo Sharing & Memories** | **Event Photo Memory Wall** with story albums, canvas downscaling, lightbox viewer, and a **public guest photo upload portal** via link/QR code at `/album/[token]`. |

---

## 🌟 Key Features

### 1. Multi-Event Command Center & Mood Engine
- Specialized blueprints for Weddings, Milestone Birthdays, and Community Events.
- **Celebration Mood Engine**: The entire UI morphs dynamically based on celebration type, booked-venue vibe, or applied AI theme — adapting hero gradients, mood indicators, and card accents.
- Live countdown hero, quick action launcher, concurrent celebration switcher, JSON import/export, and local-first persistence.

### 2. Natural Language AI Event Intake Prompter
- Inside the "New Celebration" modal, users can simply describe their celebration in free-form natural language (e.g., *"Sunset garden wedding for 140 guests on July 18 at Rosewood Botanical with a $45k budget and live band"*).
- The AI extractor detects title, type, date, time, guest count, budget, location, and vibe, pre-filling every form field with visual AI provenance chips.
- Automatically generates custom milestones and a balanced budget allocation ready to apply on save.

### 3. Agent Force — Autonomous Multi-Agent Workforce
- An integrated AI workforce comprising 4 specialist agents:
  - 🪑 **Seating Strategist**: Optimizes guest placement into tables while preserving party cohesion and respecting capacity limits.
  - 💳 **Payment Controller**: Analyzes booked vendors and drafts a structured milestone payment schedule with deposit and balance dates.
  - 🎬 **Day-Of Producer**: Generates a chronological, minute-by-minute run sheet anchored to event load-in and headliner moments.
  - 🛡️ **Plan Auditor**: Conducts an end-to-end readiness audit (0–100 score) surfacing critical risks, strengths, and recommended next actions.
- Features a mission-control dashboard with one-click **Deploy Force**, a real-time activity feed, and persistent run history logs.

### 4. Smart Budget Planner & Multi-Currency Engine
- Real-time calculations for **Total Budget / Allocated / Spent / Remaining** with visual over-budget warnings.
- **AI Budget Copilot**: Tailored percentage-based allocation plans with one-click conversion into real budget ledger lines.
- **Multi-Currency System**: Instant display conversion across 7 world currencies (USD, EUR, GBP, INR, JPY, CAD, AUD) with configurable exchange rates and zero-decimal currency formatting.

### 5. Day-Of Workbench (Run Sheet, Seating & Payments)
- **Minute-by-Minute Run Sheet**: Chronological cue list with status toggles, vendor/owner tags, and a dedicated **Print Portal** (`body.printing-runsheet`) formatting the cue table for event coordinators and MCs.
- **Seating Chart**: Interactive table manager with weighted party sizing (+plus-ones), unseated pool, live capacity gauges, and deterministic party-aware auto-arrangement.
- **Payment Ledger**: Structured cash flow tracker categorizing deposits, milestones, and final balances, featuring an overdue alerts banner and next-due countdowns.

### 6. Guest Management, AI Invitations & RSVP Pipeline
- Comprehensive guest directory tracking party sizes, attendance status, dietary/meal requirements, and table assignments.
- RSVP urgency chase banner highlighting impending response deadlines.
- One-click CSV roster import/export and RFC-5545 `.ics` calendar invitation download with automated reminders.
- **AI Invitation Studio**: Crafts customized, tone-aware invitation copy styled with the event's theme palette, complete with copy-to-clipboard and print-ready card view.

### 7. AI Venue Finder (Recommendation Algorithm + Map) 🗺️
- **Deterministic Recommendation Engine** (`src/lib/venues/recommender.ts`): Scores 16 curated venues across 5 weighted factors: event-type affinity (30%), capacity fit (22%), budget fit (22%), style matching (16%), and rating boost (8%).
- **Natural-Language Preference Parser**: Matches natural phrases (*"a lakeside resort with sunset views"*) to synonym concept families, dynamically highlighting matches and dimming non-matches.
- **Interactive Venue Map**: Powered by Leaflet & OpenStreetMap (zero external API keys) with custom photo pins, hover previews, and two-way card synchronization.
- **AI Venue Scout**: Server-side GLM analysis providing grounded rationale, negotiation strategies, and booking recommendations without hallucinated venues.
- One-click booking writes the venue directly into the location, vendor directory, and budget ledger.

### 8. Event Photo Memory Wall & Public Contributor Portal
- **Photo Wall**: Client-side story albums (Planning, Ceremony, Reception, Candids) with storage budget meters, favorite pins, and a full-screen lightbox with caption editing.
- **Public Guest Upload Portal (`/album/[token]`)**: Hosts generate a shareable link/QR code allowing attendees to upload photos directly from mobile devices without requiring user accounts.
- **Host Inbox Sync**: Hosts review incoming guest photos and collect them onto the wall with automated client-side downscaling and uploader attribution.

### 9. Productivity, Navigation & Visual Polish
- **Command Palette (`⌘K` / `Ctrl+K`)**: Rapid navigation across all 13 tabs, quick celebration switching, instant actions, and deep search across guests, vendors, tasks, and expenses.
- **Global Undo/Redo Engine (`Ctrl+Z` / `Ctrl+Shift+Z`)**: 50-step snapshot history stack covering all edits, reset actions, and AI plan injections.
- **Proactive Automated Reminders Engine**: Navbar notification bell surfacing urgent deadlines, overdue payments, and countdown milestones with one-tap "Go fix it" jumps and snooze controls.
- **System-Wide Dark Mode**: Polished dark theme inversion layer with night-mode map tiles and print-media protection.
- **Progressive Web App (PWA)**: Production service worker with offline shell caching, web app manifest, and multi-resolution maskable app icons.

---

## 🤖 GenAI Services & AI Architecture

The application implements a strict **server-only GenAI boundary** — API keys and upstream SDKs are never exposed to the client.

| Service / Engine | Implementation & Purpose |
|---|---|
| **`z-ai-web-dev-sdk` (GLM Server Engine)** | Core backend engine powering `/api/ai/themes` and the unified `/api/ai/assist` orchestrator. Serves 12 distinct task types: `themes`, `budget-plan`, `timeline-plan`, `vendor-plan`, `vendor-inquiry`, `venue-recommend`, `plan-review`, `assistant-chat`, `invitation-copy`, `seating-plan`, `payment-schedule`, `run-sheet`, and `event-intake`. |
| **Autonomous Agent Force** | Multi-agent coordination layer ([useAgentForce.js](file:///f:/war/src/hooks/useAgentForce.js)) dispatching 4 specialized tasks sequentially or on-demand, applying structured artifacts directly into plan state. |
| **Google Gemini API (Optional BYO Key)** | Optional client-configured direct integration ([geminiService.js](file:///f:/war/src/services/geminiService.js)) for users providing their own API keys. |
| **Smart Offline Planning Engines** | Comprehensive parameter-driven fallback engines ([assistOffline.js](file:///f:/war/src/services/assistOffline.js)) guaranteeing that every AI panel, copilot, and agent operates seamlessly even when offline. |
| **Deterministic Venue Algorithm** | Pure, test-covered recommendation engine ([recommender.ts](file:///f:/war/src/lib/venues/recommender.ts)) that pre-ranks options before LLM enrichment to ensure 0% hallucination rates. |
| **ZAI Image Search** | Sourced and optimized 32 high-resolution WebP photographs bundled locally in `public/venues/`. |

---

## 🏗️ Architecture & Tech Stack

```
Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
Prisma ORM & SQLite · cmdk · Leaflet & OpenStreetMap · Lucide Icons · canvas-confetti · next-themes
Server routes: /api/ai/themes · /api/ai/assist · /api/public/album · /api/public/rsvp · /api/sync
```

### Module Organization
- **`src/app/`**: Next.js App Router root layouts, public portals (`/album/[token]`, `/rsvp/[token]`), error boundaries, and API route handlers.
- **`src/components/`**: 13 primary feature directories:
  - `dashboard/` — Countdown hero, KPI stats, quick actions, budget charts.
  - `force/` — Agent Force command panel, live activity feed, run logs.
  - `budget/` — Expense ledger, category breakdowns, AI budget copilot.
  - `timeline/` — Phased milestone timeline, task filters, AI milestone planner.
  - `venues/` — AI Venue Finder, recommendation cards, Leaflet photo map.
  - `vendors/` — Vendor directory, inquiry generator, quote comparison modal.
  - `guests/` — Guest roster, RSVP metrics, CSV import/export, AI invitation studio.
  - `dayof/` — Run Sheet, interactive Seating Chart, Payment Ledger.
  - `gifts/` — Gift registry, guest claim workflows, priority filters.
  - `moodboard/` — Visual mood board with colors, images, and notes.
  - `photos/` — Photo memory wall, lightbox viewer, guest upload management.
  - `ai/` — AI Theme Studio, floating Assistant Chat, shared AI kit.
  - `export/` — Printable master plan summary.
  - `common/` — Two-tier Navbar, Command Palette, Dark Mode toggle, Reminders bell, Error boundaries.
- **`src/lib/`**: Pure functional modules for AI extraction, normalizers, rate limiters, security sanitizers, recommendation algorithms, seating logic, history stack, and reminder calculation.
- **`src/context/`**: React Context state management (`EventContext`, `CloudSyncContext`) providing centralized reactive updates, undo/redo tracking, and local-first persistence.

---

## 🛡️ Security & Red-Team Hardening

The application underwent rigorous red-team penetration testing and security hardening:

- **Pre-Parse Body Size Protection**: Custom `readCappedJsonBody` utility checks `Content-Length` headers and streams with hard byte limits (e.g., 416KB for photo uploads, 8KB for RSVPs) returning `413 Payload Too Large` before buffer exhaustion or JSON parsing can cause memory DoS.
- **Unspoofable Token-Keyed Rate Limiting**: In addition to client IP rate limits, public guest routes enforce per-token rate ceilings (e.g., 120 photo uploads/min, 40 RSVP lookups/min), mitigating X-Forwarded-For header spoofing attacks.
- **Concurrency & Race-Condition Queues**: Server-side capacity validation uses an in-process serial execution queue (`runExclusive`) to eliminate concurrency race conditions on capped collections (e.g., preventing album overflow beyond 60 photos during simultaneous burst uploads).
- **Guest SVG Execution Prevention**: Public photo contributions strictly enforce raster formats (JPEG, PNG, WebP, GIF), blocking SVG uploads entirely to eliminate SVG-based XSS vectors.
- **Strict Anti-Hallucination Normalization**: All GenAI outputs pass through strict Zod schemas and normalizers that clamp dates into event runways, rescale percentages to 100%, and discard ungrounded venue or guest IDs.
- **Security Headers**: Standard enforcement of `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.

---

## ♿ Accessibility (WCAG 2.1 AA)

- **Focus Management**: Reusable `useModalFocus` hook across all dialogs providing initial focus, tab containment focus traps, Escape-key dismissal, and previous element focus restoration.
- **Keyboard-Complete Navigation**: Full keyboard navigation across all 13 tabs, interactive Leaflet map pins, Command Palette (`⌘K`), and photo lightboxes (Arrow keys + Escape).
- **Semantic Structure**: Semantic HTML5 landmarks (`header`, `main`, `nav`, `section`, `footer`), descriptive `aria-labels` on interactive stat buttons, and live regions (`aria-live="polite"`) for real-time status updates.
- **Motion & Color Preferences**: Native support for `prefers-reduced-motion` and verified color contrast ratios in both light and dark modes.

---

## 🧪 Testing Suite — 531 Passing Tests

The test suite contains **531 automated unit, integration, and security tests** across 30+ suites:

```bash
bun test        # Runs all 531 tests across 30+ test suites
bun run lint    # ESLint verification with Next.js & TypeScript rules
```

| Test Suite | Coverage & Validation Highlights |
|---|---|
| `tests/security/attack-hardening.test.ts` | Memory DoS body caps (413), guest SVG upload bans, capacity concurrency race locks, and XFF token rate ceilings. |
| `tests/api/assist-route.test.ts` | All 12 GenAI assist tasks through the full mock pipeline (happy paths, normalizers, rate limits, 400/413/429 status codes, anti-hallucination). |
| `tests/api/themes-route.test.ts` | Theme generation pipeline, JSON repair regex, malformed output retry, and payload sanitization. |
| `tests/venues/recommender.test.ts` | 5-factor venue scoring, natural-language synonym parsing, overflow warnings, and budget share calculations. |
| `tests/planning/seating.test.ts` | Table auto-arrangement algorithm, party cohesion, weighted guest calculations, and capacity bounds. |
| `tests/planning/starterPlan.test.ts` | Type-specific starter checklists (all 6 event types), runway compression, and date-window clamping. |
| `tests/lib/reminderModel.test.ts` | Derived notification logic, urgency sorting, overdue payment detection, and snooze expiration. |
| `tests/lib/currencyModel.test.ts` | Exchange rate conversions, formatting standards, symbol representation, and zero-decimal currencies. |
| `tests/lib/historyStack.test.ts` | 50-state snapshot undo/redo stack, branch clearing, and history truncation. |
| `tests/lib/giftModel.test.ts` & `quoteModel.test.ts` | Gift claiming workflows, URL validation, and cross-vendor quote ranking. |
| `tests/photos/photoModel.test.ts` | File type allow-lists, SVG sanitation, canvas downscaling bounds, and storage estimation. |
| `tests/utils/exporters.test.ts` | RFC-4180 CSV export/import round-tripping and RFC-5545 `.ics` iCalendar formatting. |
| `tests/utils/dayofStats.test.ts` & `guestStats.test.ts` | Cash flow math, seating utilization, headcount calculations, and meal requirement sums. |
| `tests/ui/moodEngine.test.ts` & `palette.test.ts` | Theming precedence rules, venue vibe derivation, and command palette fuzzy matching. |
| `tests/budget.test.ts`, `timeline.test.ts`, `vendor.test.ts` | Core domain calculation math, division-by-zero guards, and string-number coercion. |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ or Bun 1.1+

### Installation & Local Run
```bash
# 1. Install dependencies
bun install        # or npm install

# 2. Start the development server
bun run dev        # or npm run dev

# 3. Open in your browser
http://localhost:3000

# 4. Run the full test suite
bun test
```

The application comes pre-loaded with comprehensive sample celebrations (a Wedding, a Milestone Birthday, and a Community Festival) so all 13 modules and AI features can be explored immediately.

---

## 🗺️ Application Walkthrough (13 Modules)

1. **Dashboard**: Live countdown hero with Celebration Mood theming, high-level KPI cards, budget distribution, and upcoming milestones.
2. **Agent Force**: Mission-control center to deploy 4 autonomous AI specialists (Seating, Payments, Run Sheet, Audit) with real-time activity streaming.
3. **Budget Planner**: Expense ledger across 8 categories with live allocated-vs-spent math, AI budget copilot, and multi-currency conversion.
4. **Timeline & Milestones**: 5 planning phases with urgency badges, completion confetti, type-aware starter checklists, and AI milestone drafting.
5. **AI Venue Finder**: 16-venue catalog with weighted recommendation scoring, natural language search, and an interactive Leaflet photo map.
6. **Vendors & Quotes**: Stage-based vendor pipeline, committed cost summaries, AI inquiry drafting, and cross-vendor quote comparison.
7. **Guests & Invitations**: Guest RSVP tracker, dietary needs, CSV import/export, `.ics` calendar generation, and the AI Invitation Studio.
8. **Day-Of Workbench**: Minute-by-minute run sheet with MC print mode, weighted table seating chart, and a scheduled payment milestones ledger.
9. **Gift Registry**: Item tracking with price, store link, guest claim workflows, and priority filters.
10. **Mood Board**: Creative visual scratchpad for color swatches, inspiration images, and planning notes with one-click theme seeding.
11. **Photo Memory Wall**: Story albums, client-side downscaling, lightbox viewer, and public guest QR/link photo upload portal (`/album/[token]`).
12. **AI Theme Studio**: Generates 3 personalized theme concepts based on vibe keywords, ready to inject into the plan's palette and timeline.
13. **Summary Sheet**: Comprehensive, print-optimized master plan with JSON export/import for local backup.

---

Made with 💜 for celebrations.
