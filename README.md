<div align="center">
  <img src="https://api.iconify.design/lucide:rocket.svg?height=48&color=%23646cff" alt="Rocket Icon" />

  # ELEVENGRAM
  ### Cross-Platform Native Messenger
  
  <img src="https://api.iconify.design/lucide:award.svg?height=24&color=%23ffcc00" vertical-align="middle" /> **Proudly Pioneering as India's First Open-Source Chatting Application** <img src="https://api.iconify.design/twemoji:flag-india.svg?height=24" vertical-align="middle" />
  
  **Crafted by [Aashutosh Mishra](https://github.com/mishra-aashu) | IIT Madras**

  > **ELEVENGRAM** represents the **11th Level** of communication. While most platforms stop at ten, we chose to go beyond – elevating every interaction, every connection, and every moment to be more secure, private, and seamless than ever before.
  
  *A high-performance **Hybrid-Native** communication platform built with React and Capacitor, offering a "Write once, run everywhere" experience. It combines the speed of web development with the power of native mobile features to bring people together through meaningful conversations.*

  [![](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
  [![Vite](https://img.shields.io/badge/Vite-7.2.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
  [![Supabase](https://img.shields.io/badge/Supabase-2.95.3-3FCF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
  [![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel)](https://caba-android-app.vercel.app/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

</div>

---

## <img src="https://api.iconify.design/lucide:sparkles.svg?height=24&color=%23646cff" vertical-align="middle" /> Features

| Feature | Description |
|:---|:---|
| <img src="https://api.iconify.design/lucide:message-square.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Real-time Messaging** | Instant text messaging with typing indicators, read receipts, and media sharing |
| <img src="https://api.iconify.design/lucide:phone.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Voice & Video Calls** | WebRTC-based calling with TURN server support for global connectivity |
| <img src="https://api.iconify.design/lucide:swords.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Arena Games** | Competitive arena games integrated directly into the chat experience |
| <img src="https://api.iconify.design/lucide:image.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Media Sharing** | Upload and share images, videos, voice messages, and files |
| <img src="https://api.iconify.design/lucide:qr-code.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **QR Code Integration** | Quick contact sharing via QR codes |
| <img src="https://api.iconify.design/lucide:users.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Group Conversations** | Create and manage multi-user chat rooms |
| <img src="https://api.iconify.design/lucide:history.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Call History** | Comprehensive call logs with duration tracking |
| <img src="https://api.iconify.design/lucide:alarm-clock.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Reminders System** | Personal reminder creation and management |
| <img src="https://api.iconify.design/lucide:headset.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Support Chat** | Integrated support chat for user assistance |
| <img src="https://api.iconify.design/lucide:palette.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Theme Customization** | Multiple chat themes and wallpapers (Vibration, Custom Emojis) |
| <img src="https://api.iconify.design/lucide:smartphone.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **PWA Support** | App-like experience with standalone mode and safe area support |
| <img src="https://api.iconify.design/lucide:bell.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Push Notifications** | Firebase Cloud Messaging with background sync |
| <img src="https://api.iconify.design/lucide:zap.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Offline-First** | Seamless messaging with automatic background sync when connection returns |
| <img src="https://api.iconify.design/lucide:monitor.svg?height=18&color=%233fcf8e" vertical-align="middle" /> **Desktop Support** | Full-featured desktop interface with modern styling |

---

## <img src="https://api.iconify.design/lucide:layers.svg?height=24&color=%23646cff" vertical-align="middle" /> Tech Stack

### Frontend
- **React** 19.2.0 - UI Framework
- **React Router DOM** 7.9.6 - Routing
- **Vite** 7.2.2 - Build Tool
- **Lucide React** - Icons
- **CSS Custom Properties** - Styling

### Backend & Services
- **Supabase** 2.95.3 - Backend-as-a-Service (Auth, Database, Storage, Realtime)
- **Firebase** 12.7.0 - Cloud Messaging & Push Notifications
- **WebRTC** - Voice/Video Calling
- **TURN Servers** - NAT Traversal

### Mobile
- **Capacitor** 6.2.1 - Cross-platform mobile wrapper
- **Capacitor App** 6.0.3 - Application management
### Development
- **ESLint** - Code linting
- **GitHub Actions** - CI/CD

### Architecture
- **Local-First Sync**: Powered by Dexie.js for instant UI and offline reliability
- **Real-time Backend**: Supabase for secure data persistence and live updates

---

## <img src="https://api.iconify.design/lucide:list-checks.svg?height=24&color=%23646cff" vertical-align="middle" /> Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v22 or higher; v24 recommended)
- **npm** (v10 or higher)
- **Android Studio** (Latest "Ladybug" or newer recommended)
- **Java JDK** (v21 or higher)
- **Android SDK** (API 36)
- **Git**

---

## <img src="https://api.iconify.design/lucide:play.svg?height=24&color=%23646cff" vertical-align="middle" /> Getting Started

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

## <img src="https://api.iconify.design/lucide:settings.svg?height=24&color=%23646cff" vertical-align="middle" /> Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

Refer to the `.env.example` file in the root directory for the required variables and their structure.

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Backend services are automatically configured on the linked project.
3. Get your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Settings → API

### Firebase Setup

1. Create a project at [firebase.google.com](https://firebase.google.com)
2. Enable **Authentication** (Email/Password, Google)
3. Enable **Cloud Messaging** (Web push certificates)
4. Enable **Firebase Authentication** (Google, Email/Password)
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

---

## <img src="https://api.iconify.design/lucide:smartphone-charging.svg?height=24&color=%23646cff" vertical-align="middle" /> Native Android Development

This project is built using **Capacitor**, allowing for deep integration with **Android Studio** for native debugging and performance profiling.

### 🛠️ Opening via Android Studio
To open the native Android project:
```bash
npx cap open android
```
Alternatively, open the `android/` directory directly in Android Studio.

### ⚡ Professional Workflow
1.  **Sync Code**: Every time you build the web project, sync it with native:
    ```bash
    npm run build
    npx cap sync android
    ```
2.  **Debug**: Use the Android Studio debugger for native plugin troubleshooting.
3.  **Build Signed Bundle**: Use **Build > Generate Signed Bundle / APK** in Android Studio for production releases.

---

## <img src="https://api.iconify.design/lucide:folder-tree.svg?height=24&color=%23646cff" vertical-align="middle" /> Project Structure

```text
caba-android-app/
├── .github/                   # CI/CD Workflows (OTA deployments, Auto-releases)
├── android/                   # Native Android Project (Capacitor generated)
│   ├── app/                   # Main Android application source
│   └── build.gradle           # Native build configuration
├── public/                    # Static assets
│   ├── icons/                 # PWA and App icons
│   ├── audio/                 # Sound effects for calls/messages
│   └── manifests/             # PWA and Web App manifests
├── src/                       # Frontend Source Code
│   ├── components/            # UI Components
│   │   ├── auth/              # Login, Register, Recovery
│   │   ├── chat/              # Message lists, Input area, Bubbles
│   │   ├── calls/             # WebRTC Call screens (Audio/Video)
│   │   ├── settings/          # User preferences & Theme toggles
│   │   ├── layout/            # Sidebar, BottomNav, Shell
│   │   └── games/             # Arena games integration
│   ├── contexts/              # React Context API (Auth, Notifications, Audio)
│   ├── hooks/                 # Custom React Hooks
│   │   ├── chat/              # Messaging logic & Realtime subscriptions
│   │   └── media/             # Camera, Gallery, and File handling
│   ├── services/              # Core Logic & API Integrations
│   │   ├── supabase/          # Database, Storage & Auth logic
│   │   ├── firebase/          # Push Notifications (FCM)
│   │   └── webrtc/            # Real-time Call signaling
│   ├── store/                 # Zustand State Management
│   ├── styles/                # Global CSS, Animations & Themes
│   ├── utils/                 # Helper functions & Constants
│   └── main.jsx               # App entry point & Router setup
├── supabase/                  # Backend Infrastructure
│   ├── migrations/            # SQL Database Schema versions
│   └── functions/             # Deno-based Edge Functions
├── scripts/                   # Automation scripts (Sprite generation, OTA)
├── package.json               # Dependencies & Build scripts
└── vite.config.js             # Vite build & Plugin configuration
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

Refer to the `.env.example` file for the required keys.

### Android (Google Play)

1. Build release APK: `./android/gradlew assembleRelease`
2. Sign the APK
3. Upload to Google Play Console

---

## <img src="https://api.iconify.design/lucide:users-round.svg?height=24&color=%23646cff" vertical-align="middle" /> Contributing

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

## <img src="https://api.iconify.design/lucide:file-text.svg?height=24&color=%23646cff" vertical-align="middle" /> License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## <img src="https://api.iconify.design/lucide:heart.svg?height=24&color=%23ff4b4b" vertical-align="middle" /> Acknowledgments

- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Firebase](https://firebase.google.com) - Cloud messaging
- [WebRTC](https://webrtc.org) - Real-time communication
- [React](https://react.dev) - UI library
- [Capacitor](https://capacitorjs.com) - Cross-platform apps
<div align="center">

  **Thank you for choosing Elevengram for your communication needs.**

  © 2026 Aashutosh Mishra | IIT Madras. All rights reserved.

  Star <img src="https://api.iconify.design/lucide:star.svg?height=18&color=%23ffcc00" vertical-align="middle" /> if you like this project!

</div>
