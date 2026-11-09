/**
 * Firefox-specific browser API adapter
 * Uses webextension-polyfill which provides the browser.* namespace
 */

import browser from 'webextension-polyfill';
import type { BrowserAdapter } from './types';

// ============================================================================
// Tabs API
// ============================================================================

const tabs: BrowserAdapter['tabs'] = {
  query: (queryInfo) => browser.tabs.query(queryInfo as browser.Tabs.QueryQueryInfoType) as unknown as Promise<chrome.tabs.Tab[]>,

  get: (tabId) => browser.tabs.get(tabId) as unknown as Promise<chrome.tabs.Tab>,

  create: (createProperties) => browser.tabs.create(createProperties as browser.Tabs.CreateCreatePropertiesType) as unknown as Promise<chrome.tabs.Tab>,

  update: (tabId, updateProperties) => browser.tabs.update(tabId, updateProperties as browser.Tabs.UpdateUpdatePropertiesType) as unknown as Promise<chrome.tabs.Tab | undefined>,

  remove: (tabIds) => browser.tabs.remove(tabIds),

  duplicate: (tabId) => browser.tabs.duplicate(tabId) as unknown as Promise<chrome.tabs.Tab | undefined>,

  move: (tabIds, moveProperties) =>
    browser.tabs.move(tabIds, moveProperties as browser.Tabs.MoveMovePropertiesType) as unknown as Promise<chrome.tabs.Tab | chrome.tabs.Tab[]>,

  reload: (tabId, reloadProperties) => browser.tabs.reload(tabId, reloadProperties as browser.Tabs.ReloadReloadPropertiesType),

  discard: (tabId) => {
    if (tabId !== undefined) {
      return browser.tabs.discard(tabId) as unknown as Promise<chrome.tabs.Tab | undefined>;
    }
    return Promise.resolve(undefined);
  },

  // Tab groups are Chrome-only, provide stubs for Firefox
  group: async () => {
    console.warn('Tab groups are not supported in Firefox');
    return -1;
  },

  ungroup: async () => {
    console.warn('Tab groups are not supported in Firefox');
  },

  captureVisibleTab: (windowId, options) =>
    browser.tabs.captureVisibleTab(windowId, options as browser.ExtensionTypes.ImageDetails),

  sendMessage: <T = unknown, R = unknown>(tabId: number, message: T) =>
    browser.tabs.sendMessage(tabId, message) as Promise<R>,

  onCreated: {
    addListener: (callback) => browser.tabs.onCreated.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onCreated.removeListener(callback as never),
  },

  onUpdated: {
    addListener: (callback) => browser.tabs.onUpdated.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onUpdated.removeListener(callback as never),
  },

  onRemoved: {
    addListener: (callback) => browser.tabs.onRemoved.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onRemoved.removeListener(callback as never),
  },

  onActivated: {
    addListener: (callback) => browser.tabs.onActivated.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onActivated.removeListener(callback as never),
  },

  onMoved: {
    addListener: (callback) => browser.tabs.onMoved.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onMoved.removeListener(callback as never),
  },

  onAttached: {
    addListener: (callback) => browser.tabs.onAttached.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onAttached.removeListener(callback as never),
  },

  onDetached: {
    addListener: (callback) => browser.tabs.onDetached.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onDetached.removeListener(callback as never),
  },

  onReplaced: {
    addListener: (callback) => browser.tabs.onReplaced.addListener(callback as never),
    removeListener: (callback) => browser.tabs.onReplaced.removeListener(callback as never),
  },
};

// ============================================================================
// Windows API
// ============================================================================

