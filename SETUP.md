# 🔐 Setup Guide - Required Files

Is project ko naye PC par setup karne ke liye ye files chahiye hongi:

---

## 1. `.env` File

GitHub Secrets se values copy karke create karein:

**Secrets Required:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (optional)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_SERVER_CLIENT_ID`
- `CAPGO_PUBLIC_KEY`

**Location:** GitHub → Repo → Settings → Secrets and variables → Actions

---

## 2. `android/app/google-services.json`

**Location:** Firebase Console → Project → Project Settings → Your apps → Download google-services.json

---

## 3. Capgo Keys (Auto Updates ke liye)

**Private Key (`.capgo_key_v2`):**
- Capgo Dashboard → App Settings → Keys → Download private key

**Public Key (`.capgo_key_v2.pub`):**
- Capgo Dashboard → App Settings → Keys → Copy public key

---

## Quick Setup Steps

```bash
# 1. Clone repo
git clone https://github.com/mishra-aashu/caba-android-app.git
cd caba-android-app

# 2. Create .env file
cp .env.example .env  # (if available)
# Then fill values from GitHub Secrets

# 3. Download google-services.json
# From Firebase Console → Place in android/app/

# 4. Install dependencies
npm install

# 5. Run dev server
npm run dev
```

---

## ⚠️ Important Notes

- **Never commit these files to git:**
  - `.env`
  - `.capgo_key_v2`
  - `.capgo_key_v2.pub`
  - `android/app/google-services.json`
  - `firebase-debug.log`

- **GitHub Actions** secrets automatically use values during CI/CD builds

- **Local development** ke liye manually .env create karni hogi
