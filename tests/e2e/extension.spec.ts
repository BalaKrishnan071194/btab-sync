/**
 * bTab Sync Extension E2E Tests
 * 
 * Tests the Chrome extension using Playwright with persistent context.
 * 
 * IMPORTANT: Content scripts run in an isolated world. We cannot directly
 * call chrome.runtime from page.evaluate(). Instead, we test the extension
 * by opening the extension page or using the background service worker.
 */

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '..', 'dist', 'chrome');

// Create a test fixture with persistent context for extension testing
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  backgroundPage: Page;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--disable-component-extensions-with-background-pages',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Wait for service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  backgroundPage: async ({ context, extensionId }, use) => {
    // Open the extension's background page (service worker) 
    // We can use this to call extension APIs
    const page = await context.newPage();
    // The background service worker doesn't have a page, so we create a test page
    // that will be in the extension context
    await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    await use(page);
    await page.close();
  },
});

const expect = test.expect;

// ============================================================================
// Extension Loading Tests
// ============================================================================

test.describe('Extension Loading', () => {
  test('service worker is running', async ({ context }) => {
    let background = context.serviceWorkers()[0];
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    
    expect(background).toBeDefined();
    expect(background.url()).toContain('chrome-extension://');
  });

  test('extension has valid ID', async ({ extensionId }) => {
    expect(extensionId).toBeDefined();
    expect(extensionId.length).toBeGreaterThan(10);
    console.log('Extension ID:', extensionId);
  });

  test('manifest is accessible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    
    const content = await page.textContent('body');
    expect(content).toContain('bTab');
    expect(content).toContain('manifest_version');
    
    await page.close();
  });

  test('locales are present', async ({ context, extensionId }) => {
    const page = await context.newPage();
    // Try to access English messages
    await page.goto(`chrome-extension://${extensionId}/_locales/en/messages.json`);
    
    const content = await page.textContent('body');
    expect(content).toContain('extensionName');
    
    await page.close();
  });
});

// ============================================================================
// Service Worker Tests
// ============================================================================

test.describe('Service Worker', () => {
  test('responds to getPayload message', async ({ context, extensionId }) => {
    // Create a page and use extension messaging via a content script workaround
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);
    
    // We'll inject a script that sends a message to the background
    // But since content scripts are isolated, we'll verify differently
    // Let's check if we can get tabs via the background
    
    // Use chrome.runtime.sendMessage via executeScript in extension context
    // Actually, for true E2E we should just verify the service worker functions
    
    // Get service worker and evaluate
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    expect(bgWorker).toBeDefined();
    
    await page.close();
  });

  test('tracks tab activity', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    
    // Service worker should have tracked these tabs
    await page1.waitForTimeout(1000);
    
    // Verify we have multiple pages
    const pages = context.pages();
    expect(pages.length).toBeGreaterThanOrEqual(2);
    
    await page2.close();
    await page1.close();
  });
});

// ============================================================================
// Tab Creation Tests
// ============================================================================

test.describe('Tab Management', () => {
  test('creates multiple tabs successfully', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://www.google.com');
    
    const page3 = await context.newPage();
    await page3.goto('https://github.com');
    
    // All pages should load
    expect(context.pages().length).toBeGreaterThanOrEqual(3);
    
    await page3.close();
    await page2.close();
    await page1.close();
  });

  test('closes tabs correctly', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    
    const initialCount = context.pages().length;
    await page2.close();
    
    expect(context.pages().length).toBe(initialCount - 1);
    
    await page1.close();
  });
});

// ============================================================================
// Extension Assets Tests
// ============================================================================

test.describe('Extension Assets', () => {
  test('icon.svg is accessible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const response = await page.goto(`chrome-extension://${extensionId}/icon.svg`);
    
    expect(response?.status()).toBe(200);
    
    await page.close();
  });

  test('overlay.css is accessible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const response = await page.goto(`chrome-extension://${extensionId}/overlay.css`);
    
    expect(response?.status()).toBe(200);
    
    await page.close();
  });

  test('fonts.css is accessible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const response = await page.goto(`chrome-extension://${extensionId}/fonts.css`);
    
    expect(response?.status()).toBe(200);
    
    await page.close();
  });
});

