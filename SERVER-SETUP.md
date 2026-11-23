# Knightly Setup & Hosting Guide

Knightly is a rental intelligence platform for Cape Town consisting of:
- **Backend API (`api/`)**: FastAPI + Playwright/Camoufox + Gemini AI
- **Web App (`web/`)**: Next.js (App Router)
- **Mobile App (`mobile/`)**: React Native (Expo + Expo Router)
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Media Storage**: Cloudflare R2 (`knightly-media` bucket)
- **Authentication**: Firebase Auth (Google Sign-In, Spark free tier)

---

## 1. Prerequisites
- Python **3.12+**
- Node.js **20+** (tested on v22)
- Git
- *(Optional for physical phone)* **Expo Go** installed on Android/iOS

---

## 2. Install Dependencies

### Backend (`api/`)
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r api\requirements.txt
.\.venv\Scripts\python.exe -m playwright install chromium
```

### Web (`web/`)
```powershell
cd web
npm install
```

### Mobile (`mobile/`)
```powershell
cd mobile
npm install
```

---

## 3. Environment Files (Gitignored)
Never commit `.env` or `.env.local` files. Create the following files with your own credentials:

### `api/.env`
```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Supabase Postgres (Transaction Pooler URI)
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Cloudflare R2 (knightly-media)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=knightly-media
# Optional public R2 dev/custom domain:
# R2_PUBLIC_URL=https://pub-xxxx.r2.dev

# Firebase Auth (JWT verification)
FIREBASE_PROJECT_ID=knightly-za
# Set to true in production:
FIREBASE_AUTH_REQUIRED=false

# Property24 Dev Cache Mode
P24_DEV_MODE=True

# Optional: Redis for standalone worker.py
# REDIS_URL=redis://...
```

### `web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=knightly-za.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=knightly-za
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=knightly-za.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_web_app_id
```

### `mobile/.env`
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=knightly-za
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
# Optional override for physical phone over LAN:
# EXPO_PUBLIC_API_URL=http://192.168.1.187:8000
```

---

## 4. Supabase Database Setup
1. Create a free project in Supabase.
2. Open **SQL Editor** and run `api/db/schema.sql` (enables `postgis` and creates core tables).
3. Remaining tables (`user_profiles`, `user_alerts`, `credit_transactions`, `sent_alert_listings`, `alert_reports`, `listings`, `listing_comments`, etc.) are automatically initialized on FastAPI startup.
4. Verify database connectivity at `GET http://127.0.0.1:8000/api/health/db` (should return `"engine": "supabase_postgres"`).

---

## 5. Running Locally

### 1. Start FastAPI Backend (Port `8000`)
Use `--host 0.0.0.0` so physical phones on the same Wi-Fi can connect:
```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir api --host 0.0.0.0 --port 8000
```

### 2. Start Next.js Web App (Port `3000`)
```powershell
cd web
npm run dev
```

### 3. Start Expo Mobile App (Port `8081`)
- **Browser simulation (Expo Web)**:
  ```powershell
  cd mobile
  npx expo start --web --port 8081
  ```
- **Physical Samsung / iOS phone (Expo Go)**:
  ```powershell
  cd mobile
  npx expo start
  ```
  Scan the QR code in Expo Go (same Wi-Fi, Mobile Hotspot, or `adb reverse tcp:8081 tcp:8081` + `adb reverse tcp:8000 tcp:8000` over USB).

---

## 6. \$0 Always-On PC Hosting (Replacing Cloud Run, Secret Manager & Artifact Registry)
Instead of paying for Cloud Run, Artifact Registry, and Secret Manager, you can run `api/` on a 24/7 PC with **Cloudflare Tunnel** (free, automatic HTTPS, no router port-forwarding, and residential IP protection for Property24):

1. **Install `cloudflared`** on the 24/7 PC (`winget install Cloudflare.cloudflared`).
2. **Authenticate & create a tunnel**:
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create knightly-api
   cloudflared tunnel route dns knightly-api api.yourdomain.com
   ```
3. **Run FastAPI + Tunnel on boot** (via Windows Task Scheduler or PM2):
   - FastAPI: `.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir api --host 127.0.0.1 --port 8000`
   - Tunnel: `cloudflared tunnel run --url http://127.0.0.1:8000 knightly-api`
4. **Update production settings**:
   - Set `FIREBASE_AUTH_REQUIRED=true` in `api/.env`.
   - Add your deployed Web URL to `allow_origins` in `api/main.py`.
   - Set `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` on Vercel / Cloudflare Pages (`web/`).
   - Keep the PC + router on a UPS/inverter for load-shedding resilience.

---

## 7. Pre-Launch Checklist
- [ ] Replace dev `POST /api/credits/topup` with a verified **Paystack / PayPal** webhook calling `add_credits()`.
- [ ] Set `FIREBASE_AUTH_REQUIRED=true` in production `api/.env`.
- [ ] Add Android release SHA-1 in Firebase Console (`knightly-za`) when building Play Store `.aab` via `eas build`.
- [ ] *(Optional)* Configure `REDIS_URL` and run `python -m worker` in `api/` to isolate scraping jobs.
