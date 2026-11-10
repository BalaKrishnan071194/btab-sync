/**
 * Background Service Worker
 *
 * Handles tab tracking, activity monitoring, and messaging between
 * the popup/content scripts and the browser APIs.
 */

import { ext } from '../lib/browsers';
import { validateLicense } from '../lib/license';

// ============================================================================
// Type Definitions
// ============================================================================

/** Tab metadata cached for recently closed tracking */
interface TabMeta {
  title: string;
  url: string;
  favIconUrl: string;
}

/** Recently closed tab entry stored in local storage */
interface RecentlyClosedEntry {
  sessionId: string;
  title: string;
  url: string;
  favIconUrl: string;
  closedAtMs: number;
  closedAgoLabel: string;
}

/** Tab data enriched with activity and memory info */
interface EnrichedTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
  isStale: boolean;
  idleDurationMs: number;
  idleLabel: string;
  estimatedMemoryMB: number;
  isDuplicate: boolean;
  /** S1-5: Smart-normalized URL for Pro duplicate detection */
  smartDupUrl: string;
}

/** Full payload sent to popup/content scripts */
interface TabPayload {
  tabs: EnrichedTab[];
  recentlyClosed: RecentlyClosedEntry[];
  inactiveCount: number;
  totalBackgroundMemoryMB: number;
  recoverableMemoryMB: number;
  canDiscard: boolean;
  hasSessions: boolean;
  isPro: boolean;
}

/** Message types for runtime communication */
interface GetPayloadMessage {
  action: 'getPayload';
}

interface ExecuteTabSwitchMessage {
  action: 'executeTabSwitch';
  tabId: number;
  windowId: number;
}

interface SleepTabMessage {
  action: 'sleepTab';
  tabId: number;
}

interface CloseTabMessage {
  action: 'closeTab';
  tabId: number;
}

/** Pin or unpin a tab */
interface PinTabMessage {
  action: 'pinTab';
  tabId: number;
  pinned: boolean;
}

interface RestoreTabMessage {
  action: 'restoreTab';
  sessionId: string;
}

/** Create new tab message - for workspace restore */
interface CreateTabMessage {
  action: 'createTab';
  url: string;
  pinned?: boolean;
  active?: boolean;
}

/** S3-4: Register reminder message */
interface RegisterReminderMessage {
  action: 'registerReminder';
  remindAt: number;
  tabId: number;
  title: string;
  url: string;
}

interface ToggleOverlayMessage {
  action: 'toggleOmniOverlay';
  payload: TabPayload;
}

type BackgroundMessage =
  | GetPayloadMessage
  | ExecuteTabSwitchMessage
  | SleepTabMessage
  | CloseTabMessage
  | PinTabMessage
  | RestoreTabMessage
  | CreateTabMessage
  | RegisterReminderMessage;

interface TabActionResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// Feature Detection
// ============================================================================

/** Check if tab discard API is available */
const canDiscard = typeof chrome.tabs?.discard === 'function';

/** Check if sessions API is available */
const hasSessions = typeof chrome.sessions?.getRecentlyClosed === 'function';

// ============================================================================
// Pro Feature Flag
// ============================================================================

/**
 * Set BTAB_PRO_DEFAULT = true to enable all Pro features (dev/testing mode).
 * In production, this is overridden by chrome.storage.local key "isPro".
 */
const BTAB_PRO_DEFAULT = true;
let _isPro = BTAB_PRO_DEFAULT;

// Initialize Pro status
if (BTAB_PRO_DEFAULT) {
  // Dev mode: Always Pro, set storage to match
  _isPro = true;
  ext.storage.local.set({ isPro: true, btab_dev_pro: true });
} else {
  // Production mode: Read from storage
  ext.storage.local.get(['isPro']).then((result) => {
    if (typeof result['isPro'] === 'boolean') {
      _isPro = result['isPro'];
    }
  });
}

function isPro(): boolean {
  return _isPro;
}

// ============================================================================
// State
// ============================================================================

/** Inactivity threshold: 2 hours in milliseconds */
const INACTIVITY_THRESHOLD = 2 * 60 * 60 * 1000;

