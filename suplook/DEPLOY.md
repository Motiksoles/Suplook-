# Suplook Deployment Guide

## Option 1: Railway (Recommended)

### Deploy Server

1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub repo
4. Select the `suplook-server` folder
5. Add environment variables:
   - `ANTHROPIC_API_KEY` = your key
   - `GOOGLE_API_KEY` = your key
   - `YELP_API_KEY` = your key
   - `AUTH_KEY` = suplook-team-2024
   - `ADMIN_KEY` = suplook-admin-secret-2024
6. Deploy!

Railway gives you a URL like: `https://suplook-production.up.railway.app`

### Deploy UIs (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set env var: `VITE_SERVER_URL=https://your-railway-url.up.railway.app`

## Access Keys

**Team Key (read/write):**
```
suplook-team-2024
```

**Admin Key (full access):**
```
suplook-admin-secret-2024
```

## After Deployment

Your team can access:
- `https://suplook-ops.vercel.app` → Operations
- `https://suplook-training.vercel.app` → Training

Login with the team key.

---

**suplook.ai** — We look. You supply.
