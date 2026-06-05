# STRIKER Sales — Complete Project Setup Document
> Generated: 2026-06-05 | For AI handoff / onboarding

---

## 1. Project Overview

**STRIKER Sales** is a B2B sales intelligence CRM for selling STRIKER cavitation heating technology to hotels, laundries, wellness centers, hospitals, and restaurants — primarily in Germany, Austria, and Switzerland.

**Product being sold:**
- STRIKER heating unit: 45 kW electrical input → 120–160 kW thermal output (COP 2.7–3.5)
- Price: 8,000–10,000 EUR
- Delivery: 6–8 weeks
- Key pitch: 50–70% reduction in heating costs, ROI 6–36 months, BAFA subsidy possible in Germany
- Salesperson: Adolf Staubert, STRIKER Energy, +49 171 4758126, info@striker-energy.de

**Tech stack:**
- Frontend: React 18 + Vite (JavaScript, no TypeScript, no Tailwind — all inline styles)
- Backend: Netlify Functions (Node.js, CommonJS for functions)
- Database: Firebase Firestore (via SDK on frontend, via REST API in functions)
- Auth: Firebase Authentication (email/password)
- Deployment: Netlify
- Email sending: Resend API
- Email receiving: IONOS IMAP (imapflow + mailparser)
- AI: Anthropic Claude (claude-sonnet-4-6 for most, claude-haiku-4-5-20251001 for light tasks)
- External APIs: Google Places API v1, SerpAPI, Firecrawl, Apollo.io, Hunter.io

**Language:** UI and AI responses are in Slovak (sk). Emails to German clients are in German (de). Some fallback text is in German/English.

---

## 2. Repository Structure

```
striker-sales-clean/
├── src/
│   ├── App.jsx                    — Root component, auth guard, division routing
│   ├── firebase.js                — Firebase init (db, auth exports)
│   ├── main.jsx                   — Vite entry point
│   ├── index.css                  — Global styles (dark theme, IBM Plex Mono)
│   ├── components/
│   │   ├── Header.jsx             — Nav bar, division switch, user display
│   │   ├── LoginScreen.jsx        — Firebase email/password login form
│   │   ├── SearchPanel.jsx        — Google Places company search (Division A)
│   │   ├── Dashboard.jsx          — Division A CRM list view
│   │   ├── DashboardB.jsx         — Division B Intelligence list view
│   │   ├── CompanyCard.jsx        — Division A company row card
│   │   ├── CompanyDetailModal.jsx — Division A full company detail modal (153 KB)
│   │   ├── AgentPanel.jsx         — Autonomous agent trigger (Division A)
│   │   ├── AiSummaryPanel.jsx     — Division A stats summary bar
│   │   ├── AiProfilePanel.jsx     — Company AI profile panel (older gen)
│   │   ├── EmailDraftEditor.jsx   — Email composition + send UI
│   │   ├── NextBestAction.jsx     — NBA recommendation display
│   │   ├── ProgressBar.jsx        — Animated progress bar component
│   │   ├── IntelAgentPanel.jsx    — Division B intel-hunt trigger
│   │   ├── IntelSummaryPanel.jsx  — Division B stats summary bar
│   │   ├── IntelTargetCard.jsx    — Division B target row card
│   │   ├── IntelCompanyDetail.jsx — Division B detail panel (62 KB)
│   │   ├── ClientIntelligenceDashboard.jsx — Division B full cockpit (113 KB)
│   │   ├── IntelligenceDashboard.jsx       — Older gen intel dashboard (superseded)
│   │   └── IntelligenceEngine.jsx          — Older gen intel engine (superseded)
│   ├── services/
│   │   ├── firebaseService.js     — Firestore CRUD for Division A companies
│   │   ├── intelligenceService.js — intent_leads collection (UNUSED/legacy)
│   │   ├── intelTargetService.js  — Firestore CRUD for intelligence_targets (Div B)
│   │   ├── aiScoringService.js    — Calls /.netlify/functions/ai-score
│   │   ├── emailService.js        — Local email draft template generator
│   │   └── placesService.js       — Google Places helper (legacy, mostly replaced)
│   ├── utils/
│   │   ├── signalAnalysis.js      — Keyword signal detection engine (Phase 1A)
│   │   ├── calculateBusinessScore.js — BPS scoring algorithm (local)
│   │   ├── calculatePriorityLabel.js — Maps score to priority label
│   │   ├── normalizeCompanyData.js   — Normalizes Places API response
│   │   └── validateSearchInput.js    — Search input validation
│   ├── constants/
│   │   ├── companyStatuses.js     — Division A status list + colors
│   │   ├── companyTypes.js        — Company category definitions
│   │   ├── intelMeta.js           — Division B status list, segments, countries
│   │   └── scoringCriteria.js     — BPS scoring weights
│   └── locales/
│       ├── sk.js                  — Slovak UI strings
│       ├── de.js                  — German UI strings
│       └── en.js                  — English UI strings
├── netlify/
│   └── functions/
│       ├── package.json           — Functions dependencies (CommonJS)
│       ├── agent.js               — Autonomous 5-step sales pipeline
│       ├── ai-advisor.js          — Chat AI for company analysis
│       ├── ai-analysis.js         — Company analysis: score + email draft + NBA
│       ├── ai-score.js            — Simple BPS score via Anthropic SDK
│       ├── check-replies.js       — IONOS IMAP reply checker (3-layer matching)
│       ├── client-card.js         — Deep AI company profile generation
│       ├── crawl-signals.js       — Website crawler + keyword signal analysis
│       ├── energy-intel.js        — STRIKER FIT scoring via Claude
│       ├── enrich-contact.js      — Contact email enrichment (SerpAPI + Apollo)
│       ├── find-contacts.js       — Phase 1 contact discovery (native scrape)
│       ├── find-contacts-deep.js  — Phase 2 contact discovery (Firecrawl + Claude)
│       ├── find-email.js          — Simple email scraper from company website
│       ├── get-config.js          — Returns Firebase config (BROKEN)
│       ├── gmail-check.js         — Gmail OAuth reply checker (NOT CONFIGURED)
│       ├── hotel-photo.js         — Google Places photo URL resolver
│       ├── hunter-search.js       — Hunter.io domain-search CORS proxy
│       ├── intel-hunt.js          — Division B: Places search → score → save targets
│       ├── send-email.js          — Sends email via Resend, saves outbound record
│       ├── serpapi-reviews.js     — Live Google Maps reviews → Claude signal analysis
│       ├── serpapi-search-test.js — TEST FILE (should be deleted)
│       ├── signal-engine.js       — Claude 6-metric energy signal estimation
│       ├── translate-draft.js     — Translates email draft SK/DE/EN via Claude
│       └── translate-reply.js     — Translates SK reply draft → DE, saves to Firestore
├── netlify.toml                   — Build config, function timeouts
├── package.json                   — Frontend dependencies
├── vite.config.js                 — Vite config
└── .env                           — Local env vars (NOT committed to production)
```