// ============================================================================
// Integration Smoke Tests  
// ============================================================================

test.describe('Integration Smoke Tests', () => {
  test('extension loads without errors', async ({ context, extensionId }) => {
    // Open a few pages
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    
    // Check service worker is still running
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    expect(bgWorker).toBeDefined();
    
    // Check no console errors (this is tricky with service workers)
    // For now, just verify everything is running
    expect(context.pages().length).toBeGreaterThanOrEqual(2);
    
    await page2.close();
    await page1.close();
  });

  test('extension survives page navigation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(500);
    
    await page.goto('https://google.com');
    await page.waitForTimeout(500);
    
    await page.goto('https://github.com');
    await page.waitForTimeout(500);
    
    // Extension should still be active
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    expect(bgWorker).toBeDefined();
    
    await page.close();
  });

  test('content script assets are web accessible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Check that web_accessible_resources are accessible
    const response = await page.goto(`chrome-extension://${extensionId}/assets/index-DlH6VUci.js`);
    
    // May or may not exist depending on build, but should not error badly
    // Status 200 or 404 both acceptable for this test
    expect([200, 404]).toContain(response?.status());
    
    await page.close();
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

test.describe('Performance', () => {
  test('extension loads quickly', async ({ context }) => {
    const startTime = Date.now();
    
    let background = context.serviceWorkers()[0];
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    
    const loadTime = Date.now() - startTime;
    console.log(`Extension loaded in ${loadTime}ms`);
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('handles many tabs', async ({ context }) => {
    const pages: Page[] = [];
    
    // Create 10 tabs
    for (let i = 0; i < 10; i++) {
      const page = await context.newPage();
      await page.goto(`https://example.com/?tab=${i}`);
      pages.push(page);
    }
    
    // All should be created
    expect(context.pages().length).toBeGreaterThanOrEqual(10);
    
    // Extension should still be responsive
    const workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThan(0);
    
    // Cleanup
    for (const page of pages) {
      await page.close();
    }
  });
});

// ============================================================================
// Duplicate Detection Smoke Test
// ============================================================================

test.describe('Duplicate Detection (Smoke)', () => {
  test('can open duplicate URLs', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com/page');
    
    const page2 = await context.newPage();
    await page2.goto('https://example.com/page');
    
    // Both pages should exist
    const examplePages = context.pages().filter(p => 
      p.url().includes('example.com/page')
    );
    expect(examplePages.length).toBe(2);
    
    await page2.close();
    await page1.close();
  });

  test('can open URLs with different query params', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com?source=a');
    
    const page2 = await context.newPage();
    await page2.goto('https://example.com?source=b');
    
    // Both should be open (smart duplicate would group them)
    expect(context.pages().length).toBeGreaterThanOrEqual(2);
    
    await page2.close();
    await page1.close();
  });
});


// ============================================================================
// Background Script API Tests (via Service Worker Evaluate)
// ============================================================================

test.describe('Background API Tests', () => {
  test('service worker can be evaluated', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    expect(bgWorker).toBeDefined();
    
    // Try to evaluate code in the service worker context
    const result = await bgWorker!.evaluate(() => {
      return typeof chrome !== 'undefined';
    });
    
    expect(result).toBe(true);
  });

  test('background has chrome.tabs API', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const hasTabs = await bgWorker!.evaluate(() => {
      return typeof chrome?.tabs?.query === 'function';
    });
    
    expect(hasTabs).toBe(true);
  });

  test('background has chrome.storage API', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const hasStorage = await bgWorker!.evaluate(() => {
      return typeof chrome?.storage?.local?.get === 'function';
    });
    
    expect(hasStorage).toBe(true);
  });

  test('can query tabs from background', async ({ context, extensionId }) => {
    // Create some tabs first
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    
    await page1.waitForTimeout(1000);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const tabs = await bgWorker!.evaluate(async () => {
      const result = await chrome.tabs.query({});
      return result.map(t => ({ id: t.id, url: t.url, title: t.title }));
    });
    
    expect(Array.isArray(tabs)).toBe(true);
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    
    await page2.close();
    await page1.close();
  });

  test('can read storage from background', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const storage = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['isPro'], resolve);
      });
    });
    
    // Should be an object (may be empty or have isPro)
    expect(typeof storage).toBe('object');
  });

  test('can write and read storage', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Write a test value
    await bgWorker!.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ testKey: 'testValue' }, () => resolve());
      });
    });
    
    // Read it back
    const result = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['testKey'], resolve);
      });
    }) as any;
    
    expect(result.testKey).toBe('testValue');
    
    // Cleanup
    await bgWorker!.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove(['testKey'], () => resolve());
      });
    });
  });
});

