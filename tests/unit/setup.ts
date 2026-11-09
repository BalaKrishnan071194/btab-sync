import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome API with Promise-based methods
const createMockStorage = () => ({
  get: vi.fn((keys: string | string[] | Record<string, unknown> | null) => {
    // Return btabSettings as empty object to prevent undefined errors
    return Promise.resolve({ btabSettings: {} });
  }),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
});

const mockChrome = {
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve({ success: true })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
    id: 'test-extension-id',
  },
  storage: {
    local: createMockStorage(),
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve({})),
    remove: vi.fn(() => Promise.resolve()),
    discard: vi.fn(() => Promise.resolve()),
    create: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  windows: {
    getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(() => Promise.resolve()),
    getAll: vi.fn(() => Promise.resolve([])),
  },
  i18n: {
    getMessage: vi.fn((key: string, subs?: string[]) => {
      // Return key with substitutions for testing
      if (subs && subs.length > 0) {
        let result = key;
        subs.forEach((sub, i) => {
          result = result.replace(`$${i + 1}$`, sub);
        });
        return result;
      }
      return key;
    }),
  },
  identity: {
    getAuthToken: vi.fn(() => Promise.resolve('mock-token')),
  },
  tabGroups: {
    query: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve({})),
  },
};

// @ts-ignore
global.chrome = mockChrome;
// @ts-ignore
global.browser = mockChrome;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)', // Default to dark theme in tests
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 0;
});

// Mock cancelAnimationFrame  
global.cancelAnimationFrame = vi.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock focus
HTMLElement.prototype.focus = vi.fn();