---

## 3. Authentication

- Firebase email/password only
- Only 2 valid users are hardcoded in `App.jsx`:
  ```js
  const EMAIL_TO_USER = {
    'adolf@striker.local': 'Staubert',
    'sabo@striker.local':  'Szabo',
  }
  ```
- Any Firebase user with an email NOT in this map gets `currentUser = null` (shown login screen)
- Auth state guard in `App.jsx` prevents flash of content
- `seedKnowledgeBase()` is called on login to ensure knowledge_base collection has 7 STRIKER product entries

---

## 4. Two Divisions Explained

### Division A — Sales CRM
- Purpose: Find, score, contact, and track German companies
- Flow: Search → BPS Score → AI Analysis → Email Draft → Send → Monitor Replies
- Firestore: `companies` collection

### Division B — Intelligence
- Purpose: Hunt target companies, build deep intelligence profiles, find contacts
- Flow: Hunt (Places) → STRIKER FIT Score → Crawl Website → Signal Analysis → Contact Discovery → AI Profile → Email
- Firestore: `intelligence_targets` collection

The active division is switched via the Header. App.jsx routes to `<Dashboard>` (A) or `<DashboardB>` (B).

---

## 5. All Features and Status

### Division A Features

| Feature | Component / Function | Status |
|---------|---------------------|--------|
| Firebase Auth login | `LoginScreen.jsx` | ✅ Working |
| Google Places company search | `SearchPanel.jsx` | ✅ Working |
| Company list with filters and search | `Dashboard.jsx` | ✅ Working |
| BPS scoring (local algorithm) | `calculateBusinessScore.js` | ✅ Working |
| AI scoring via Claude Haiku | `ai-score.js` | ✅ Working |
| Company detail modal | `CompanyDetailModal.jsx` | ✅ Working |
| AI analysis (score + pain + draft + NBA) | `ai-analysis.js` | ✅ Working |
| Signal analysis on company cards | `signalAnalysis.js` + `crawl-signals.js` | ✅ Working (Phase 1C/D) |
| AI Advisor chat (per-company) | `ai-advisor.js` | ✅ Working |
| Email draft generation (local) | `emailService.js` | ✅ Working |
| Email draft generation via agent | `agent.js` step 4 | ✅ Working |
| Email composition and editing | `EmailDraftEditor.jsx` | ✅ Working |
| Send email via Resend | `send-email.js` | ✅ Working |
| Reply checking via IONOS IMAP | `check-replies.js` | ⚠ Working but needs IONOS creds in Netlify |
| Unread reply badge in toolbar | `Dashboard.jsx` | ✅ Working |
| AI analysis of incoming replies | `check-replies.js` → Claude | ✅ Working |
| SK→DE translation of reply draft | `translate-reply.js` | ✅ Working |
| Company status management | `Dashboard.jsx` + Firestore | ✅ Working |
| Notes per company | `CompanyDetailModal.jsx` | ✅ Working |
| Manual add contact | `Dashboard.jsx` | ✅ Working |
| Delete selected / delete all | `Dashboard.jsx` | ✅ Working |
| Autonomous agent pipeline | `AgentPanel.jsx` + `agent.js` | ✅ Working (max 5 companies/run) |
| Next Best Action | `NextBestAction.jsx` + `ai-analysis.js` | ✅ Working |
| Client card (deep AI profile) | `client-card.js` | ✅ Working |
| Signal engine (6 energy metrics) | `signal-engine.js` | ✅ Working |
| Live Google Maps reviews | `serpapi-reviews.js` | ⚠ Needs SERPAPI_API_KEY |
| Hotel photo from Google Places | `hotel-photo.js` | ✅ Working |
| Contact discovery Phase 1 (scrape) | `find-contacts.js` | ✅ Working |
| Contact discovery Phase 2 (Firecrawl+Claude) | `find-contacts-deep.js` | ⚠ Needs FIRECRAWL_API_KEY |
| Contact enrichment (email lookup) | `enrich-contact.js` | ⚠ Needs SERPAPI_API_KEY or APOLLO_API_KEY |
| Hunter.io email lookup | `hunter-search.js` | ⚠ User must provide their own Hunter API key |
| Email translate draft | `translate-draft.js` | ✅ Working |
| Knowledge base (seeded on login) | `firebaseService.js:seedKnowledgeBase` | ✅ Working |
| Task creation | `Dashboard.jsx:handleCreateTask` | ⚠ Writes to Firestore but NO task list UI |
| Gmail reply check | `gmail-check.js` | ❌ Not configured (placeholder OAuth creds) |
| Firebase config endpoint | `get-config.js` | ❌ Broken (wrong env var names) |

### Division B Features