/** Tab activity timestamps - in-memory only */
const tabActivityLog: Record<number, number> = {};

/** Tab metadata cache - for onRemoved tracking */
const tabMetaCache: Record<number, TabMeta> = {};

/** Debounce timer for tab change notifications */
let notifyDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Notify active tab's content script about tab changes (debounced)
 * This enables real-time UI updates when tabs are created, closed, or modified
 */
async function notifyTabChange(): Promise<void> {
  // Debounce to avoid flooding with updates
  if (notifyDebounceTimer) {
    clearTimeout(notifyDebounceTimer);
  }
  
  notifyDebounceTimer = setTimeout(async () => {
    try {
      const [activeTab] = await ext.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id != null) {
        const payload = await buildPayload();
        await ext.tabs.sendMessage(activeTab.id, { 
          action: 'tabsChanged', 
          payload 
        }).catch(() => {
          // Content script might not be loaded on this tab
        });
      }
    } catch (e) {
      // Ignore errors - content script may not be active
    }
  }, 150); // 150ms debounce
}

// Seed tabMetaCache on startup
ext.tabs.query({}).then((tabs) => {
  for (const t of tabs) {
    if (t.id != null) {
      tabMetaCache[t.id] = {
        title: t.title || '',
        url: t.url || '',
        favIconUrl: t.favIconUrl || '',
      };
    }
  }
});

// S5-2: Validate license on startup (skip if dev mode)
if (!BTAB_PRO_DEFAULT) {
  validateLicense().catch(() => {
    // Ignore validation errors on startup
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Estimate memory usage in MB based on tab state
 */
function estimateMemoryMB(tab: chrome.tabs.Tab, idleDurationMs: number): number {
  if (tab.discarded) return 2;
  if (tab.active || tab.audible) return 120;
  if (idleDurationMs >= INACTIVITY_THRESHOLD) return 80;
  return 50;
}

/**
 * Check if URL is an internal/special URL that shouldn't be considered for duplicates
 */
function isInternalUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('file://') ||
    url.startsWith('devtools://') ||
    url === '' ||
    url === 'about:blank'
  );
}

/**
 * Normalize URL for duplicate detection (strips hash, trailing slash)
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/**
 * S1-5: Tracking parameters to strip for smart duplicate detection
 * These are commonly used for marketing/analytics and don't affect page content
 */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'campaign', 'medium', 'via', 'igshid',
  'mc_cid', 'mc_eid', '_ga', 'yclid', 'twclid', 's_kwcid', 'gad_source',
  'msclkid', 'dclid', 'zanpid', 'guccounter', '__cf_chl_tk',
]);

/**
 * S1-5: Smart URL normalization - strips tracking parameters for Pro users
 * This allows detecting duplicates like example.com and example.com?utm_source=email
 */
function normalizeUrlSmart(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    
    // Remove tracking parameters
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/**
 * Format idle duration for display
 */
function formatIdleLabel(ms: number): string {
  if (ms < 5 * 60_000) return '';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
  // Use i18n if available, fallback to simple format
  try {
    return chrome.i18n.getMessage('labelIdleFormat', [timeStr]) || `idle ${timeStr}`;
  } catch {
    return `idle ${timeStr}`;
  }
}

/**
 * Format time since tab was closed
 */
function formatClosedAgo(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const timeStr = m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
  // Use i18n if available, fallback to simple format
  try {
    return chrome.i18n.getMessage('labelAgoFormat', [timeStr]) || `${timeStr} ago`;
  } catch {
    return `${timeStr} ago`;
  }
}

// ============================================================================
// Tab Lifecycle Handlers
// ============================================================================

ext.tabs.onCreated.addListener((tab) => {
  if (tab.id != null) {
    tabMetaCache[tab.id] = {
      title: tab.title || '',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
    };
  }
  // Notify content script of tab change
  void notifyTabChange();
});

ext.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  tabMetaCache[tabId] = {
    title: tab.title || '',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
  };
  // Notify content script of tab change (debounced via changeInfo check)
  if (_changeInfo.status === 'complete' || _changeInfo.title || _changeInfo.url) {
    void notifyTabChange();
  }
});

