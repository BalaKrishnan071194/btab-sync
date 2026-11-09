/**
 * Unified Browser Extension API
 *
 * Provides a lazy-loading `ext` object that wraps browser APIs.
 * All API access is deferred until actually called, preventing
 * ReferenceErrors when the module loads before the extension context is ready.
 *
 * Usage:
 *   import { ext } from '@/lib/browsers';
 *   const tabs = await ext.tabs.query({ active: true });
 */

// ============================================================================
// Browser Detection
// ============================================================================

type BrowserType = 'chrome' | 'firefox' | 'edge';

let detectedBrowser: BrowserType | null = null;

/**
 * Detects the current browser environment
 */
function detectBrowser(): BrowserType {
  if (detectedBrowser) return detectedBrowser;

  // Check for Firefox first (has browser.* namespace natively)
  if (
    typeof globalThis !== 'undefined' &&
    'browser' in globalThis &&
    typeof (globalThis as { browser?: { runtime?: unknown } }).browser?.runtime !== 'undefined'
  ) {
    if (typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent)) {
      detectedBrowser = 'firefox';
      return 'firefox';
    }
  }

  // Check for Edge
  if (typeof navigator !== 'undefined' && /Edg\//i.test(navigator.userAgent)) {
    detectedBrowser = 'edge';
    return 'edge';
  }

  // Default to Chrome
  detectedBrowser = 'chrome';
  return 'chrome';
}

// ============================================================================
// Safe API Access
// ============================================================================

/**
 * Gets the appropriate browser API object (chrome or browser)
 */
function getBrowserApi(): typeof chrome {
  // Chrome/Edge
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  // Firefox (browser namespace)
  const globalBrowser = (globalThis as { browser?: typeof chrome }).browser;
  if (globalBrowser && globalBrowser.runtime) {
    return globalBrowser;
  }
  throw new Error('[bTab] Browser extension APIs not available');
}

// ============================================================================
// Lazy Proxy Implementation
// ============================================================================

/**
 * Creates a deeply lazy proxy that only accesses browser APIs when methods are called.
 * This prevents ReferenceErrors during module initialization.
 */
function createLazyProxy(): typeof chrome & { isChrome: boolean; isFirefox: boolean; isEdge: boolean } {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;

      // Browser detection flags
      if (prop === 'isChrome') return detectBrowser() === 'chrome';
      if (prop === 'isFirefox') return detectBrowser() === 'firefox';
      if (prop === 'isEdge') return detectBrowser() === 'edge';

      // Return a proxy for namespaces (tabs, storage, runtime, etc.)
      return new Proxy({}, {
        get(_innerTarget, innerProp: string | symbol) {
          if (typeof innerProp === 'symbol') return undefined;

          // Lazy access to the actual API
          const api = getBrowserApi();
          const namespace = api[prop as keyof typeof chrome];

          if (!namespace || typeof namespace !== 'object') {
            console.warn(`[bTab] Namespace ${prop} not found`);
            return undefined;
          }

          const value = (namespace as Record<string, unknown>)[innerProp];

          // If it's a function, return it bound to the namespace
          if (typeof value === 'function') {
            return value.bind(namespace);
          }

          // If it's an object (like storage.local or events), wrap it in another proxy
          if (value && typeof value === 'object') {
            return new Proxy({}, {
              get(_deepTarget, deepProp: string | symbol) {
                if (typeof deepProp === 'symbol') return undefined;

                const deepValue = (value as Record<string, unknown>)[deepProp];
                if (typeof deepValue === 'function') {
                  return deepValue.bind(value);
                }
                return deepValue;
              }
            });
          }

          return value;
        }
      });
    }
  };

  return new Proxy({}, handler) as typeof chrome & { isChrome: boolean; isFirefox: boolean; isEdge: boolean };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Unified browser extension API object.
 * All access is lazy - APIs are only accessed when you actually call them.
 *
 * @example
 * ```typescript
 * import { ext } from '@/lib/browsers';
 *
 * // Query tabs
 * const tabs = await ext.tabs.query({ active: true, currentWindow: true });
 *
 * // Use storage
 * await ext.storage.local.set({ key: 'value' });
 * const data = await ext.storage.local.get('key');
 *
 * // Check browser
 * if (ext.isFirefox) {
 *   // Firefox-specific code
 * }
 * ```
 */
export const ext = createLazyProxy();

/**
 * Get the detected browser name
 */
export function getBrowserName(): BrowserType {
  return detectBrowser();
}

/**
 * Check if running in a browser extension context
 */
export function isExtensionContext(): boolean {
  try {
    const api = getBrowserApi();
    return !!api.runtime?.id;
  } catch {
    return false;
  }
}

// Re-export types for backwards compatibility
export type { BrowserAdapter } from './types';
export type {
  TabsAdapter,
  WindowsAdapter,
  StorageAdapter,
  AlarmsAdapter,
  RuntimeAdapter,
  ScriptingAdapter,
  BrowserEvent,
  StorageArea,
  SessionStorageArea,
} from './types';