| Feature | Component / Function | Status |
|---------|---------------------|--------|
| Intelligence target list | `DashboardB.jsx` + `IntelTargetCard.jsx` | ✅ Working |
| Intel Agent hunt (Places → score → save) | `IntelAgentPanel.jsx` + `intel-hunt.js` | ✅ Working |
| STRIKER FIT scoring | `intel-hunt.js:calcStrikerFit` | ✅ Working |
| Full intelligence cockpit | `ClientIntelligenceDashboard.jsx` | ✅ Working |
| Company detail panel | `IntelCompanyDetail.jsx` | ✅ Working |
| Energy intel scoring via Claude | `energy-intel.js` | ✅ Working |
| AI company profile | `client-card.js` | ✅ Working |
| Signal engine (6 metrics) | `signal-engine.js` | ✅ Working |
| Live reviews via SerpAPI | `serpapi-reviews.js` | ⚠ Needs SERPAPI_API_KEY |
| Website signal crawl | `crawl-signals.js` | ✅ Working |
| Contact discovery (Phase 1+2) | `find-contacts.js` + `find-contacts-deep.js` | ⚠ Phase 2 needs FIRECRAWL_API_KEY |
| Contact enrichment | `enrich-contact.js` | ⚠ Needs SERPAPI_API_KEY or APOLLO_API_KEY |
| Status management | `intelTargetService.js` | ✅ Working |
| Delete selected / delete all | `DashboardB.jsx` | ✅ Working |
| Filter and search | `DashboardB.jsx` | ✅ Working |

---

## 6. Netlify Functions — Detailed Reference

All functions are in `netlify/functions/`. They use CommonJS (`exports.handler`). The functions package.json has:
```json
{
  "type": "commonjs",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "imapflow": "^1.0.169",
    "mailparser": "^3.7.1",
    "resend": "^4.0.0"
  }
}
```

Most functions use native `fetch()` to call Claude API directly (not the SDK). Only `ai-score.js` uses the Anthropic SDK.

The functions use Firestore via REST API (not the Firebase SDK), authenticated with `VITE_FIREBASE_API_KEY` as a query param.

---

### `agent.js` — Autonomous 5-Step Sales Pipeline
**Method:** POST  
**Body:** `{ segment, locality, count, division }`  
**Segments:** hotel | laundry | spa | hospital | restaurant  
**Max count:** 5 (capped to stay within 26s Netlify timeout)

**Pipeline per company (all in parallel across companies):**
1. `step1Search` — Google Places API v1 textSearch, returns up to 20 results
2. `step2Enrich` — Scrapes /impressum and homepage for email, calculates BPS score, deduplicates by googlePlaceId in Firestore, saves new company to `companies` collection
3. `step3Strategize` — Claude Sonnet: returns `{ nextStep, emailType, priority, reasoning }` in JSON
4. `step4Draft` — Claude Sonnet: generates unique SK email draft, then translates to DE. Returns `{ sk: {subject,body}, de: {subject,body} }`
5. `step5Save` — Patches company with `agentStatus/agentReport/agentRunAt`, creates email draft in `emails` collection

**Env needed:** `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`

---

### `ai-advisor.js` — Chat AI for Company Analysis
**Method:** POST  
**Body:** `{ messages, companyContext, knowledgeBase }`

Chat interface for the AI Advisor panel. Detects if the last user message is an email draft request or translation request, appends relevant system instructions. Wraps email drafts in `<STRIKER_EMAIL>` tags. Suggests status changes via `<SUGGEST_STATUS:xxx>` suffix.

**Model:** claude-sonnet-4-6, max 1200 tokens  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `ai-analysis.js` — Full Company Analysis
**Method:** POST  
**Body:** `{ companyName, city, segment, segmentLabel, fitScore, language }`

Returns: `{ score, subject, painPoints, reasoning, mainArgument, opportunity, draft, nextBestAction }`.

Claude generates full JSON analysis. Falls back to hardcoded segment templates (laundry / hotel / generic) in SK, DE, EN if Claude fails or key is missing.

**Model:** claude-sonnet-4-6, max 950 tokens, 12s timeout  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `ai-score.js` — Simple BPS Score
**Method:** POST  
**Body:** `{ company: { name, category, city, country, rating, address, website } }`

Returns: `{ score, reason, positive, risks, nextStep }`.

Uses the Anthropic SDK (`require('@anthropic-ai/sdk')`), unlike all other functions.

**Model:** claude-haiku-4-5-20251001, max 350 tokens  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `check-replies.js` — IONOS IMAP Reply Checker
**Method:** POST (GET returns health check)

Connects to IONOS IMAP, scans INBOX for last 30 days. Skips self-sent messages, already-processed messages, messages not addressed to the IONOS account, and messages without Re: prefix.

**3-layer matching engine:**
1. **HIGH** — In-Reply-To / References header → `outbound_emails.messageId` (currently disabled: Resend overwrites Message-ID with SES ID, so this never matches)
2. **MEDIUM** — Exact fromEmail + normalizedSubject fingerprint → `outbound_emails`
3. **MEDIUM-2b** — Exact fromEmail == `outbound_emails.toEmail` (subject encoding fallback)
4. **LOW** — Domain match against `companies.email` (non-free domains only)

On HIGH/MEDIUM match: downloads body, detects high-interest keywords, saves to `email_replies`, patches company with `replyReceived/hasUnreadReply/unreadReplyCount`, then runs Claude AI analysis of the reply (SK draft + intent detection).

**Env needed:** `IONOS_EMAIL`, `IONOS_PASSWORD`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`  
**External libs:** `imapflow`, `mailparser`

---

### `client-card.js` — Deep AI Company Profile
**Method:** POST  
**Body:** `{ name, segment, segmentLabel, city, country, fitScore, painPoints, aiReasoning, reviewSummary, liveSignals, heatPressure, thermalDependency, operatingCostPressure, modernizationNeed, boilerDependencyProb, willingnessToSolve, reviewsSource }`

Returns a rich profile object: `{ clientProfile, businessPressure, technicalProfile, internetSignals, decisionProfile, salesStrategy, risks, intelligence }`.

Claude generates this. Falls back to segment-based estimates if Claude fails.

**Model:** claude-sonnet-4-6, max 2200 tokens, 15s timeout  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `crawl-signals.js` — Website Signal Crawler
**Method:** POST  
**Body:** `{ web, name, segment, segmentLabel, city, docId }`

Crawls up to 6 pages: homepage + /nachhaltigkeit, /sustainability, /esg, /energie, /energy, /modernisierung, /renovierung, /umwelt, /klima, /co2, /green, /news, /presse, /aktuelles. Extracts plain text, runs keyword signal analysis against 10 SIGNAL_GROUPS (energy_efficiency, modernization, sustainability, esg, co2_reduction, hvac, heating_modernization, renovation, green_building, decarbonization).

Returns: `{ detectedSignals, signalCount, strikerNeedScore (0-100), signalReason, signalSources, analyzedAt }`.

If `docId` is provided, patches the result back into `intelligence_targets/{docId}`.

**Env needed:** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` (for save)  
**No Claude needed** — pure keyword matching