ext.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  // Clear activity timestamp for active tab
  delete tabActivityLog[tabId];

  try {
    // Mark all other tabs in window as inactive
    const windowTabs = await ext.tabs.query({ windowId });
    const now = Date.now();
    for (const t of windowTabs) {
      if (t.id !== tabId && t.id != null && !(t.id in tabActivityLog)) {
        tabActivityLog[t.id] = now;
      }
    }
  } catch (e) {
    console.warn('[bTab Sync] onActivated:', e);
  }
  
  // Notify content script of tab change
  void notifyTabChange();
});

ext.tabs.onRemoved.addListener(async (tabId) => {
  delete tabActivityLog[tabId];

  const meta = tabMetaCache[tabId];
  if (meta) {
    const now = Date.now();
    const entry: RecentlyClosedEntry = {
      sessionId: String(tabId),
      title: meta.title,
      url: meta.url,
      favIconUrl: meta.favIconUrl,
      closedAtMs: now,
      closedAgoLabel: formatClosedAgo(0),
    };

    try {
      const stored = await ext.storage.local.get(['recentlyClosed']);
      let list: RecentlyClosedEntry[] = Array.isArray(stored['recentlyClosed'])
        ? (stored['recentlyClosed'] as RecentlyClosedEntry[])
        : [];

      list.unshift(entry);

      // Keep only last 24 hours, max 5 entries
      const cutoff = now - 24 * 60 * 60 * 1000;
      list = list.filter((e) => e.closedAtMs >= cutoff).slice(0, 5);

      await ext.storage.local.set({ recentlyClosed: list });
    } catch (e) {
      console.warn('[bTab Sync] onRemoved storage:', e);
    }
  }

  delete tabMetaCache[tabId];
  
  // Notify content script of tab change
  void notifyTabChange();
});

// ============================================================================
// Cleanup Alarm
// ============================================================================

ext.alarms.create('cleanupTracker', { periodInMinutes: 15 });

// ============================================================================
// S3-4: Reminders Alarm
// ============================================================================

ext.alarms.create('checkReminders', { periodInMinutes: 1 });

// ============================================================================
// S3-5: Tab Expiry Alarm (daily check)
// ============================================================================

ext.alarms.create('checkTabExpiry', { periodInMinutes: 60 * 24 }); // Daily

// ============================================================================
// S2-1: Smart Auto-Suspension Alarm (Pro Feature)
// ============================================================================

ext.alarms.create('autoSuspend', { periodInMinutes: 1 });

// ============================================================================
// S5-2: License Validation Alarm (every 6 hours, checks once per 24h)
// ============================================================================

// Only create license validation alarm in production mode
if (!BTAB_PRO_DEFAULT) {
  ext.alarms.create('licenseValidation', { periodInMinutes: 60 * 6 }); // Every 6 hours
}