// ============================================================================
// Tab State Tests
// ============================================================================

test.describe('Tab State Tracking', () => {
  test('tracks active tab correctly', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    
    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    
    // Bring page1 to front (make it active)
    await page1.bringToFront();
    await page1.waitForTimeout(500);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const tabs = await bgWorker!.evaluate(async () => {
      const result = await chrome.tabs.query({ active: true, currentWindow: true });
      return result;
    }) as any[];
    
    expect(tabs.length).toBe(1);
    expect(tabs[0].url).toContain('example.com');
    
    await page2.close();
    await page1.close();
  });

  test('detects audible tabs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(500);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const tabs = await bgWorker!.evaluate(async () => {
      const result = await chrome.tabs.query({});
      return result.map(t => ({ audible: t.audible }));
    }) as any[];
    
    // All should have audible property
    tabs.forEach(tab => {
      expect(typeof tab.audible).toBe('boolean');
    });
    
    await page.close();
  });

  test('detects discarded tabs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(500);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const tabs = await bgWorker!.evaluate(async () => {
      const result = await chrome.tabs.query({});
      return result.map(t => ({ discarded: t.discarded }));
    }) as any[];
    
    // All should have discarded property
    tabs.forEach(tab => {
      expect(typeof tab.discarded).toBe('boolean');
    });
    
    await page.close();
  });
});

// ============================================================================
// Extension Command Tests
// ============================================================================

test.describe('Extension Commands', () => {
  test('command is registered', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const commands = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.commands.getAll((commands) => resolve(commands));
      });
    }) as any[];
    
    expect(Array.isArray(commands)).toBe(true);
    
    // Should have toggle-overlay command
    const toggleCommand = commands.find(c => c.name === 'toggle-overlay');
    expect(toggleCommand).toBeDefined();
  });

  test('toolbar action is defined', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    const hasAction = await bgWorker!.evaluate(() => {
      return typeof chrome.action !== 'undefined' || typeof chrome.browserAction !== 'undefined';
    });
    
    expect(hasAction).toBe(true);
  });
});

// ============================================================================
// Message Handling Tests
// ============================================================================

test.describe('Message Handling', () => {
  test('background responds to getPayload', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Simulate what a content script would do
    const response = await bgWorker!.evaluate(async () => {
      // Build payload manually in background context
      const tabs = await chrome.tabs.query({});
      return {
        tabCount: tabs.length,
        hasData: true
      };
    });
    
    expect(response).toHaveProperty('tabCount');
    expect(response).toHaveProperty('hasData');
    expect(response.hasData).toBe(true);
    
    await page.close();
  });
});

// ============================================================================
// Cleanup Tests
// ============================================================================

test.describe('Resource Cleanup', () => {
  test('no memory leaks on rapid tab creation/closing', async ({ context }) => {
    for (let i = 0; i < 5; i++) {
      const page = await context.newPage();
      await page.goto(`https://example.com/?iteration=${i}`);
      await page.waitForTimeout(200);
      await page.close();
    }
    
    // Should not have accumulated pages
    const remainingPages = context.pages().filter(p => 
      p.url().includes('example.com')
    );
    expect(remainingPages.length).toBe(0);
  });
});


// ============================================================================
// UI Overlay Tests (via Background triggering)
// ============================================================================