---

### `energy-intel.js` — STRIKER FIT Scoring via Claude
**Method:** POST  
**Body:** `{ companyName, url, segment, city, country, extraContext }`

Returns comprehensive scoring JSON: `{ strikerFitScore, heatDemandScore, energyPainScore, urgencyScore, financialPowerScore, buyingIntentScore, buyingIntent, overallScore, estimatedSize, estimatedEmployees, recommendation, signals, aiAnalysis, suggestedContacts, nextStep }`.

Scoring formula: `strikerFitScore = heatDemand×0.40 + financialPower×0.30 + energyPain×0.20 + urgency×0.10`

**Model:** claude-sonnet-4-6, max 1200 tokens  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `enrich-contact.js` — Contact Email Enrichment
**Method:** POST  
**Body:** `{ contactName, contactRole, contactCategory, hotelName, hotelWebsite }`

Pipeline: SerpAPI Google search (up to 4 queries) → extract emails/LinkedIn/phones from snippets → classify personal vs general → if no personal email found, try Apollo `people/match` API.

Returns: `{ enriched: { email, emailType, linkedin, phone, confidence, sourceType, matchedPages }, debug }`.

Does NOT write to Firestore — frontend handles persistence.

**Env needed:** `SERPAPI_API_KEY` (optional), `APOLLO_API_KEY` (optional, fallback). Returns error if neither is set.

---

### `find-contacts.js` — Phase 1 Contact Discovery
**Method:** POST  
**Body:** `{ companyName, website, city, country }`

Scrapes company website natively (no external APIs): homepage + /impressum, /team, /management, /kontakt, /contact. Hard budget: 8s, max 5 pages. Uses regex patterns to find:
- Technical contacts: Facility Manager, Haustechniker, Energy Manager, Operations Manager
- Business contacts: Geschäftsführer, Direktor, General Manager, Inhaber, Betriebsleiter
- Ignores: HR, Marketing, Sales, Empfang, Revenue Manager, Housekeeping, etc.

Returns: `{ contacts (max 2: 1 technical + 1 business), generalEmail, allPhones, allEmails, sourceNote, phase: 1 }`.

**No external APIs needed**

---

### `find-contacts-deep.js` — Phase 2 Contact Discovery
**Method:** POST  
**Body:** `{ companyName, website, city, country, phase1 }` (phase1 from find-contacts result)

Runs SerpAPI + Firecrawl in parallel, then Claude extraction. Merges with phase1 results. Hard limit: 23s.

**3-step process:**
1. SerpAPI Google search for Geschäftsführer/Direktor/Impressum + Firecrawl scrape of /impressum, /team, /management, /contact, /kontakt
2. Claude extraction: given all page text + pre-extracted emails/phones, extracts real persons with strict rules (no invented names, only use emails from the pre-extracted list)
3. Merge: Claude + phase2 regex + phase1 contacts → deduplicate → select best technical + best business

Falls back to phase1 data if phase2 times out.

**Env needed:** `FIRECRAWL_API_KEY`, `SERPAPI_API_KEY`, `ANTHROPIC_API_KEY`

---

### `find-email.js` — Simple Email Scraper
**Method:** POST  
**Body:** `{ website }`

Tries /impressum, /kontakt, /contact, /about, homepage in order. Returns first non-blocked email found. 10s total deadline.

**No API keys needed**

---

### `get-config.js` — Firebase Config Endpoint
**Method:** GET  
**STATUS: BROKEN**

Reads `FIREBASE_API_KEY` (without VITE_ prefix) but the actual env var is `VITE_FIREBASE_API_KEY`. Returns `undefined` for all values. This function is not called from the main app — it appears to be a legacy/unused endpoint.

---

### `gmail-check.js` — Gmail OAuth2 Reply Checker
**Method:** POST  
**STATUS: NOT CONFIGURED**

Alternative to `check-replies.js` using Gmail instead of IONOS IMAP. Requires OAuth2 refresh token setup via Google OAuth Playground. Searches inbox for messages from company emails, updates Firestore on match.

**Env needed:** `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`  
**Note:** Currently uses placeholder values in .env. The Dashboard calls `check-replies` (IONOS), not this function.

---

### `hotel-photo.js` — Google Places Photo Resolver
**Method:** POST  
**Body:** `{ name, city, country }`

Two-step: Places textSearch for the company → resolve first photo to CDN URL via Places media endpoint. Returns `{ photoUrl, placeId, photoName }`.

**Env needed:** `GOOGLE_PLACES_API_KEY`

---

### `hunter-search.js` — Hunter.io CORS Proxy
**Method:** POST  
**Body:** `{ domain, apiKey }` (apiKey is passed from the frontend at runtime)

Proxies Hunter.io domain-search to avoid CORS. The user's Hunter.io API key is passed in the request body — it is NOT stored as a server env var. This means users need their own Hunter key.

---

### `intel-hunt.js` — Division B Mass Hunt
**Method:** POST  
**Body:** `{ segment, locality, country, count }`  
**Segments:** hotel | wellness | laundry | hospital | restaurant | food | brewery | industrial  
**Max count:** 15

Division B equivalent of `agent.js`. For each found company:
1. Google Places search
2. Email scraping (homepage + /impressum)
3. `calcStrikerFit()` — local scoring algorithm using SEGMENT_BASE scores + name keyword boosts (luxury, wellness, eco)
4. Duplicate check by googlePlaceId in `intelligence_targets`
5. Save to `intelligence_targets` with division: 'B'

No Claude needed — scoring is algorithmic.

**Env needed:** `GOOGLE_PLACES_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`

---

### `send-email.js` — Email Sender
**Method:** POST  
**Body:** `{ to, subject, body, subjectDe, bodyDe, companyId, companyName }`

Prefers `subjectDe/bodyDe` over `subject/body`. Cleans AI noise from text (removes `<STRIKER_EMAIL>` tags, SUBJECT/BODY headers). Generates a unique Message-ID and threadFingerprint (SHA1 hash of email+normalizedSubject). Sends via Resend API from `info@striker-energy.de`. Saves outbound record to `outbound_emails` collection for reply tracking.