/** Get hostname from URL for exception matching */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** S2-1: Auto-suspend eligible tabs based on settings */
async function handleAutoSuspend(): Promise<void> {
  if (!isPro()) return;

  try {
    const settings = await ext.storage.local.get([
      'autoSuspendEnabled',
      'autoSuspendIdleMinutes',
      'autoSuspendExceptions',
    ]);

    // Check if auto-suspend is enabled
    if (!settings['autoSuspendEnabled']) return;

    const idleMinutes = (settings['autoSuspendIdleMinutes'] as number) || 30;
    const exceptions = (settings['autoSuspendExceptions'] as string[]) || [];
    const idleThresholdMs = idleMinutes * 60 * 1000;
    const now = Date.now();

    // Query all tabs
    const tabs = await ext.tabs.query({});

    for (const tab of tabs) {
      if (tab.id == null) continue;

      // Skip: pinned, audible, active, already discarded
      if (tab.pinned || tab.audible || tab.active || tab.discarded) continue;

      // Skip: domain in exceptions list
      const hostname = getHostname(tab.url || '');
      if (exceptions.some((ex) => hostname.includes(ex))) continue;

      // Check idle duration
      const idleTs = tabActivityLog[tab.id];
      const idleDurationMs = idleTs ? now - idleTs : 0;

      if (idleDurationMs >= idleThresholdMs) {
        try {
          await ext.tabs.discard(tab.id);
          console.log(`[bTab Sync] Auto-suspended: ${tab.title}`);
        } catch (e) {
          console.warn('[bTab Sync] Auto-suspend failed:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[bTab Sync] autoSuspend alarm:', e);
  }
}

/** S2-4: Automation Rules Engine - evaluate rules on alarm */
interface AutomationRule {
  id: string;
  condition: 'memory_gt' | 'idle_gt' | 'domain_is';
  value: string | number;
  action: 'sleep' | 'close' | 'notify';
  enabled: boolean;
}

async function evaluateAutomationRules(): Promise<void> {
  if (!isPro()) return;

  try {
    const settings = await ext.storage.local.get(['automationRules']);
    const rules = (settings['automationRules'] as AutomationRule[]) || [];
    const enabledRules = rules.filter((r) => r.enabled);

    if (enabledRules.length === 0) return;

    const tabs = await ext.tabs.query({});
    const now = Date.now();

    for (const tab of tabs) {
      if (tab.id == null || tab.pinned || tab.active) continue;

      const idleTs = tabActivityLog[tab.id];
      const idleDurationMs = idleTs ? now - idleTs : 0;
      const idleMinutes = idleDurationMs / 60000;
      const estimatedMemoryMB = tab.discarded ? 2 : tab.audible ? 120 : idleDurationMs >= 2 * 60 * 60 * 1000 ? 80 : 50;
      const hostname = getHostname(tab.url || '');

      for (const rule of enabledRules) {
        let matches = false;

        switch (rule.condition) {
          case 'memory_gt':
            matches = estimatedMemoryMB > Number(rule.value);
            break;
          case 'idle_gt':
            matches = idleMinutes > Number(rule.value);
            break;
          case 'domain_is':
            matches = hostname.includes(String(rule.value));
            break;
        }

        if (matches) {
          try {
            switch (rule.action) {
              case 'sleep':
                if (!tab.discarded) {
                  await ext.tabs.discard(tab.id);
                  console.log(`[bTab Sync] Rule sleep: ${tab.title}`);
                }
                break;
              case 'close':
                await ext.tabs.remove(tab.id);
                console.log(`[bTab Sync] Rule close: ${tab.title}`);
                break;
              case 'notify':
                // Notification would require notifications permission
                console.log(`[bTab Sync] Rule notify: ${tab.title}`);
                break;
            }
          } catch (e) {
            console.warn('[bTab Sync] Rule action failed:', e);
          }
          break; // Only first matching rule per tab
        }
      }
    }
  } catch (e) {
    console.warn('[bTab Sync] automationRules:', e);
  }
}

// ============================================================================
// S3-4: Reminder Handler
// ============================================================================

/** Pending reminder IDs for tracking */
const pendingReminderAlarms = new Map<string, number>();

/** S3-4: Check for due reminders and fire notifications */
async function handleCheckReminders(): Promise<void> {
  if (!isPro()) return;

  try {
    const stored = await ext.storage.local.get(['btabReminders']);
    const reminders = (stored['btabReminders'] as Array<{
      id: string;
      tabId?: number;
      url: string;
      title: string;
      remindAt: number;
      fired: boolean;
    }>) || [];

    const now = Date.now();
    let updated = false;

    for (const reminder of reminders) {
      if (reminder.fired || reminder.remindAt > now) continue;

      // Fire notification
      try {
        await chrome.notifications.create(`reminder-${reminder.id}`, {
          type: 'basic',
          iconUrl: 'icon.svg',
          title: 'Tab Reminder',
          message: reminder.title || reminder.url,
          priority: 2,
        });

        reminder.fired = true;
        updated = true;
        console.log(`[bTab Sync] Reminder fired: ${reminder.title}`);
      } catch (e) {
        console.warn('[bTab Sync] Notification failed:', e);
      }
    }

    if (updated) {
      await ext.storage.local.set({ btabReminders: reminders });
    }
  } catch (e) {
    console.warn('[bTab Sync] checkReminders:', e);
  }
}

/** S3-4: Register a new reminder */
async function registerReminder(
  remindAt: number,
  tabId: number,
  title: string,
  url: string
): Promise<void> {
  try {
    const stored = await ext.storage.local.get(['btabReminders']);
    const reminders = (stored['btabReminders'] as Array<{
      id: string;
      tabId: number;
      url: string;
      title: string;
      remindAt: number;
      fired: boolean;
    }>) || [];

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    reminders.push({
      id,
      tabId,
      url,
      title,
      remindAt,
      fired: false,
    });

    // Keep max 50 reminders, remove old fired ones
    const filtered = reminders
      .filter(r => !r.fired || r.remindAt > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .slice(-50);

    await ext.storage.local.set({ btabReminders: filtered });
    console.log(`[bTab Sync] Reminder registered: ${title} at ${new Date(remindAt).toLocaleString()}`);
  } catch (e) {
    console.warn('[bTab Sync] registerReminder:', e);
  }
}

// ============================================================================
// S3-5: Tab Expiry Handler
// ============================================================================

/** Tab expiry threshold: 7 days in milliseconds */
const TAB_EXPIRY_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

/** Track expired tab IDs */
const expiredTabIds = new Set<number>();

/** S3-5: Check for expired tabs (not visited in 7+ days) */
async function handleCheckTabExpiry(): Promise<void> {
  if (!isPro()) return;

  try {
    const settings = await ext.storage.local.get(['tabExpiryEnabled', 'tabExpiryAutoClose']);
    if (!settings['tabExpiryEnabled']) return;

    const tabs = await ext.tabs.query({});
    const now = Date.now();
    const autoClose = settings['tabExpiryAutoClose'] === true;

    expiredTabIds.clear();

    for (const tab of tabs) {
      if (tab.id == null || tab.pinned || tab.active) continue;

      const idleTs = tabActivityLog[tab.id];
      const idleDurationMs = idleTs ? now - idleTs : 0;

      if (idleDurationMs >= TAB_EXPIRY_THRESHOLD) {
        expiredTabIds.add(tab.id);

        if (autoClose) {
          try {
            await ext.tabs.remove(tab.id);
            console.log(`[bTab Sync] Auto-closed expired: ${tab.title}`);
          } catch (e) {
            console.warn('[bTab Sync] Auto-close expired failed:', e);
          }
        }
      }
    }

    // Show notification if tabs expired
    if (expiredTabIds.size > 0 && !autoClose) {
      try {
        await chrome.notifications.create('tab-expiry-notice', {
          type: 'basic',
          iconUrl: 'icon.svg',
          title: 'Expired Tabs',
          message: `${expiredTabIds.size} tab(s) haven't been visited in 7+ days`,
          priority: 1,
        });
      } catch (e) {
        console.warn('[bTab Sync] Expiry notification failed:', e);
      }
    }
  } catch (e) {
    console.warn('[bTab Sync] checkTabExpiry:', e);
  }
}

/** Check if a tab is expired */
function isTabExpired(tabId: number): boolean {
  return expiredTabIds.has(tabId);
}

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupTracker') {
    try {
      const tabs = await ext.tabs.query({});
      const activeIds = new Set(tabs.map((t) => t.id));

      for (const id of Object.keys(tabActivityLog)) {
        if (!activeIds.has(Number(id))) {
          delete tabActivityLog[Number(id)];
        }
      }
    } catch (e) {
      console.warn('[bTab Sync] cleanupTracker:', e);
    }
  }

  if (alarm.name === 'autoSuspend') {
    await handleAutoSuspend();
    await evaluateAutomationRules();
  }

  // S3-4: Check reminders
  if (alarm.name === 'checkReminders') {
    await handleCheckReminders();
  }

  // S3-5: Check tab expiry (daily)
  if (alarm.name === 'checkTabExpiry') {
    await handleCheckTabExpiry();
  }

  // S5-2: License validation (periodically validates with LemonSqueezy)
  if (alarm.name === 'licenseValidation') {
    try {
      await validateLicense();
    } catch (e) {
      console.warn('[bTab Sync] licenseValidation:', e);
    }
  }
});

// ============================================================================
// Payload Builder
// ============================================================================

/**
 * Build the complete tab data payload for popup/overlay
 */
async function buildPayload(): Promise<TabPayload> {
  const allTabs = await ext.tabs.query({});
  const stored = await ext.storage.local.get(['recentlyClosed']);
  let recentlyClosed: RecentlyClosedEntry[] = Array.isArray(stored['recentlyClosed'])
    ? (stored['recentlyClosed'] as RecentlyClosedEntry[])
    : [];

  const now = Date.now();

  // Update closedAgoLabel for all entries
  recentlyClosed = recentlyClosed.map((e) => ({
    ...e,
    closedAgoLabel: formatClosedAgo(now - e.closedAtMs),
  }));

  // Enrich with session IDs if sessions API is available
  if (hasSessions) {
    try {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 10 });
      const sessionTabs = sessions
        .filter((s): s is chrome.sessions.Session & { tab: chrome.tabs.Tab } => !!s.tab)
        .map((s) => ({
          sessionId: String(s.tab.sessionId),
          url: s.tab.url,
          lastModified: s.lastModified,
        }));

      recentlyClosed = recentlyClosed.map((entry) => {
        const match = sessionTabs.find(
          (st) =>
            st.url === entry.url &&
            Math.abs((st.lastModified ?? 0) * 1000 - entry.closedAtMs) < 10_000
        );
        return match ? { ...entry, sessionId: match.sessionId } : entry;
      });
    } catch (e) {
      console.warn('[bTab Sync] sessions enrichment:', e);
    }
  }

  // S1-5: Build URL groups for duplicate detection
  // Use smart normalization for Pro users to detect tracking parameter duplicates
  const isProUser = isPro();
  const urlGroups: Record<string, number[]> = {};
  const smartUrlGroups: Record<string, number[]> = {};
  
  for (const t of allTabs) {
    if (t.id != null) {
      const url = t.url || '';
      
      // Skip internal URLs from duplicate detection
      if (isInternalUrl(url)) continue;
      
      const norm = normalizeUrl(url);
      const smartNorm = normalizeUrlSmart(url);
      
      if (!urlGroups[norm]) urlGroups[norm] = [];
      urlGroups[norm].push(t.id);
      
      if (!smartUrlGroups[smartNorm]) smartUrlGroups[smartNorm] = [];
      smartUrlGroups[smartNorm].push(t.id);
    }
  }

  // Build enriched tab list
  const tabs: EnrichedTab[] = allTabs
    .filter((t): t is chrome.tabs.Tab & { id: number; windowId: number } =>
      t.id != null && t.windowId != null
    )
    .map((t) => {
      const idleTs = tabActivityLog[t.id];
      const idleDurationMs = idleTs ? now - idleTs : 0;
      const isStale =
        !t.active && !t.discarded && !t.audible && idleDurationMs >= INACTIVITY_THRESHOLD;
      
      const normalUrl = normalizeUrl(t.url || '');
      const smartUrl = normalizeUrlSmart(t.url || '');
      
      // S1-5: Use smart duplicate detection for Pro users
      const isDuplicate = isProUser
        ? (smartUrlGroups[smartUrl] || []).length > 1
        : (urlGroups[normalUrl] || []).length > 1;

      return {
        id: t.id,
        windowId: t.windowId,
        title: t.title || '',
        url: t.url || '',
        favIconUrl: t.favIconUrl || '',
        active: t.active || false,
        audible: t.audible || false,
        discarded: t.discarded || false,
        pinned: t.pinned || false,
        isStale,
        idleDurationMs,
        idleLabel: formatIdleLabel(idleDurationMs),
        estimatedMemoryMB: estimateMemoryMB(t, idleDurationMs),
        isDuplicate,
        smartDupUrl: smartUrl,
      };
    });

  const staleTabs = tabs.filter((t) => t.isStale);

  return {
    tabs,
    recentlyClosed,
    inactiveCount: staleTabs.length,
    totalBackgroundMemoryMB: tabs
      .filter((t) => !t.active)
      .reduce((s, t) => s + t.estimatedMemoryMB, 0),
    recoverableMemoryMB: staleTabs.reduce((s, t) => s + t.estimatedMemoryMB, 0),
    canDiscard,
    hasSessions,
    isPro: isPro(),
  };
}

