const techData = [
  {
    id: 'frontend',
    title: 'Frontend Core',
    icon: 'Code2',
    color: 'text-cyan-400',
    details: [
      {
        tech: 'React',
        role: 'UI FRAMEWORK',
        desc: 'Powers scalable component architecture for dynamic user interfaces, enabling event-driven rendering and seamless state management in real-time communication flows.',
        meta: 'v19.2.0',
        highlight: '#61DAFB'
      },
      {
        tech: 'TypeScript',
        role: 'TYPE SYSTEM',
        desc: 'Enforces strict type safety and compile-time error detection, enhancing code reliability and maintainability in complex WebRTC integrations.',
        meta: 'v5.9.3',
        highlight: '#3178C6'
      },
      {
        tech: 'Vite',
        role: 'BUILD TOOL',
        desc: 'Delivers lightning-fast hot module replacement and optimized bundling, minimizing latency in development and production environments.',
        meta: 'v7.2.2',
        highlight: '#646CFF'
      }
    ]
  },
  {
    id: 'backend',
    title: 'Backend Infrastructure',
    icon: 'Server',
    color: 'text-green-400',
    details: [
      {
        tech: 'Supabase',
        role: 'DATABASE SERVICE',
        desc: 'Provides real-time database synchronization and authentication, supporting scalable user management and data persistence for messaging and call history.',
        meta: 'v2.83.0',
        highlight: '#3ECF8E'
      },
      {
        tech: 'Capacitor',
        role: 'MOBILE BRIDGE',
        desc: 'Enables cross-platform native functionality, bridging web technologies to mobile hardware for camera access and push notifications.',
        meta: 'v8.0.0',
        highlight: '#119EFF'
      },
      {
        tech: 'WebRTC',
        role: 'REAL-TIME ENGINE',
        desc: 'Facilitates peer-to-peer audio/video streaming with low-latency signaling, ensuring high-quality communication channels.',
        meta: 'Custom Implementation',
        highlight: '#000000'
      }
    ]
  },
  {
    id: 'design',
    title: 'Design System',
    icon: 'Palette',
    color: 'text-purple-400',
    details: [
      {
        tech: 'Lucide React',
        role: 'ICON LIBRARY',
        desc: 'Delivers consistent, scalable vector icons for intuitive UI elements, optimizing visual hierarchy and user experience.',
        meta: 'v0.554.0',
        highlight: '#000000'
      },
      {
        tech: 'Custom CSS',
        role: 'STYLE ARCHITECTURE',
        desc: 'Implements responsive, theme-aware styling with glassmorphism effects, ensuring adaptive layouts across devices.',
        meta: 'CSS3',
        highlight: '#1572B6'
      }
    ]
  },
  {
    id: 'performance',
    title: 'Performance Optimization',
    icon: 'Zap',
    color: 'text-yellow-400',
    details: [
      {
        tech: 'Vite',
        role: 'DEV SERVER',
        desc: 'Accelerates development cycles with instant hot reloading and efficient asset processing, reducing build times significantly.',
        meta: 'v7.2.2',
        highlight: '#646CFF'
      },
      {
        tech: 'Capacitor Updater',
        role: 'OTA UPDATES',
        desc: 'Enables over-the-air app updates, minimizing downtime and ensuring seamless feature deployments across mobile platforms.',
        meta: 'v7.34.2',
        highlight: '#FF6B35'
      }
    ]
  }
];

export default techData;