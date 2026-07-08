# CrisisGrid

An AI-assisted emergency operations platform connecting citizens, an emergency
operations center (EOC), and rescue teams on one real-time map — built on the
**MERN stack** (MongoDB, Express, React, Node.js).

This is a deliberately **scoped-down** version of a much larger original spec
(see `docs/original-specs/` for the full vision). Rather than half-build eight
portals and a dozen features, this delivers three roles and a focused feature
set completely, so it's honest, demoable, and defensible in an interview.
The "Roadmap / What I'd Build Next" section below lists what was cut and why —
that's a feature for an interview, not a gap, because it shows you understand
scope and tradeoffs.

📄 **[Full project documentation (PDF)](docs/CrisisGrid_Project_Documentation.pdf)** —
every feature explained (what it does + how it's built), a site navigation
guide, tech stack, and architecture notes, written for both recruiters and
engineers.

🚀 **[Deployment guide](DEPLOYMENT.md)** — step-by-step: GitHub → MongoDB
Atlas → Render → Vercel, all on free tiers.

## What it actually does

- **JWT auth with refresh tokens**, role-based access control (citizen, EOC, rescue team, hospital, shelter)
- **Citizens** submit SOS alerts / incident reports on a live Leaflet map (OpenStreetMap, no API key needed)
- Every report is run through an **AI triage service** (Google Gemini free tier, JSON-structured output) that suggests severity, category, and needed resources — with an **offline rule-based fallback** so the app is 100% demoable with zero external accounts
- A lightweight **duplicate-detection service** (geo-proximity + Jaccard text similarity — no paid vector DB) auto-merges near-identical reports from the same area
- **Socket.IO** pushes every new report, status change, and facility update to every open dashboard in real time — no polling
- The **EOC dashboard** shows a live operational map, an AI-generated situation summary, and one-click status advancement (reported → acknowledged → dispatched → in progress → resolved)
- The **Rescue team console** shows assigned jobs plus unassigned high-priority incidents to self-assign
- **Hospital and Shelter portals** let facility staff self-register their facility and push live bed/occupancy capacity updates, broadcast instantly to every dashboard's map
- **Multi-layer fake-report defense**: every incident gets a 0-100 trust score combining GPS consistency (30%), crowd confirm/dispute votes (25%), authority sign-off (25%), and AI text-confidence (20%) — states are Pending / Suspicious / Verified / Highly Trusted, fully interactive (anyone can vote, EOC/rescue can verify or reject) and not gated behind demo mode
- **Organization verification documents**: hospital/shelter/rescue/NGO/volunteer accounts upload an ID/registration image at signup (stored as-is, no paid file storage needed); EOC reviews and approves/rejects it from the dashboard — a stand-in for the government-official check a real deployment would need
- **Smart calamity map**: each incident renders as a category-specific icon (🌊 flood, 🔥 fire, 🚑 medical, etc.) colored by risk level (green/yellow/orange/red), critical incidents pulse, and resolved/rejected incidents fade to grey — live over Socket.IO the instant status changes
- **EOC broadcast alerts**: a "high risk notification" bar the EOC can push to every connected dashboard's top bar instantly, plus retract when the risk passes
- **Emergency contact directory**: EOC dashboard lists every hospital/shelter/rescue team/NGO with phone number and live facility capacity, in one place
- **AI incident summaries, kept short on purpose**: instead of reproducing the citizen's paragraph, every report gets a terse 1-2 sentence briefing — e.g. a report about "40 people trapped after a dam overflow" becomes *"Flood reported. Approximately 40 people affected. Immediate evacuation recommended."* — extracting the affected-person count when mentioned and picking an action phrase from severity, so EOC staff triaging a long queue get the headline, not the essay
- **AI resource recommendation checklist**: every incident gets a dispatch checklist (e.g. ✓ 3 Ambulances, ✓ 2 Rescue boats, ✓ Police unit, ✓ Temporary shelter — Estimated response: 15 minutes) shown on every incident card. This is **deliberately a deterministic rule table, not an LLM guess** — see the "Architecture notes" section for why that's a safety decision
- **Bottom-right assistant chatbot**, role-aware from one shared endpoint: citizens get instant safety guidance ("Water is entering my house" → move-to-higher-ground advice + nearest shelter with live distance) while EOC gets natural-language incident search ("Show all unverified flood reports" → parsed into a live filtered list, clickable straight into the dashboard)
- A **seed script** builds a reproducible "Mumbai Flood" demo scenario (5 accounts, 4 facilities, 5 incidents with varied trust states — including one caught and rejected as unreliable) so you can demo instantly

## Tech stack

| Layer      | Choice                                                                 |
|------------|-------------------------------------------------------------------------|
| Frontend   | React 18 + Vite, Tailwind CSS, React Router, TanStack Query, react-leaflet |
| Backend    | Node.js + Express                                                      |
| Database   | MongoDB (Atlas free tier), Mongoose ODM, 2dsphere geo indexes           |
| Auth       | JWT access tokens (in-memory) + httpOnly refresh-token cookie          |
| Realtime   | Socket.IO                                                               |
| Maps       | OpenStreetMap tiles + Leaflet (free, no key)                            |
| AI         | Google Gemini free tier, with an offline mock fallback                  |
| Deployment | Vercel (frontend), Render/Railway (backend), MongoDB Atlas (DB)         |

---

## Project structure

```
crisisgrid/
├── backend/
│   ├── src/
│   │   ├── config/db.js            # Mongo connection (fails soft, not hard)
│   │   ├── models/                 # User, Incident, Facility (Mongoose schemas)
│   │   ├── middleware/             # auth (JWT), error handler
│   │   ├── controllers/            # business logic per resource
│   │   ├── routes/                 # Express routers
│   │   ├── services/                # aiService, duplicateService, socketService
│   │   ├── seed/demoSeed.js         # Mumbai Flood demo data
│   │   └── server.js                # app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/axiosClient.js       # axios instance + silent token refresh
    │   ├── context/                 # AuthContext, SocketContext
    │   ├── components/               # Navbar, IncidentMap, IncidentCard, SeverityBadge, ProtectedRoute
    │   ├── pages/                    # Landing, Login, Register, 3 dashboards, ReportIncident
    │   └── App.jsx / main.jsx
    ├── package.json
    └── .env.example
```

---

## Running it with Docker (recommended if you have Docker installed)

This spins up MongoDB, the backend, and the frontend together — no MongoDB
Atlas account needed for local development.

```bash
cd crisisgrid
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (generate
with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
— you'll need Node installed just for this one command, or use any online
random-hex generator). Leave `MONGO_URI` as-is; docker-compose overrides it
automatically to point at the local Mongo container. Leave `GEMINI_API_KEY`
blank to use the offline mock AI.

```bash
docker compose up --build
```

First run takes a minute or two (pulling the Mongo image, installing npm
packages). Once it's up, seed the demo data:

```bash
docker compose exec backend npm run seed
```

Then open **http://localhost:5173**. The backend runs at **http://localhost:5000**,
MongoDB at **localhost:27017** (reachable with MongoDB Compass if you want to
browse the data visually).

Useful commands:

```bash
docker compose down              # stop everything
docker compose down -v           # stop and wipe the Mongo data volume too
docker compose logs -f backend   # tail backend logs
docker compose up --build        # rebuild after changing package.json or Dockerfiles
```

Editing files under `backend/src` or `frontend/src` on your host reflects
into the running containers automatically (both dev servers have hot
reload). If you only change dependencies (`package.json`), re-run with `--build`.

> The frontend/backend Dockerfiles here are dev-mode (hot reload). For a
> production-style container build, see `frontend/Dockerfile.prod` (a
> multi-stage build that serves the compiled static app via nginx) — not
> wired into `docker-compose.yml` by default since Vercel/Render remain the
> simpler path to a live deployed URL for a portfolio project.

---

## Running it without Docker (manual setup)

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
```

Edit `.env`:
- **Fastest path (no external accounts):** leave `MONGO_URI` and `GEMINI_API_KEY`
  blank and `DEMO_MODE=true`. The API will boot, but you'll need a real
  `MONGO_URI` for any request that touches the database (a free MongoDB
  Atlas cluster takes about 5 minutes to set up: https://www.mongodb.com/atlas).
- Generate JWT secrets quickly:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

Once `MONGO_URI` is set:

```bash
npm run seed   # populates the Mumbai Flood demo scenario
npm run dev    # starts the API on http://localhost:5000
```

Demo login credentials (printed by the seed script too):

| Role         | Email                          | Password    |
|--------------|----------------------------------|-------------|
| Citizen      | citizen@demo.crisisgrid.app      | Demo@1234   |
| EOC Control  | eoc@demo.crisisgrid.app          | Demo@1234   |
| Rescue Team  | rescue@demo.crisisgrid.app       | Demo@1234   |
| Hospital     | hospital@demo.crisisgrid.app     | Demo@1234   |
| Shelter      | shelter@demo.crisisgrid.app      | Demo@1234   |

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev    # starts on http://localhost:5173
```

Open http://localhost:5173, click a demo role button on the login page to
autofill credentials, and sign in.

---

## Deployment (all free tiers)

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step guide,
including exact screens/settings for MongoDB Atlas, Render, and Vercel,
troubleshooting for common issues, and how to put the live link on your
GitHub profile.

Short version: MongoDB Atlas (free M0 cluster) for the database, Render for
the backend (root dir `backend/`, build `npm install`, start `npm start`),
Vercel for the frontend (root dir `frontend/`, Vite preset), then point
`CLIENT_URL` (backend) and `VITE_API_URL` (frontend) at each other's final
URLs and re-run the seed script against the production database.

---

## Architecture notes worth knowing for an interview

- **Single `User` collection, one `role` enum field** rather than 8 separate
  collections — one auth identity, many possible roles, simpler JWT logic.
  Trade-off: role-specific fields (e.g. hospital resources) live on a
  separate `Facility` document instead, keeping `User` lean.
- **Access token in memory, refresh token in an httpOnly cookie.** This
  avoids storing any JWT in `localStorage` (a common XSS vector). Axios has a
  response interceptor that catches a `401`, calls `/auth/refresh`, and
  retries the original request once — the user never notices their 15-minute
  access token expired.
- **AI service is a swappable strategy**: `analyzeIncident()` tries Gemini
  first (only outside demo mode, with an API key present) and *always* falls
  back to a deterministic keyword classifier on any failure — missing key,
  network error, bad JSON, rate limit. This means a flaky free-tier API can
  never break a live demo.
- **Duplicate detection without a vector database**: a MongoDB `$near` geo
  query narrows candidates to within 500m, then Jaccard similarity on the
  word sets of title+description flags likely duplicates. Cheap, explainable,
  and genuinely works for short incident reports.
- **Realtime without over-engineering**: rather than hand-rolling
  optimistic cache updates from socket payloads, the frontend just
  invalidates the relevant React Query keys on any socket event, letting
  React Query re-fetch. Simpler, fewer race-condition bugs, at the cost of
  one extra network round-trip per update — a reasonable trade for a project
  this size.
- **Trust score as an explainable weighted formula, not a black box**: each
  of the four signals (GPS/crowd/authority/AI) is independently computable
  and testable — `trustScoreService.js` has no hidden state, just pure
  functions of its inputs. A missing signal (e.g. no GPS permission) returns
  a neutral score rather than being treated as suspicious, which matters:
  you don't want to punish someone for denying a location permission.
- **Verification data lives on the Incident document itself** (`crowdVotes`,
  `authorityVerification`, `verification`), not a separate collection —
  recomputed in one place (`computeTrustScore`) every time any signal
  changes, called from three different code paths (create, crowd vote,
  authority action) so the score can never drift out of sync with its inputs.
- **Resource recommendations are a deterministic rule table, not an LLM
  output** (`RESOURCE_RULES` in `aiService.js`) — deliberately. An LLM is a
  good fit for turning free text into a category/severity classification
  (fuzzy, language-y, low-stakes-if-wrong-because-a-human-reviews-it); it's
  a bad fit for inventing "how many ambulances" from scratch, since models
  can generate a plausible-sounding wrong number with total confidence. The
  same reasoning applies to the EOC chatbot's query parser (`chatService.js`)
  — a transparent keyword-to-filter mapping you can point to and explain,
  rather than a black box. Both are clean upgrade paths to a real LLM call
  once there's a validation/guardrail layer around the output.

## Roadmap / what was intentionally left out (and why)

These were all in the original spec but cut from v1 to ship something solid
by deadline. They're strong "what would you add next" interview answers:

- **Volunteer, NGO, and Admin portals** — the `User.role` enum and
  `authorize()` middleware already support them; it's mostly new dashboard
  pages plus a data model per role, no architecture change needed (the
  Hospital/Shelter portals in this repo are a working template for that).
- **AI image verification** (detecting flood/fire/damage in an uploaded
  photo + checking EXIF metadata) — the trust-score architecture already has
  a slot for it (the `aiScore` component); it's deferred because it needs
  real file upload wired up first (currently `imageUrl` is a plain string
  field with no upload endpoint behind it).
- **Dedicated police/fire/municipal authority roles** — right now EOC/rescue
  team stand in for "authority verification"; adding real roles is just
  extending the `User.role` enum and `authorize()` calls, no schema change.
- **Offline-first PWA** (service worker, local report queue, background
  sync) — would use the Background Sync API + IndexedDB.
- **BullMQ + Redis** for background jobs (e.g. batch AI re-analysis, digest
  emails) — not needed at this scale yet; would matter once report volume
  is high enough that AI calls shouldn't block the request/response cycle.
- **Ollama local-model fallback** for a fully offline AI mode.
- **SMS broadcast alerts** — the in-app alert bar covers push/in-app; SMS
  needs a paid provider (Twilio-class), intentionally left out of a
  free-tier project. Email would be a free add via Nodemailer + SMTP.
- **Weather/GIS overlays and AI route optimization** — free weather APIs
  exist (OpenWeatherMap), but real routing/traffic-avoidance needs a
  routing engine (OSRM/Mapbox) — a project-sized feature on its own.
- **Donations/funding module** with mock payment flow.
- **More demo scenarios** (cyclone, earthquake, wildfire) — the seed script
  is structured so adding another scenario is just another seed file.

## Skills this project demonstrates

Full MERN CRUD · JWT auth with refresh-token rotation · role-based
authorization middleware · MongoDB geospatial queries (`2dsphere`, `$near`) ·
real-time architecture with Socket.IO · external API integration with a
graceful degradation strategy · a from-scratch similarity algorithm · a
multi-signal weighted trust/verification system · file-to-base64 handling
without a storage service · React Query for server-state caching · protected
routing · responsive Tailwind UI.