**Env needed:** `RESEND_API_KEY`, `IONOS_EMAIL` (as FROM address fallback), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`

---

### `serpapi-reviews.js` — Live Google Maps Reviews
**Method:** POST  
**Body:** `{ companyName, segment, segmentLabel, city, country, strikerFitScore, painPoints, aiReasoning }`

Pipeline:
1. SerpAPI `google_maps` search — find company on Google Maps
2. SerpAPI `google_maps_reviews` — fetch up to 10 review texts
3. Keyword detection on reviews (heating, renovation, costs, wellness, boiler keywords)
4. Claude analysis of reviews → 6 energy metrics + `liveSignals` + `reviewSummary`

Falls back to `segmentFallback()` (hardcoded values for laundry/hotel/generic) if SerpAPI or Claude fails.

**Env needed:** `SERPAPI_API_KEY`, `ANTHROPIC_API_KEY`

---

### `signal-engine.js` — Claude 6-Metric Energy Estimator
**Method:** POST  
**Body:** `{ companyName, segment, segmentLabel, city, strikerFitScore, painPoints, aiReasoning }`

Returns 6 energy metrics with reasons (all in Slovak, max 12 words each):
- `heatPressure` — heat demand intensity
- `thermalDependency` — reliance on continuous heat
- `operatingCostPressure` — energy cost burden
- `modernizationNeed` — likelihood of needing upgrade
- `boilerDependencyProb` — probability of gas boiler use
- `willingnessToSolve` — readiness to invest in solution

Falls back to segment-based hardcoded values if Claude fails.

**Model:** claude-sonnet-4-6, max 400 tokens, 12s timeout  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `translate-draft.js` — Email Draft Translator
**Method:** POST  
**Body:** `{ subject, text, targetLang }` (targetLang: 'de' | 'sk' | 'en')

Translates email draft to target language. Preserves names (Adolf Staubert, STRIKER), phone/email. Returns `{ subject, body }`. Falls back to returning original on failure.

**Model:** claude-sonnet-4-6, max 600 tokens, 10s timeout  
**Env needed:** `ANTHROPIC_API_KEY`

---

### `translate-reply.js` — SK Reply → DE Translator
**Method:** POST  
**Body:** `{ replyId, skSubject, skBody, companyName, originalSubject }`

Translates Slovak reply draft to professional German (Sie-form, DACH market tone). If `replyId` provided, patches `email_replies/{replyId}` with `{ aiDraftDeSubject, aiDraftDeBody, aiDraftStatus: 'pending_de', translatedAt }`.

**Model:** claude-haiku-4-5 (NOTE: old model name — should be claude-haiku-4-5-20251001)  
**Env needed:** `ANTHROPIC_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`

---

### `serpapi-search-test.js` — Test File
**STATUS: DEAD CODE — should be deleted**  
This is a test/debug file that should not be deployed to production.

---

## 7. Environment Variables — Complete List

### Frontend (.env at project root — also set in Netlify site settings)

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Firebase frontend auth |
| `VITE_FIREBASE_AUTH_DOMAIN` | `striker-ai-sales-2026.firebaseapp.com` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `striker-ai-sales-2026` | Firestore project |
| `VITE_FIREBASE_STORAGE_BUCKET` | `striker-ai-sales-2026.firebasestorage.app` | Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `959331891231` | FCM |
| `VITE_FIREBASE_APP_ID` | `1:959331891231:web:...` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-CLEEHBMPBS` | Analytics |

### Netlify Functions (server-side — set in Netlify dashboard under Site Settings → Environment Variables)

| Variable | Status | Purpose | Used By |
|----------|--------|---------|---------|
| `ANTHROPIC_API_KEY` | ✅ Set | Claude API calls | agent, ai-advisor, ai-analysis, ai-score, check-replies, client-card, energy-intel, find-contacts-deep, serpapi-reviews, signal-engine, translate-draft, translate-reply |
| `GOOGLE_PLACES_API_KEY` | ✅ Set | Google Places v1 API | agent, intel-hunt, hotel-photo |
| `RESEND_API_KEY` | ✅ Set | Email sending | send-email |
| `VITE_FIREBASE_API_KEY` | ✅ Set (must also be in Netlify) | Firestore REST auth | agent, check-replies, client-card, crawl-signals, gmail-check, intel-hunt, send-email, translate-reply |
| `VITE_FIREBASE_PROJECT_ID` | ✅ Set (must also be in Netlify) | Firestore REST base URL | Same as above |
| `IONOS_EMAIL` | ❌ Missing | IMAP login + FROM address | check-replies, send-email |
| `IONOS_PASSWORD` | ❌ Missing | IMAP login | check-replies |
| `IONOS_IMAP_HOST` | Optional | Defaults to `imap.ionos.de` | check-replies |
| `IONOS_IMAP_PORT` | Optional | Defaults to `993` | check-replies |
| `SERPAPI_API_KEY` | ❌ Missing | Google Maps/Reviews/Search | serpapi-reviews, enrich-contact, find-contacts-deep |
| `FIRECRAWL_API_KEY` | ❌ Missing | Web scraping for contacts | find-contacts-deep |
| `APOLLO_API_KEY` | ❌ Missing | Contact email lookup fallback | enrich-contact |
| `GMAIL_CLIENT_ID` | ❌ Placeholder | Gmail OAuth | gmail-check |
| `GMAIL_CLIENT_SECRET` | ❌ Placeholder | Gmail OAuth | gmail-check |
| `GMAIL_REFRESH_TOKEN` | ❌ Placeholder | Gmail OAuth token | gmail-check |

**Important:** `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` must be set BOTH in the local `.env` file (for frontend via Vite) AND in Netlify environment variables (for functions via `process.env`). Netlify does NOT auto-expose VITE_ vars to functions.

---

## 8. Firestore Database Structure

Firebase project: `striker-ai-sales-2026`

### Collection: `companies` (Division A)