/**
 * Build payload and send to active tab (for keyboard shortcut overlay)
 */
async function buildAndSendPayload(): Promise<void> {
  try {
    const payload = await buildPayload();
    if (!payload) return;

    const [active] = await ext.tabs.query({ active: true, currentWindow: true });
    if (active?.id != null) {
      const message: ToggleOverlayMessage = { action: 'toggleOmniOverlay', payload };
      await ext.tabs.sendMessage(active.id, message);
    }
  } catch (e) {
    console.warn('[bTab Sync] sendPayload:', e);
  }
}

// ============================================================================
// Toolbar Icon Click
// ============================================================================

// Use action (MV3) or browserAction (MV2)
const toolbarAction = chrome.action ?? chrome.browserAction;

toolbarAction.onClicked.addListener(async () => {
  try {
    await buildAndSendPayload();
  } catch (e) {
    console.warn('[bTab Sync] icon click:', e);
  }
});

// ============================================================================
// Keyboard Shortcut
// ============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;

  try {
    await buildAndSendPayload();
  } catch (e) {
    console.warn('[bTab Sync] toggle-overlay:', e);
  }
});

// ============================================================================
// Message Router
// ============================================================================

ext.runtime.onMessage.addListener(
  (
    msg: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | void => {
    const message = msg as BackgroundMessage;

    // Popup requests tab data
    if (message.action === 'getPayload') {
      buildPayload()
        .then((payload) => sendResponse(payload))
        .catch(() => sendResponse(null));
      return true; // async response
    }

    if (message.action === 'executeTabSwitch') {
      ext.tabs.update(message.tabId, { active: true });
      ext.windows.update(message.windowId, { focused: true });
      return;
    }

    if (message.action === 'sleepTab') {
      ext.tabs
        .discard(message.tabId)
        .then(() => sendResponse({ success: true } as TabActionResponse))
        .catch((e: Error) =>
          sendResponse({ success: false, error: e.message } as TabActionResponse)
        );
      return true; // async response
    }

    if (message.action === 'closeTab') {
      // Don't allow closing the active/current tab
      ext.tabs.get(message.tabId).then((tab) => {
        if (tab.active) {
          sendResponse({ success: false, error: 'Cannot close active tab' } as TabActionResponse);
        } else {
          ext.tabs
            .remove(message.tabId)
            .then(() => sendResponse({ success: true } as TabActionResponse))
            .catch((e: Error) =>
              sendResponse({ success: false, error: e.message } as TabActionResponse)
            );
        }
      }).catch((e: Error) =>
        sendResponse({ success: false, error: e.message } as TabActionResponse)
      );
      return true; // async response
    }

    // Pin or unpin a tab
    if (message.action === 'pinTab') {
      const msg = message as PinTabMessage;
      ext.tabs
        .update(msg.tabId, { pinned: msg.pinned })
        .then(() => sendResponse({ success: true } as TabActionResponse))
        .catch((e: Error) =>
          sendResponse({ success: false, error: e.message } as TabActionResponse)
        );
      return true; // async response
    }

    if (message.action === 'restoreTab') {
      chrome.sessions
        .restore(message.sessionId)
        .then(() => sendResponse({ success: true } as TabActionResponse))
        .catch((e: Error) =>
          sendResponse({ success: false, error: e.message } as TabActionResponse)
        );
      return true; // async response
    }

    // Create new tab - for workspace restore
    if (message.action === 'createTab') {
      const msg = message as CreateTabMessage;
      ext.tabs
        .create({
          url: msg.url,
          pinned: msg.pinned ?? false,
          active: msg.active ?? false,
        })
        .then(() => sendResponse({ success: true } as TabActionResponse))
        .catch((e: Error) =>
          sendResponse({ success: false, error: e.message } as TabActionResponse)
        );
      return true; // async response
    }

    // S3-4: Register reminder
    if (message.action === 'registerReminder') {
      const msg = message as RegisterReminderMessage;
      registerReminder(msg.remindAt, msg.tabId, msg.title, msg.url)
        .then(() => sendResponse({ success: true } as TabActionResponse))
        .catch((e: Error) =>
          sendResponse({ success: false, error: e.message } as TabActionResponse)
        );
      return true; // async response
    }
  }
);