const windows: BrowserAdapter['windows'] = {
  get: (windowId, getInfo) =>
    browser.windows.get(windowId, getInfo) as unknown as Promise<chrome.windows.Window>,

  getAll: (getInfo) => browser.windows.getAll(getInfo) as unknown as Promise<chrome.windows.Window[]>,

  getCurrent: (getInfo) =>
    browser.windows.getCurrent(getInfo) as unknown as Promise<chrome.windows.Window>,

  getLastFocused: (getInfo) =>
    browser.windows.getLastFocused(getInfo) as unknown as Promise<chrome.windows.Window>,

  create: (createData) =>
    browser.windows.create(createData as browser.Windows.CreateCreateDataType) as unknown as Promise<chrome.windows.Window | undefined>,

  update: (windowId, updateInfo) =>
    browser.windows.update(windowId, updateInfo as browser.Windows.UpdateUpdateInfoType) as unknown as Promise<chrome.windows.Window>,

  remove: (windowId) => browser.windows.remove(windowId),

  onCreated: {
    addListener: (callback) => browser.windows.onCreated.addListener(callback as never),
    removeListener: (callback) => browser.windows.onCreated.removeListener(callback as never),
  },

  onRemoved: {
    addListener: (callback) => browser.windows.onRemoved.addListener(callback as never),
    removeListener: (callback) => browser.windows.onRemoved.removeListener(callback as never),
  },

  onFocusChanged: {
    addListener: (callback) => browser.windows.onFocusChanged.addListener(callback),
    removeListener: (callback) => browser.windows.onFocusChanged.removeListener(callback),
  },

  WINDOW_ID_NONE: browser.windows.WINDOW_ID_NONE,
  WINDOW_ID_CURRENT: browser.windows.WINDOW_ID_CURRENT,
};

// ============================================================================
// Storage API
// ============================================================================

const storage: BrowserAdapter['storage'] = {
  local: {
    get: (keys) => browser.storage.local.get(keys) as Promise<Record<string, unknown>>,
    set: (items) => browser.storage.local.set(items),
    remove: (keys) => browser.storage.local.remove(keys),
    clear: () => browser.storage.local.clear(),
    getBytesInUse: async () => {
      // Firefox doesn't support getBytesInUse, return 0
      return 0;
    },
  },

  sync: {
    get: (keys) => browser.storage.sync.get(keys) as Promise<Record<string, unknown>>,
    set: (items) => browser.storage.sync.set(items),
    remove: (keys) => browser.storage.sync.remove(keys),
    clear: () => browser.storage.sync.clear(),
    getBytesInUse: async () => {
      // Firefox doesn't support getBytesInUse, return 0
      return 0;
    },
  },

  session: {
    get: (keys) => {
      // Firefox 115+ supports session storage
      if (browser.storage.session) {
        return browser.storage.session.get(keys) as Promise<Record<string, unknown>>;
      }
      // Fallback to local storage for older Firefox
      return browser.storage.local.get(keys) as Promise<Record<string, unknown>>;
    },
    set: (items) => {
      if (browser.storage.session) {
        return browser.storage.session.set(items);
      }
      return browser.storage.local.set(items);
    },
    remove: (keys) => {
      if (browser.storage.session) {
        return browser.storage.session.remove(keys);
      }
      return browser.storage.local.remove(keys);
    },
    clear: () => {
      if (browser.storage.session) {
        return browser.storage.session.clear();
      }
      return browser.storage.local.clear();
    },
  },

  onChanged: {
    addListener: (callback) =>
      browser.storage.onChanged.addListener(callback as never),
    removeListener: (callback) =>
      browser.storage.onChanged.removeListener(callback as never),
  },
};

// ============================================================================
// Alarms API
// ============================================================================

const alarms: BrowserAdapter['alarms'] = {
  create: (name, alarmInfo) => browser.alarms.create(name, alarmInfo as browser.Alarms.CreateAlarmInfoType),

  get: (name) => browser.alarms.get(name) as Promise<chrome.alarms.Alarm | undefined>,

  getAll: () => browser.alarms.getAll() as Promise<chrome.alarms.Alarm[]>,

  clear: (name) => browser.alarms.clear(name),

  clearAll: () => browser.alarms.clearAll(),

  onAlarm: {
    addListener: (callback) => browser.alarms.onAlarm.addListener(callback as never),
    removeListener: (callback) => browser.alarms.onAlarm.removeListener(callback as never),
  },
};