```
companies/{autoId}
{
  // Identity
  name:          string    — company name
  address:       string    — full formatted address
  city:          string
  country:       string    — "DE" | "AT" | "CH"
  googlePlaceId: string    — Google Places ID (dedup key)
  category:      string    — "hotel" | "laundry" | "spa" | "hospital" | "restaurant"
  division:      string    — "A"

  // Contact info
  email:   string
  phone:   string
  website: string          — without http prefix

  // Status
  status:  string          — "new" | "contacted" | "offer" | "closed" | "rejected"
  notes:   string

  // Scoring
  rating:       number     — Google rating 1–5
  aiScore:      number     — BPS score 0–100
  aiReason:     string     — 1-sentence reason
  aiPositive:   string[]   — positive factors
  aiRisks:      string[]   — risk factors
  aiConfidence: string     — "vysoká" | "stredná" | "nízka"
  aiReasoning:  string[]   — detailed reasoning array
  aiNextStep:   string
  aiKeyFactors: string[]
  aiInsight:    string

  // Agent pipeline results
  agentStatus:  string     — "pending" | "done"
  agentReport:  object     — { nextStep, emailType, priority, reasoning }
  agentRunAt:   string     — ISO timestamp

  // Reply tracking
  replyReceived:   boolean
  hasUnreadReply:  boolean
  unreadReplyCount: number
  replySubject:    string
  replySnippet:    string
  replyFrom:       string
  lastReplyAt:     timestamp
  highInterest:    boolean  — true if reply contains buying intent keywords

  // Timestamps
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Collection: `emails`

```
emails/{autoId}
{
  companyId:   string
  companyName: string

  // Simple drafts (frontend-generated)
  subject: string
  body:    string

  // Agent-generated bilingual drafts
  subjectSk: string
  bodySk:    string
  subjectDe: string
  bodyDe:    string

  status:      string    — "draft" | "active_draft"
  generatedBy: string    — "agent" | "user"
  aiModel:     string
  edited:      boolean

  createdAt: timestamp
  updatedAt: timestamp
  sentAt:    null | timestamp
}
```

### Collection: `outbound_emails`

```
outbound_emails/{autoId}
{
  companyId:         string | null
  companyName:       string | null
  toEmail:           string     — lowercase
  subject:           string
  normalizedSubject: string     — Re:/Fwd: stripped, lowercased
  messageId:         string     — <uuid@striker-energy.de>
  threadFingerprint: string     — SHA1(email::normalizedSubject)[0:16]
  resendId:          string     — Resend API response ID
  sentAt:            timestamp
}
```

### Collection: `email_replies`

```
email_replies/{autoId}
{
  companyId:         string
  companyName:       string
  messageId:         string     — IMAP message-id (dedup key)
  fromEmail:         string
  subject:           string
  normalizedSubject: string
  bodyText:          string     — up to 3000 chars
  snippet:           string     — first 120 chars

  // Matching metadata
  matchConfidence:   string    — "high" | "medium" | "low"
  outboundMsgId:     string | null
  possibleMatch:     boolean   — true for low-confidence matches

  // Intent detection
  highInterest:      boolean   — true if buying keywords detected

  // AI analysis (added after match)
  aiSummary:         string    — 1-2 sentence summary
  aiIntent:          string    — "záujem" | "otázka" | "neutrálne" | "odmietnutie"
  aiDraftSkSubject:  string    — suggested SK reply subject
  aiDraftSkBody:     string    — suggested SK reply body
  aiDraftDeSubject:  string    — DE translation (after translate-reply call)
  aiDraftDeBody:     string    — DE translation
  aiDraftStatus:     string    — "pending_sk" | "pending_de"

  replyDate:     timestamp
  processedAt:   timestamp
  translatedAt:  timestamp | null
  readAt:        timestamp | null
}
```

### Collection: `intelligence_targets` (Division B)

```
intelligence_targets/{autoId}
{
  // Identity
  name:          string
  web:           string    — without http (display)
  website:       string    — with http (for requests)
  email:         string
  phone:         string
  address:       string
  city:          string
  country:       string
  segment:       string    — "hotel" | "wellness" | "laundry" | "hospital" | "restaurant" | "food" | "brewery" | "industrial"
  segmentLabel:  string    — human-readable Slovak label
  googlePlaceId: string
  division:      string    — "B"

  // Status
  status:        string    — "new" | "analyzed" | "ready" | "contacted" | "replied" | "followup" | "unsuitable"

  // Google data
  rating:        number
  reviewCount:   number

  // STRIKER FIT scores (from intel-hunt or energy-intel)
  strikerFitScore:      number   — 0–100
  heatDemandScore:      number
  energyPainScore:      number
  urgencyScore:         number
  financialPowerScore:  number
  buyingIntentScore:    number
  buyingIntent:         string   — "weak" | "medium" | "strong"
  buyingIntentReason:   string
  overallScore:         number
  recommendation:       string   — "immediate" | "monitor" | "unsuitable"
  recommendationReason: string
  whyFound:             string
  nextStep:             string
  signals:              string[] — detected name/segment signals
  sources:              object[] — added URLs/sources
  contacts:             object[] — discovered contacts

  // Signal engine results (from signal-engine.js)
  heatPressure:              number
  heatPressureReason:        string
  thermalDependency:         number
  thermalDependencyReason:   string
  operatingCostPressure:     number
  operatingCostPressureReason: string
  modernizationNeed:         number
  modernizationNeedReason:   string
  boilerDependencyProb:      number
  boilerDependencyProbReason: string
  willingnessToSolve:        number
  willingnessToSolveReason:  string

  // Live reviews (from serpapi-reviews.js)
  liveSignals:       string[]
  reviewSummary:     string
  reviewsSource:     string   — "serpapi" | "simulated"
  reviewRating:      number
  dataQuality:       string   — "high" | "none"

  // Website crawl signals (from crawl-signals.js)
  strikerNeedScore:  number   — 0–100 keyword score
  signalCount:       number
  signalReason:      string
  signalSources:     string[] — crawled URLs
  detectedSignals:   object[] — { id, label, weight, matches, hitCount }
  extractedKeywords: string[]
  analyzedAt:        string

  createdAt: timestamp
  updatedAt: timestamp
}
```

### Collection: `knowledge_base`

```
knowledge_base/{autoId}
{
  title:    string
  category: string   — "product" | "targets" | "roi" | "sales" | "email_rules" | "warnings" | "objections"
  content:  string
  createdAt: timestamp
}
```

Auto-seeded on login with 7 Slovak entries (v2). Check: looks for doc with `title === 'Co je STRIKER'`. If missing, deletes old German entries and re-seeds.

### Collection: `tasks`

```
tasks/{autoId}
{
  companyId: string
  title:     string
  status:    string   — "open"
  createdAt: timestamp
}
```

Written from `Dashboard.jsx:handleCreateTask`. No UI exists to view or manage tasks — this feature is incomplete.

### Collection: `interactions`

```
interactions/{autoId}
{
  companyId:  string
  type:       string   — "reply_received"
  message:    string
  createdBy:  string   — "system"
  createdAt:  string   — ISO timestamp
}
```

Written by `gmail-check.js` when a reply is detected. Audit trail only — no UI to display it.

### Collection: `intent_leads` — LEGACY / UNUSED

Written by `intelligenceService.js`, seeded with 6 hardcoded mock companies. No current UI component subscribes to or displays this collection. The real Division B data is in `intelligence_targets`. This is dead code from an earlier architecture iteration.

---

## 9. Known Bugs

### Critical

**BUG-01: `get-config.js` reads wrong env var names**
- Reads: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, etc.
- Actual vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.
- Result: Returns `undefined` for all config values
- Impact: Low (function not called from main app)
- Fix: Replace all `FIREBASE_` with `VITE_FIREBASE_` in get-config.js, or delete the file

**BUG-02: `IONOS_EMAIL` and `IONOS_PASSWORD` missing from Netlify env**
- The "📩 Odpovede" (Reply Check) button in Dashboard calls `check-replies`
- `check-replies` requires IONOS IMAP credentials
- Without them: function returns 500, button shows error
- Fix: Add `IONOS_EMAIL=info@striker-energy.de` and `IONOS_PASSWORD=...` to Netlify env vars

**BUG-03: Gmail OAuth credentials are placeholders**
- `gmail-check.js` has `GMAIL_CLIENT_ID=YOUR_GMAIL_CLIENT_ID_HERE` in .env
- This function is not called by the main app (Dashboard uses IONOS check-replies instead)
- Impact: gmail-check endpoint non-functional but not actively used
- Fix: Either configure Gmail OAuth or remove the function entirely

### Model Names

**BUG-04: Deprecated Claude model name in `check-replies.js` and `translate-reply.js`**
- Both use `claude-haiku-4-5` (old format)
- Correct model ID: `claude-haiku-4-5-20251001`
- Impact: May stop working when Anthropic removes the alias
- Fix: Update model string in both files

### Missing API Keys (Features degraded but not broken)

**BUG-05: `SERPAPI_API_KEY` not configured**
- Affected: `serpapi-reviews.js` (falls back to segment estimates), `enrich-contact.js` (tries Apollo instead), `find-contacts-deep.js` (skips SerpAPI step)
- Impact: Division B reviews show "simulated" data; contact enrichment limited

**BUG-06: `FIRECRAWL_API_KEY` not configured**
- Affected: `find-contacts-deep.js` skips Firecrawl scraping entirely
- Impact: Phase 2 contact discovery relies only on SerpAPI snippets + regex (weaker results)

**BUG-07: `APOLLO_API_KEY` not configured**
- Affected: `enrich-contact.js` — Apollo fallback skipped if no SerpAPI personal email found
- Impact: Contact email enrichment returns fewer results

### Architecture Issues

**BUG-08: `intent_leads` collection is dead code**
- `intelligenceService.js` creates/manages it, but no current UI component uses it
- `IntelligenceDashboard.jsx` and `IntelligenceEngine.jsx` appear to be superseded by `ClientIntelligenceDashboard.jsx` and `IntelCompanyDetail.jsx`
- Risk: Confusing for developers; stale mock data in Firestore

**BUG-09: Task system is write-only**
- `Dashboard.jsx:handleCreateTask` saves to `tasks` collection
- No component reads or displays tasks
- Feature is incomplete

**BUG-10: `serpapi-search-test.js` deployed to production**
- Test file in functions directory gets deployed
- Should be deleted or moved outside the functions folder

**BUG-11: `agent.js` timeout architecture mismatch**
- Comment says "deploy as Background Function (26 min timeout)"
- `netlify.toml` sets `[functions.agent] timeout = 26` (seconds, not minutes)
- Netlify background functions require a different deploy model and URL (`/background`)
- Current setup: 26-second timeout, max 5 companies per run
- For larger runs (10+ companies), would need true background function

**BUG-12: Layer 1 reply matching disabled**
- `check-replies.js` comment: "Layer 1 (In-Reply-To) disabled: Resend overwrites Message-ID with SES ID so our stored messageId never matches"
- The stored `messageId` in `outbound_emails` is the SMTP Message-ID we set, but the reply's In-Reply-To header contains the SES delivery ID Resend assigned
- Impact: Reply matching relies entirely on Layer 2 (fingerprint) and Layer 2b (toEmail match), which are less reliable for companies that reply from a different address

**BUG-13: `hunter-search.js` exposes user's API key**
- Body includes `{ domain, apiKey }` — the key comes from frontend and is visible in browser network tab
- Should store `HUNTER_API_KEY` server-side instead

---

## 10. Netlify Build Config

```toml
[build]
  command = "npm install --prefix netlify/functions && npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  SECRETS_SCAN_OMIT_KEYS = "VITE_FIREBASE_API_KEY,VITE_FIREBASE_APP_ID,VITE_FIREBASE_SENDER_ID"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["imapflow", "mailparser"]   # CJS modules not bundleable by esbuild

