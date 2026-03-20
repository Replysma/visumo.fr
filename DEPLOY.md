# ZipView — Deployment Guide

## 1. Local Development

```bash
# Install dependencies
npm install

# Initialize DB (optional — auto-runs on first request)
npm run db:init

# Start dev server
npm run dev
# → http://localhost:3000
```

## 2. Environment Variables

Copy `.env.local` and configure:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | dev-secret | Change in production (32+ chars) |
| `NEXT_PUBLIC_MAX_FREE_SIZE_MB` | 50 | Free plan upload limit |
| `NEXT_PUBLIC_MAX_PREMIUM_SIZE_MB` | 500 | Premium plan upload limit |
| `STORAGE_PATH` | `./tmp/zipview` | Where archives are stored |
| `FILE_TTL_FREE_HOURS` | 2 | Auto-delete free archives after N hours |
| `FILE_TTL_PREMIUM_HOURS` | 48 | Auto-delete premium archives after N hours |

## 3. Vercel Deployment (Frontend + API)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set env vars in Vercel dashboard or via CLI:
vercel env add JWT_SECRET
vercel env add STORAGE_PATH   # Use /tmp for serverless (ephemeral)
```

> **Note:** Vercel uses ephemeral `/tmp` storage. For production, replace `lib/storage.ts` with S3/R2 storage.

## 4. Railway / Render Deployment (Persistent)

1. Push code to GitHub
2. Connect repo to Railway/Render
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add env vars in dashboard
6. Railway provides a persistent volume — set `STORAGE_PATH=/data/zipview`

## 5. S3 Storage (Production Upgrade)

Replace `saveUploadedFile` / `extractFile` in `lib/storage.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION })

export async function saveUploadedFile(id: string, ext: string, buffer: Buffer) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `archives/${id}/original.${ext}`,
    Body: buffer,
  }))
}
```

## 6. Stripe Integration

```bash
npm install stripe @stripe/stripe-js
```

Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Create price in Stripe dashboard, then add `/api/stripe/checkout` route:

```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const auth = getAuthFromRequest(request)
  if (!auth) return unauthorized()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: 'price_XXXXX', quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    metadata: { userId: auth.userId },
  })

  return NextResponse.json({ url: session.url })
}
```

## 7. Database Schema

```sql
-- users table
CREATE TABLE users (
  id          TEXT PRIMARY KEY,         -- UUID
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,            -- bcrypt hash
  plan        TEXT DEFAULT 'free',      -- 'free' | 'premium'
  created_at  TEXT DEFAULT (datetime('now'))
);

-- archives table
CREATE TABLE archives (
  id              TEXT PRIMARY KEY,     -- UUID
  user_id         TEXT,                 -- NULL for anonymous
  session_id      TEXT,                 -- for anonymous users
  name            TEXT NOT NULL,        -- original filename
  type            TEXT NOT NULL,        -- 'zip' | 'rar'
  size            INTEGER NOT NULL,     -- bytes
  file_count      INTEGER DEFAULT 0,
  dir_count       INTEGER DEFAULT 0,
  storage_path    TEXT NOT NULL,        -- path to archive on disk
  tree_json       TEXT DEFAULT '[]',    -- JSON file tree
  uploaded_at     TEXT DEFAULT (datetime('now')),
  expires_at      TEXT NOT NULL         -- auto-delete after this
);
```

## 8. API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/upload` | Upload ZIP/RAR archive |
| GET | `/api/files` | List user's archives |
| GET | `/api/files/[id]` | Get archive info + tree |
| DELETE | `/api/files/[id]` | Delete archive |
| GET | `/api/files/[id]/preview?path=` | Preview a file |
| GET | `/api/files/[id]/download?path=` | Download a file |
