# CaBa - Real-Time Communication Platform

*CaBa* derives from the Bhojpuri greeting "Kaa Baa?" (meaning "What's up?" or "How are things?"), embodying the essence of casual, friendly communication - much like how WhatsApp represents "What's up?" in modern messaging.

A comprehensive real-time communication platform built with React and Supabase, offering secure messaging, voice/video calling, and social features with a modern, responsive interface that brings people together through meaningful conversations.

## Features

- **Real-time Messaging** - Instant text messaging with typing indicators
- **Voice & Video Calls** - WebRTC-based calling with TURN server support
- **Media Sharing** - Upload and share images, videos, and files
- **QR Code Integration** - Quick contact sharing via QR codes
- **Group Conversations** - Multi-user chat rooms
- **Call History** - Comprehensive call logs with duration tracking
- **Reminders System** - Personal reminder creation and management
- **News Feed** - Integrated news reading functionality
- **Theme Customization** - Multiple chat themes and wallpapers
- **Progressive Web App** - App-like experience across devices

## Tech Stack

- **Frontend**: React 19.2.0, React Router DOM 7.9.6
- **Build Tool**: Vite 7.2.2 with HMR
- **Backend**: Supabase 2.83.0 (PostgreSQL, Auth, Storage)
- **Communication**: WebRTC, TURN servers
- **UI**: Lucide React icons, CSS custom properties
- **QR Codes**: html5-qrcode, qrcode libraries
- **HTTP Client**: Axios 1.13.2

## Configuration

1. Set up Supabase project and update `src/config/supabase.js`
2. Configure TURN servers in `public/turn-config.js`
3. Update environment variables in `.env`
4. Configure database schema using provided SQL files

## Architecture

### Component Structure
- **Feature-based organization** - Components grouped by functionality
- **Custom hooks** - Reusable logic for real-time updates, media handling
- **Context API** - Global state management for themes and authentication
- **Modular CSS** - Scoped styling with CSS custom properties

### Key Directories
- `src/components/` - React components organized by feature
- `src/hooks/` - Custom hooks for business logic
- `src/contexts/` - React Context providers
- `src/services/` - WebRTC and call management services
- `src/utils/` - Utility functions and helpers
- `public/` - Static assets and configuration files

CaBa/
├── public/                    # Static assets & config
│   ├── assets/audio/         # Notification sounds
│   ├── assets/images/        # Static images
│   ├── *.html               # Auth pages (login, signup, etc.)
│   ├── supabase-config.js   # Supabase configuration
│   ├── turn-config.js       # WebRTC TURN servers
│   └── webrtc-calling.js    # Standalone calling script
│
├── src/
│   ├── components/          # React components by feature
│   │   ├── auth/           # Authentication (login, signup, reset)
│   │   ├── chat/           # Messaging (chat, messages, typing)
│   │   ├── calls/          # Voice/video calling interface
│   │   ├── media/          # File upload/download, WebRTC
│   │   ├── qr/             # QR code scanner/generator
│   │   ├── profile/        # User profile management
│   │   ├── reminders/      # Reminder system
│   │   ├── news/           # News feed
│   │   ├── settings/       # App settings
│   │   ├── blocked/        # Blocked users management
│   │   ├── shared-profile/ # Public profile sharing
│   │   └── common/         # Reusable UI (modals, dropdowns)
│   │
│   ├── contexts/           # React Context providers
│   │   ├── SupabaseContext.jsx    # Database & auth state
│   │   ├── ChatThemeContext.jsx   # Theme management
│   │   └── ThemeContext.jsx       # Global theming
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── media/          # Media handling hooks
│   │   ├── useAuth.jsx     # Authentication logic
│   │   ├── useRealtimeMessages.js # Real-time messaging
│   │   └── useCallHistory.js      # Call management
│   │
│   ├── services/           # Business logic services
│   │   ├── authService.js     # Authentication service
│   │   ├── callService.js     # Call management
│   │   └── webrtcService.js   # WebRTC communication
│   │
│   ├── utils/              # Helper functions
│   │   ├── cacheManager.js    # Local storage management
│   │   ├── callUtils.js       # Call utilities
│   │   └── supabase.js        # Database helpers
│   │
│   ├── styles/             # CSS files
│   │   ├── global.css         # Global styles
│   │   ├── theme-*.css        # Theme variations
│   │   └── [feature].css      # Feature-specific styles
│   │
│   ├── config/             # Configuration
│   │   └── supabase.js        # Supabase client setup
│   │
│   ├── App.jsx             # Main app component & routing
│   └── main.jsx            # React DOM entry point
│
├── .github/workflows/      # CI/CD deployment
├── package.json           # Dependencies & scripts
└── vite.config.js         # Build configuration


## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- WebRTC support required for calling features
- Progressive Web App capabilities

## Contributing

Follow the established patterns:
- Functional components with hooks
- Consistent import organization
- Error handling with try-catch blocks
- Real-time subscriptions cleanup
- Mobile-first responsive design

## License

This project is licensed under the MIT License.

