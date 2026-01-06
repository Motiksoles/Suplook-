# Suplook

**AI looks. You supply.**

Visual AI that looks at any business and tells distributors exactly what to sell them.

## What It Does

1. **Scrapes** restaurant/business data from Google Places
2. **Hunts photos** from Yelp, Instagram, Google
3. **Analyzes** photos with Claude Vision AI
4. **Predicts** what products they need
5. **Learns** from human corrections
6. **Tracks outcomes** to build the moat

## Architecture

```
suplook-ops (Port 5173)     → Operations UI (scrape, outreach, outcomes)
suplook-training (Port 5174) → Training UI (correct AI, graduate leads)
suplook-server (Port 3009)   → Vision AI Server (analyze, learn, store)
```

## Quick Start

```bash
# Terminal 1: Server
cd suplook-server
npm install
cp .env.example .env  # Add your API keys
npm start

# Terminal 2: Operations UI
cd suplook-ops
npm install
npm run dev

# Terminal 3: Training UI
cd suplook-training
npm install
npm run dev
```

## Access Keys

- **Team:** `suplook-team-2024`
- **Admin:** `suplook-admin-secret-2024`

## Required API Keys

- `ANTHROPIC_API_KEY` - Claude Vision AI
- `GOOGLE_API_KEY` - Places API
- `YELP_API_KEY` - Business photos

## The Moat

Every correction and outcome builds proprietary training data:
- AI suggestions → Human corrections → Better AI
- Outreach sent → Outcomes tracked → Conversion data
- Field feedback → What they actually needed → Ground truth

---

**suplook.ai** — See what they need. Sell what they want.
