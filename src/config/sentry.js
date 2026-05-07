import { Capacitor } from '@capacitor/core';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export const initSentry = async () => {
  if (!SENTRY_DSN) {
    if (import.meta.env.PROD) {
      console.warn('[Sentry] DSN not configured - skipping initialization');
    } else {
      console.log('[Sentry] DSN not configured - skipping initialization');
    }
    return;
  }

  const { init, browserTracingIntegration, replayIntegration } = await import('@sentry/react');

  init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: document.querySelector('meta[name="build-time"]')?.content || 'unknown',

    // Custom tags
    initialScope: {
      tags: {
        platform: Capacitor.getPlatform(),
        native: Capacitor.isNativePlatform(),
      },
    },

    // Filter out noise
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      // Ignore AbortErrors from Supabase
      if (error?.name === 'AbortError') {
        return null;
      }

      // Ignore network timeouts (already handled by UI)
      if (error?.message?.includes('timeout') || error?.message?.includes('fetch')) {
        return null;
      }

      return event;
    },
  });
};

// User context updater (call from authStore)
export const setSentryUser = async (user) => {
  const { setUser } = await import('@sentry/react');
  if (!user) {
    setUser(null);
    return;
  }

  setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
};

// Breadcrumb helpers
export const addAuthBreadcrumb = async (action, data = {}) => {
  const { addBreadcrumb } = await import('@sentry/react');
  addBreadcrumb({
    category: 'auth',
    message: action,
    level: 'info',
    data,
  });
};

export const addRealtimeBreadcrumb = async (channel, event, data = {}) => {
  const { addBreadcrumb } = await import('@sentry/react');
  addBreadcrumb({
    category: 'realtime',
    message: `${channel}: ${event}`,
    level: 'info',
    data,
  });
};

export const addDbBreadcrumb = async (table, operation, data = {}) => {
  const { addBreadcrumb } = await import('@sentry/react');
  addBreadcrumb({
    category: 'database',
    message: `${operation} ${table}`,
    level: 'info',
    data,
  });
};