[functions.ai-advisor]    timeout = 26
[functions.agent]         timeout = 26
[functions.gmail-check]   timeout = 26
[functions.check-replies] timeout = 26
[functions.translate-reply] timeout = 26
[functions.energy-intel]  timeout = 26
[functions.intel-hunt]    timeout = 26
[functions.ai-analysis]   timeout = 26
[functions.translate-draft] timeout = 26
[functions.signal-engine] timeout = 26
[functions.serpapi-reviews] timeout = 26
[functions.client-card]   timeout = 26
[functions.find-contacts] timeout = 26

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Note: `crawl-signals`, `enrich-contact`, `find-contacts-deep`, `hotel-photo`, `hunter-search` are NOT listed with timeout overrides — they get the Netlify default (10s for free plan, 26s for pro).

---

## 11. Claude Models Used

| Model | Where | Purpose |
|-------|-------|---------|
| `claude-sonnet-4-6` | agent, ai-advisor, ai-analysis, client-card, energy-intel, find-contacts-deep, serpapi-reviews, signal-engine, translate-draft, intel-hunt (via energy-intel) | Primary reasoning, complex JSON generation |
| `claude-haiku-4-5-20251001` | ai-score | Simple scoring (correct model ID) |
| `claude-haiku-4-5` | check-replies, translate-reply | AI analysis + translation (OLD model name — should be updated) |

