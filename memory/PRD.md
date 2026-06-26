# Board Game Scoreboard — PRD

## Original Problem Statement
Migrate https://github.com/navs7/board-game-score (static HTML/JS + Firebase) to **React + FastAPI + MongoDB** with **JWT auth**, **modern minimal dark mode**, **WebSocket real-time updates**, while preserving all original features and adding new ones. Separate git repo (user will Save to GitHub).

## User Choices
- Stack: React + FastAPI + MongoDB
- Real-time: WebSockets
- Auth: JWT (email + password)
- Theme: Modern minimal dark mode
- New features chosen: (b) Achievements/badges, (d) Multi-game library, (e) Team play, (f) Game timer & turn tracker, (g) Export PDF/CSV, (h) Share link with QR code

## Architecture
- **Backend** (`/app/backend/server.py`): FastAPI single-file; routes under `/api`. MongoDB via Motor. WebSocket at `/api/ws`. JWT via PyJWT (HS256, 60-min access, 7-day refresh). bcrypt password hashing. CORS open via `allow_origin_regex=".*"` + `allow_credentials=True`. Admin + default catalog seeded on startup.
- **Frontend** (`/app/frontend/src`): React 19 + Tailwind + Framer Motion + Phosphor Icons + qrcode.react + jspdf + papaparse. Auth token in localStorage + Authorization Bearer header (also httpOnly cookies as fallback). WebSocket auto-reconnect in `GameContext`.
- **Design**: Outfit + IBM Plex Sans, deep obsidian dark, neon green/volt yellow accents, tracing-beam border for active game, orbiting dice waiting screen.

## Core Features Implemented (Original)
- **Live Scoreboard** (/) — public, no auth. Waiting screen (orbiting dice + floating icons), live badge with pulsing ring, animated player rows, rank-change row flash (green/red), score-pill flash yellow, expandable team totals, share button → QR-code glass modal with copy-link.
- **Stats & History** (/stats) — 4 tabs: Leaderboard (sortable by Wins/WinRate/Avg/Games), History (expandable game rows), Players (searchable cards with badges), Achievements (gallery showing earned counts).
- **Admin Panel** (/admin, role=admin) — Start game (catalog dropdown or custom name, highest/lowest ranking), add players, **team play**, **turn timer**, submit per-round scores, reset, abandon, end game (saves to history + updates player records + computes achievements), next-turn rotation, add late-joining player.
- **Auth** — Login (`/login`), register, logout, /me, brute-force lockout (5 fails → 15-min lock, honors X-Forwarded-For), JWT in cookies + Bearer header.

## New Features Implemented
- **Achievements / Badges** (b) — 8 auto-computed: First Victory, High Roller, Champion, Veteran, Hat Trick, Unstoppable, Century Club, Win Rate 75%+. Shown on player cards and dedicated tab.
- **Multi-game library** (d) — `/library` page with catalog of board games (Catan, Monopoly, Scrabble, Golf (Cards), Yahtzee seeded). Admin can add/remove. Each catalog item tracks play_count and links to its filtered stats.
- **Team play** (e) — Toggle in start form. Teams have player rosters; team totals computed; winner label uses team name.
- **Game timer & turn tracker** (f) — Optional turn timer (configurable seconds). Live countdown on scoreboard with red-zone at ≤10s. Next-turn button rotates active player.
- **Export to PDF/CSV** (g) — From Stats page: full game history as CSV (papaparse) or styled PDF (jspdf-autotable).
- **Share link with QR code** (h) — Share button on live scoreboard opens glassmorphism modal with SVG QR code + copy-to-clipboard.

## What's Been Implemented (Jan 2026)
- ✅ Backend: 18 endpoints (auth, catalog, game lifecycle, history, players, achievements, WS)
- ✅ Frontend: 5 pages (Live, Library, Stats, Admin, Login) with full data-testid coverage
- ✅ Testing: 17/18 backend pytest pass; 100% frontend e2e flows pass
- ✅ Brute-force lockout fixed to honor X-Forwarded-For (K8s ingress)
- ✅ Real-time WebSocket broadcast on every state change

## Prioritized Backlog (P0/P1/P2)
- **P1**: Refactor `server.py` into routers (auth.py, game.py, catalog.py, ws.py)
- **P1**: Per-catalog leaderboards (filter players by board game)
- **P2**: Round chart visualization (recharts already installed)
- **P2**: Photo upload for player avatars
- **P2**: AI match recap using Emergent LLM key
- **P2**: PWA / installable on mobile
- **P2**: Multi-tenant communities (each admin → isolated DB)

## Next Action Items
- User: Use "Save to GitHub" button in chat input to push to a separate repo.
- Optional polish: cookie samesite=none + secure=true for production deployment.