// ============================================================================
// Runtime API
// ============================================================================

const runtime: BrowserAdapter['runtime'] = {
  sendMessage: <T = unknown, R = unknown>(message: T) =>
    browser.runtime.sendMessage(message) as Promise<R>,

  connect: (connectInfo) => browser.runtime.connect(connectInfo as browser.Runtime.ConnectConnectInfoType) as unknown as chrome.runtime.Port,

  getURL: (path) => browser.runtime.getURL(path),

  getManifest: () => browser.runtime.getManifest() as unknown as chrome.runtime.Manifest,

  getPlatformInfo: () =>
    browser.runtime.getPlatformInfo() as Promise<chrome.runtime.PlatformInfo>,

  setUninstallURL: (url) => browser.runtime.setUninstallURL(url),

  reload: () => browser.runtime.reload(),

  openOptionsPage: () => browser.runtime.openOptionsPage(),

  get id() {
    return browser.runtime.id;
  },

  get lastError() {
    // Firefox uses different error handling, but polyfill normalizes it
    return browser.runtime.lastError as chrome.runtime.LastError | undefined;
  },

  onInstalled: {
    addListener: (callback) =>
      browser.runtime.onInstalled.addListener(callback as never),
    removeListener: (callback) =>
      browser.runtime.onInstalled.removeListener(callback as never),
  },

  onStartup: {
    addListener: (callback) => browser.runtime.onStartup.addListener(callback),
    removeListener: (callback) => browser.runtime.onStartup.removeListener(callback),
  },

  onSuspend: {
    addListener: (callback) => browser.runtime.onSuspend.addListener(callback),
    removeListener: (callback) => browser.runtime.onSuspend.removeListener(callback),
  },

  onMessage: {
    addListener: (callback) =>
      browser.runtime.onMessage.addListener(callback as never),
    removeListener: (callback) =>
      browser.runtime.onMessage.removeListener(callback as never),
  },

  onConnect: {
    addListener: (callback) =>
      browser.runtime.onConnect.addListener(callback as never),
    removeListener: (callback) =>
      browser.runtime.onConnect.removeListener(callback as never),
  },
};

// ============================================================================
// Scripting API
// ============================================================================

const scripting: BrowserAdapter['scripting'] = {
  executeScript: (injection) =>
    browser.scripting.executeScript(
      injection as browser.Scripting.ScriptInjection
    ) as unknown as Promise<chrome.scripting.InjectionResult<unknown>[]>,

  insertCSS: (injection) =>
    browser.scripting.insertCSS(injection as browser.Scripting.CSSInjection),

  removeCSS: (injection) =>
    browser.scripting.removeCSS(injection as browser.Scripting.CSSInjection),

  registerContentScripts: (scripts) =>
    browser.scripting.registerContentScripts(
      scripts as browser.Scripting.RegisteredContentScript[]
    ),

  unregisterContentScripts: (filter) =>
    browser.scripting.unregisterContentScripts(
      filter as browser.Scripting.ContentScriptFilter
    ),

  getRegisteredContentScripts: (filter) =>
    browser.scripting.getRegisteredContentScripts(
      filter as browser.Scripting.ContentScriptFilter
    ) as Promise<chrome.scripting.RegisteredContentScript[]>,

  updateContentScripts: (scripts) =>
    browser.scripting.updateContentScripts(
      scripts as browser.Scripting.RegisteredContentScript[]
    ),
};

// ============================================================================
// Export Firefox Adapter
// ============================================================================

export const firefoxAdapter: BrowserAdapter = {
  tabs,
  windows,
  storage,
  alarms,
  runtime,
  scripting,
  isChrome: false,
  isFirefox: true,
  isEdge: false,
};