---

## 12. Key Business Logic

### BPS Score (Business Potential Score) — `agent.js:calcBPS` and `calculateBusinessScore.js`
Local algorithm. Base score by category (laundry=45, spa=40, hotel=30). Bonuses for:
- Wellness/SPA keywords in name: +20
- Pool: +15, Sauna: +10, Luxury: +12, Resort: +10
- Alpine/ski location: +15, Spa town: +12
- Rating ≥4.5: +15, ≥4.0: +10, ≥3.5: +5, <3.5: -10
- Has website: +10, Has email: +15, Has phone: +5
- Capped at 0–100. Confidence: ≥70=vysoká, ≥50=stredná, else=nízka

### STRIKER FIT Score — `intel-hunt.js:calcStrikerFit`
Segment base scores: wellness fit=88, laundry fit=85, hospital=73, hotel=72, industrial=65, food=68, brewery=82, restaurant=52.
Boosts: luxury name +8 fit/+10 financial, wellness name +10 fit/+8 heat, eco name +5 fit/+5 pain, has website +5, has email +6, rating≥4.5 +5 fit/+8 financial.
Overall = fit×0.35 + heat×0.25 + pain×0.15 + financial×0.15 + urgency×0.10
Recommendation: overall≥70→immediate, ≥45→monitor, else→unsuitable

### Signal Analysis — `signalAnalysis.js` / `crawl-signals.js`
10 signal groups with weights 8–10: energy_efficiency, modernization, sustainability, esg, co2_reduction, hvac, heating_modernization, renovation, green_building, decarbonization.
Score = sum(weight × min(hits, 3)) / maxPossible × 100. Max possible = 270.

### Reply Thread Matching — `check-replies.js`
3-layer matching in priority order:
1. In-Reply-To/References headers → `outbound_emails.messageId` (DISABLED — Resend overwrites Message-ID)
2. `fromEmail::normalizedSubject` fingerprint → `outbound_emails` fingerprint
3. `fromEmail` exact match to `outbound_emails.toEmail` (subject encoding fallback)
4. Domain match against `companies.email` (non-free domains only)

---

## 13. Segments Reference

| Segment key | Slovak label | Base FIT | Typical heat use |
|-------------|-------------|----------|-----------------|
| `hotel` | Hotel / Ubytovanie | 72 | High (rooms, restaurant, wellness) |
| `wellness` | Wellness / Spa | 88 | Very high (pools, saunas, treatments) |
| `laundry` | Priemyselná práčovňa | 85 | Very high (continuous 24/7) |
| `hospital` | Nemocnica / Klinika | 73 | High (laundry, sterile water) |
| `restaurant` | Reštaurácia / Gastro | 52 | Medium |
| `food` | Potravinárstvo | 68 | High |
| `brewery` | Pivovar | 82 | High (brewing process) |
| `industrial` | Priemysel / Iné | 65 | Medium–high |

---

## 14. Email Workflow End-to-End

```
1. Company found (Search or Agent)
   ↓
2. Company saved to Firestore (companies collection)
   ↓
3. AI Analysis run (ai-analysis.js) → score + email draft + NBA stored
   ↓
4. User opens CompanyDetailModal → EmailDraftEditor
   ↓
5. AI Advisor (ai-advisor.js) generates SK email → shows in editor
   ↓
6. User clicks "Preložiť" → translate-draft.js → DE version shown
   ↓
7. User clicks "Odoslať" → send-email.js:
   - Sends via Resend API (from: info@striker-energy.de)
   - Generates Message-ID <uuid@striker-energy.de>
   - Saves to outbound_emails with messageId + threadFingerprint
   ↓
8. Company manually set to status: 'contacted'
   ↓
9. User clicks "📩 Odpovede" → check-replies.js:
   - Connects to IONOS IMAP
   - Scans last 30 days of INBOX
   - Matches replies via fingerprint (email::subject)
   - Saves to email_replies with AI summary + SK draft
   - Patches company: hasUnreadReply=true, unreadReplyCount++
   ↓
10. Unread badge shown in toolbar
    ↓
11. User opens reply → clicks "Preložiť do DE" → translate-reply.js:
    - Translates SK draft → DE
    - Saves DE version back to email_replies
    ↓
12. User sends DE reply via EmailDraftEditor
```

---

## 15. Quick Start Checklist for New Developer

- [ ] Clone repo, run `npm install` in root and `npm install` in `netlify/functions/`
- [ ] Copy `.env` values to local environment
- [ ] Set missing Netlify env vars: `IONOS_EMAIL`, `IONOS_PASSWORD`, `SERPAPI_API_KEY`, `FIRECRAWL_API_KEY`, `APOLLO_API_KEY`
- [ ] Create Firebase users: `adolf@striker.local` and `sabo@striker.local` in Firebase Console → Authentication
- [ ] Deploy to Netlify or run locally with `netlify dev` (requires Netlify CLI)
- [ ] Verify `check-replies` health: GET `/.netlify/functions/check-replies`
- [ ] Verify `agent` health: GET `/.netlify/functions/agent`
- [ ] Delete `serpapi-search-test.js` from functions directory
- [ ] Fix `get-config.js` env var names or delete the file
- [ ] Update `claude-haiku-4-5` to `claude-haiku-4-5-20251001` in `check-replies.js` and `translate-reply.js`