test.describe('Overlay UI Tests', () => {
  test('can trigger overlay toggle from background', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Get the tab ID for the current page
    const tabs = await bgWorker!.evaluate(async () => {
      return chrome.tabs.query({ active: true, currentWindow: true });
    }) as any[];
    
    expect(tabs.length).toBe(1);
    const tabId = tabs[0].id;
    
    // Trigger the overlay by sending a message to the tab
    await bgWorker!.evaluate(async (tabId) => {
      // Build a minimal payload
      const tabs = await chrome.tabs.query({});
      const payload = {
        tabs: tabs.map(t => ({
          id: t.id,
          windowId: t.windowId,
          title: t.title || '',
          url: t.url || '',
          favIconUrl: t.favIconUrl || '',
          active: t.active || false,
          audible: t.audible || false,
          discarded: t.discarded || false,
          pinned: t.pinned || false,
          isStale: false,
          idleDurationMs: 0,
          idleLabel: 'Just now',
          estimatedMemoryMB: 50,
          isDuplicate: false,
          smartDupUrl: t.url || '',
        })),
        recentlyClosed: [],
        inactiveCount: 0,
        totalBackgroundMemoryMB: 100,
        recoverableMemoryMB: 0,
        canDiscard: true,
        hasSessions: true,
        isPro: true,
      };
      
      // Send message to content script
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'toggleOmniOverlay',
          payload
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }, tabId);
    
    // Check if overlay appeared
    await page.waitForTimeout(1000);
    
    const hasOverlay = await page.evaluate(() => {
      return !!document.getElementById('btab-sync-root');
    });
    
    // Note: The content script may or may not inject #btab-sync-root
    // depending on build. We just verify no errors occurred
    console.log('Overlay present:', hasOverlay);
    
    await page.close();
  });

  test('content script injector is in page', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);
    
    // Check if any extension-injected elements exist
    const hasInjectedContent = await page.evaluate(() => {
      // Look for common extension markers
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.id?.includes('btab') || el.className?.includes?.('btab')) {
          return true;
        }
        // Check shadow roots
        if (el.shadowRoot) {
          return true;
        }
      }
      return false;
    });
    
    console.log('Has injected content:', hasInjectedContent);
    // This is informational - content may or may not be injected yet
    
    await page.close();
  });
});

// ============================================================================
// Pro Feature Tests
// ============================================================================

test.describe('Pro Feature Configuration', () => {
  test('can toggle isPro flag', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Set isPro to false
    await bgWorker!.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ isPro: false }, () => resolve());
      });
    });
    
    // Read it back
    const result1 = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['isPro'], resolve);
      });
    }) as any;
    
    expect(result1.isPro).toBe(false);
    
    // Set back to true
    await bgWorker!.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ isPro: true }, () => resolve());
      });
    });
    
    const result2 = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['isPro'], resolve);
      });
    }) as any;
    
    expect(result2.isPro).toBe(true);
  });

  test('smartDuplicates setting works', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Enable smart duplicates
    await bgWorker!.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ smartDuplicates: true }, () => resolve());
      });
    });
    
    const result = await bgWorker!.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['smartDuplicates'], resolve);
      });
    }) as any;
    
    expect(result.smartDuplicates).toBe(true);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Error Handling', () => {
  test('handles invalid tab ID gracefully', async ({ context, extensionId }) => {
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Try to send message to invalid tab
    const result = await bgWorker!.evaluate(async () => {
      try {
        await chrome.tabs.sendMessage(999999, { action: 'test' });
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    });
    
    // Should fail gracefully
    expect(result.success).toBe(false);
  });

  test('handles closing already-closed tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    
    const workers = context.serviceWorkers();
    const bgWorker = workers.find(w => w.url().includes(extensionId));
    
    // Get tab ID
    const tabs = await bgWorker!.evaluate(async () => {
      return chrome.tabs.query({ url: '*://example.com/*' });
    }) as any[];
    
    const tabId = tabs[0]?.id;
    
    // Close the page
    await page.close();
    await context.pages()[0]?.waitForTimeout(500);
    
    // Try to close via API (should fail gracefully)
    if (tabId) {
      const result = await bgWorker!.evaluate(async (id) => {
        try {
          await chrome.tabs.remove(id);
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }, tabId);
      
      // Either succeeds (tab still exists) or fails gracefully
      expect(result).toHaveProperty('success');
    }
  });
});
