import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Supabase
vi.mock('../config/supabase', () => {
  const mockChannel = {
    subscribe: vi.fn((cb) => {
      if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
      return mockChannel;
    }),
    on: vi.fn(() => mockChannel),
    unsubscribe: vi.fn(() => Promise.resolve()),
    send: vi.fn(() => Promise.resolve()),
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: {}, error: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: {}, error: null })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: {}, error: null })) })),
      })),
      realtime: {
        channel: vi.fn(() => mockChannel),
        setAuth: vi.fn(),
      },
    },
    supabaseRealtime: {
      channel: vi.fn(() => mockChannel),
    },
  };
});

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

// Mock Sentry
vi.mock('../config/sentry', () => ({
  initSentry: vi.fn(),
  setSentryUser: vi.fn(),
  addAuthBreadcrumb: vi.fn(),
  addRealtimeBreadcrumb: vi.fn(),
  addDbBreadcrumb: vi.fn(),
}));
