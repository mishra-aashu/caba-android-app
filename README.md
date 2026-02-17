<div align="center">

# 🚀 CaBa - Real-Time Communication Platform

[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7.2.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-2.83.0-3FCF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

*CaBa* derives from the Bhojpuri greeting "Kaa Baa?" (meaning "What's up?" or "How are things?"), embodying the essence of casual, friendly communication - much like how WhatsApp represents "What's up?" in modern messaging.

A comprehensive real-time communication platform built with React and Supabase, offering secure messaging, voice/video calling, and social features with a modern, responsive interface that brings people together through meaningful conversations.

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Real-time Messaging** | Instant text messaging with typing indicators, read receipts, and media sharing |
| 📞 **Voice & Video Calls** | WebRTC-based calling with TURN server support for global connectivity |
| 🖼️ **Media Sharing** | Upload and share images, videos, voice messages, and files |
| 📱 **QR Code Integration** | Quick contact sharing via QR codes |
| 👥 **Group Conversations** | Create and manage multi-user chat rooms |
| 📜 **Call History** | Comprehensive call logs with duration tracking |
| ⏰ **Reminders System** | Personal reminder creation and management |
| 📰 **News Feed** | Integrated news reading functionality |
| 🎨 **Theme Customization** | Multiple chat themes and wallpapers |
| 📲 **PWA Support** | App-like experience across devices |
| 🔔 **Push Notifications** | Firebase Cloud Messaging for timely notifications |
| 🖥️ **Desktop Support** | Full-featured desktop interface with dark mode |

---

## 🛠️ Tech Stack

### Frontend
- **React** 19.2.0 - UI Framework
- **React Router DOM** 7.9.6 - Routing
- **Vite** 7.2.2 - Build Tool
- **Lucide React** - Icons
- **CSS Custom Properties** - Styling

### Backend & Services
- **Supabase** 2.83.0 - Backend-as-a-Service (Auth, Database, Storage, Realtime)
- **Firebase** - Cloud Messaging & Push Notifications
- **WebRTC** - Voice/Video Calling
- **TURN Servers** - NAT Traversal

### Mobile
- **Capacitor** - Cross-platform mobile wrapper
- **CapGo** - App update management

### Development
- **ESLint** - Code linting
- **GitHub Actions** - CI/CD

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **pnpm**
- **Java JDK** (for Android builds)
- **Android SDK** (for Android builds)
- **Git**

---

## 🚦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/mishra-aashu/caba-android-app.git
cd caba-android-app
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see Configuration section below).

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-firebase-vapid-key

# Google OAuth (Optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret

# CapGo (Optional - for app updates)
CAPGO_PUBLIC_KEY=your-capgo-public-key
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in `supabase/migrations/`:
   - `create_groups_table.sql`
   - `add_groups_rls.sql`
   - `add_game_invitations.sql`
   - `add_rate_limiting.sql`
   - And other migration files as needed
3. Get your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Settings → API

### Firebase Setup

1. Create a project at [firebase.google.com](https://firebase.google.com)
2. Enable **Authentication** (Email/Password, Google)
3. Enable **Cloud Messaging** (Web push certificates)
4. Enable **Firestore Database**
5. Get your config from Project Settings → General

### TURN Server Configuration

Edit `public/turn-config.js` to configure your TURN servers for WebRTC:

```javascript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add your TURN servers here
]
```

---

## 📱 Building Android App

### Prerequisites

- Android SDK installed
- Java JDK 17+
- Gradle (or use gradlew)

### Build Commands

```bash
# Install Android dependencies
cd android
./gradlew assembleDebug

# Or build release
./gradlew assembleRelease
```

The APK will be generated at `android/app/build/outputs/apk/`

### CapGo Setup (Optional)

For automatic app updates:

1. Sign up at [capgo.app](https://capgo.app)
2. Add your public key to `.env`
3. Upload your APK to CapGo

---

## 🏗️ Project Structure

```
caba-android-app/
├── android/                    # Android native app (Capacitor)
│   ├── app/                   # Android app source
│   └── build.gradle           # Android build config
│
├── public/                    # Static assets
│   ├── assets/
│   │   ├── audio/            # Notification sounds
│   │   └── images/           # Static images
│   ├── deepar/               # AR face filter
│   ├── firebase-messaging-sw.js
│   ├── supabase-config.js
│   ├── turn-config.js
│   └── webrtc-calling.js
│
├── src/
│   ├── components/           # React components
│   │   ├── auth/            # Login, Signup, Password reset
│   │   ├── chat/            # Messaging components
│   │   ├── calls/           # Call UI components
│   │   ├── groups/          # Group chat features
│   │   ├── profile/         # User profile
│   │   ├── settings/        # App settings
│   │   └── common/          # Shared components
│   │
│   ├── contexts/            # React Context
│   │   ├── AuthContext.jsx
│   │   ├── ChatThemeContext.jsx
│   │   ├── DataContext.jsx
│   │   └── ThemeContext.jsx
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.jsx
│   │   ├── useRealtimeMessages.js
│   │   ├── useGroupMessages.js
│   │   ├── useCallHistory.js
│   │   └── ...
│   │
│   ├── services/           # Business logic
│   │   ├── authService.js
│   │   ├── callService.js
│   │   ├── messageService.js
│   │   ├── groupService.js
│   │   └── webrtcService.js
│   │
│   ├── utils/             # Utility functions
│   │   ├── chatHelpers.js
│   │   ├── cacheManager.js
│   │   ├── PushNotifications.js
│   │   └── ...
│   │
│   ├── styles/            # CSS files
│   ├── config/            # Configuration
│   │   └── supabase.js
│   ├── App.jsx           # Main app
│   └── main.jsx          # Entry point
│
├── supabase/
│   ├── config.toml
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
│
├── .github/
│   └── workflows/       # CI/CD pipelines
│
├── package.json
├── vite.config.js
├── capacitor.config.ts
└── README.md
```

---

## 🔧 Development Patterns

### Component Structure

```jsx
// Functional component with hooks
const ComponentName = () => {
  const { data, loading } = useSomeHook();
  
  if (loading) return <Loading />;
  
  return <div>{data}</div>;
};
```

### Adding New Features

1. Create component in appropriate directory
2. Add custom hook if needed in `src/hooks/`
3. Update styles in `src/styles/`
4. Add route in `App.jsx`

### Real-time Subscriptions

Always clean up subscriptions:

```jsx
useEffect(() => {
  const subscription = supabase
    .channel(...)
    .on(...)
    .subscribe();
    
  return () => subscription.unsubscribe();
}, []);
```

---

## 📦 Deployment

### Vercel (Web)

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Environment Variables for Vercel

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

### Android (Google Play)

1. Build release APK: `./android/gradlew assembleRelease`
2. Sign the APK
3. Upload to Google Play Console

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. Commit your **changes** (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

### Code Style

- Use functional components with hooks
- Follow existing import organization
- Add error handling with try-catch
- Clean up subscriptions in useEffect
- Use mobile-first responsive design

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Firebase](https://firebase.google.com) - Cloud messaging
- [WebRTC](https://webrtc.org) - Real-time communication
- [React](https://react.dev) - UI library
- [Capacitor](https://capacitorjs.com) - Cross-platform apps

---

<div align="center">

**Made with ❤️ for better communication**

Star ⭐ if you like this project!

</div>
