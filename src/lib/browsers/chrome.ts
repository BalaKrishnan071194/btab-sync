/**
 * Chrome-specific browser API adapter
 * Uses the chrome.* namespace directly
 */

import type { BrowserAdapter } from './types';

// ============================================================================
// Tabs API
// ============================================================================

const tabs: BrowserAdapter['tabs'] = {
  query: (queryInfo) => chrome.tabs.query(queryInfo),

  get: (tabId) => chrome.tabs.get(tabId),

  create: (createProperties) => chrome.tabs.create(createProperties),

  update: (tabId, updateProperties) => chrome.tabs.update(tabId, updateProperties),

  remove: (tabIds) => chrome.tabs.remove(tabIds as number),

  duplicate: (tabId) => chrome.tabs.duplicate(tabId),

  move: (tabIds, moveProperties) => chrome.tabs.move(tabIds as number, moveProperties) as Promise<chrome.tabs.Tab | chrome.tabs.Tab[]>,

  reload: (tabId, reloadProperties) => {
    if (tabId !== undefined) {
      return chrome.tabs.reload(tabId, reloadProperties);
    }
    return chrome.tabs.reload();
  },

  discard: (tabId) => chrome.tabs.discard(tabId),

  group: (options) => chrome.tabs.group(options),

  ungroup: (tabIds) => chrome.tabs.ungroup(tabIds),

  captureVisibleTab: (windowId, options) => {
    if (windowId !== undefined && options) {
      return chrome.tabs.captureVisibleTab(windowId, options);
    }
    if (windowId !== undefined) {
      return chrome.tabs.captureVisibleTab(windowId);
    }
    return chrome.tabs.captureVisibleTab();
  },

  sendMessage: <T = unknown, R = unknown>(tabId: number, message: T) =>
    chrome.tabs.sendMessage(tabId, message) as Promise<R>,

  onCreated: {
    addListener: (callback) => chrome.tabs.onCreated.addListener(callback),
    removeListener: (callback) => chrome.tabs.onCreated.removeListener(callback),
  },

  onUpdated: {
    addListener: (callback) => chrome.tabs.onUpdated.addListener(callback),
    removeListener: (callback) => chrome.tabs.onUpdated.removeListener(callback),
  },

  onRemoved: {
    addListener: (callback) => chrome.tabs.onRemoved.addListener(callback),
    removeListener: (callback) => chrome.tabs.onRemoved.removeListener(callback),
  },

  onActivated: {
    addListener: (callback) => chrome.tabs.onActivated.addListener(callback),
    removeListener: (callback) => chrome.tabs.onActivated.removeListener(callback),
  },

  onMoved: {
    addListener: (callback) => chrome.tabs.onMoved.addListener(callback),
    removeListener: (callback) => chrome.tabs.onMoved.removeListener(callback),
  },

  onAttached: {
    addListener: (callback) => chrome.tabs.onAttached.addListener(callback),
    removeListener: (callback) => chrome.tabs.onAttached.removeListener(callback),
  },

  onDetached: {
    addListener: (callback) => chrome.tabs.onDetached.addListener(callback),
    removeListener: (callback) => chrome.tabs.onDetached.removeListener(callback),
  },

  onReplaced: {
    addListener: (callback) => chrome.tabs.onReplaced.addListener(callback),
    removeListener: (callback) => chrome.tabs.onReplaced.removeListener(callback),
  },
};

// ============================================================================
// Windows API
// ============================================================================

const windows: BrowserAdapter['windows'] = {
  get: (windowId, getInfo) => {
    if (getInfo) {
      return chrome.windows.get(windowId, getInfo);
    }
    return chrome.windows.get(windowId);
  },

  getAll: (getInfo) => {
    if (getInfo) {
      return chrome.windows.getAll(getInfo);
    }
    return chrome.windows.getAll();
  },

  getCurrent: (getInfo) => {
    if (getInfo) {
      return chrome.windows.getCurrent(getInfo);
    }
    return chrome.windows.getCurrent();
  },

  getLastFocused: (getInfo) => {
    if (getInfo) {
      return chrome.windows.getLastFocused(getInfo);
    }
    return chrome.windows.getLastFocused();
  },

  create: (createData) => {
    if (createData) {
      return chrome.windows.create(createData);
    }
    return chrome.windows.create();
  },

  update: (windowId, updateInfo) => chrome.windows.update(windowId, updateInfo),

  remove: (windowId) => chrome.windows.remove(windowId),

  onCreated: {
    addListener: (callback) => chrome.windows.onCreated.addListener(callback),
    removeListener: (callback) => chrome.windows.onCreated.removeListener(callback),
  },

  onRemoved: {
    addListener: (callback) => chrome.windows.onRemoved.addListener(callback),
    removeListener: (callback) => chrome.windows.onRemoved.removeListener(callback),
  },

  onFocusChanged: {
    addListener: (callback) => chrome.windows.onFocusChanged.addListener(callback),
    removeListener: (callback) => chrome.windows.onFocusChanged.removeListener(callback),
  },

  WINDOW_ID_NONE: chrome.windows.WINDOW_ID_NONE,
  WINDOW_ID_CURRENT: chrome.windows.WINDOW_ID_CURRENT,
};

// ============================================================================
// Storage API
// ============================================================================

const storage: BrowserAdapter['storage'] = {
  local: {
    get: (keys) => chrome.storage.local.get(keys),
    set: (items) => chrome.storage.local.set(items),
    remove: (keys) => chrome.storage.local.remove(keys),
    clear: () => chrome.storage.local.clear(),
    getBytesInUse: (keys) => chrome.storage.local.getBytesInUse(keys),
  },

  sync: {
    get: (keys) => chrome.storage.sync.get(keys),
    set: (items) => chrome.storage.sync.set(items),
    remove: (keys) => chrome.storage.sync.remove(keys),
    clear: () => chrome.storage.sync.clear(),
    getBytesInUse: (keys) => chrome.storage.sync.getBytesInUse(keys),
  },

  session: {
    get: (keys) => chrome.storage.session.get(keys),
    set: (items) => chrome.storage.session.set(items),
    remove: (keys) => chrome.storage.session.remove(keys),
    clear: () => chrome.storage.session.clear(),
  },

  onChanged: {
    addListener: (callback) => chrome.storage.onChanged.addListener(callback),
    removeListener: (callback) => chrome.storage.onChanged.removeListener(callback),
  },
};

// ============================================================================
// Alarms API
// ============================================================================

const alarms: BrowserAdapter['alarms'] = {
  create: (name, alarmInfo) => chrome.alarms.create(name, alarmInfo),

  get: (name) => chrome.alarms.get(name),

  getAll: () => chrome.alarms.getAll(),

  clear: (name) => chrome.alarms.clear(name),

  clearAll: () => chrome.alarms.clearAll(),

  onAlarm: {
    addListener: (callback) => chrome.alarms.onAlarm.addListener(callback),
    removeListener: (callback) => chrome.alarms.onAlarm.removeListener(callback),
  },
};

// ============================================================================
// Runtime API
// ============================================================================

const runtime: BrowserAdapter['runtime'] = {
  sendMessage: <T = unknown, R = unknown>(message: T) =>
    chrome.runtime.sendMessage(message) as Promise<R>,

  connect: (connectInfo) => chrome.runtime.connect(connectInfo),

  getURL: (path) => chrome.runtime.getURL(path),

  getManifest: () => chrome.runtime.getManifest(),

  getPlatformInfo: () => chrome.runtime.getPlatformInfo(),

  setUninstallURL: (url) => Promise.resolve(chrome.runtime.setUninstallURL(url)),

  reload: () => chrome.runtime.reload(),

  openOptionsPage: () => chrome.runtime.openOptionsPage(),

  get id() {
    return chrome.runtime.id;
  },

  get lastError() {
    return chrome.runtime.lastError;
  },

  onInstalled: {
    addListener: (callback) => chrome.runtime.onInstalled.addListener(callback),
    removeListener: (callback) => chrome.runtime.onInstalled.removeListener(callback),
  },

  onStartup: {
    addListener: (callback) => chrome.runtime.onStartup.addListener(callback),
    removeListener: (callback) => chrome.runtime.onStartup.removeListener(callback),
  },

  onSuspend: {
    addListener: (callback) => chrome.runtime.onSuspend.addListener(callback),
    removeListener: (callback) => chrome.runtime.onSuspend.removeListener(callback),
  },

  onMessage: {
    addListener: (callback) => chrome.runtime.onMessage.addListener(callback),
    removeListener: (callback) => chrome.runtime.onMessage.removeListener(callback),
  },

  onConnect: {
    addListener: (callback) => chrome.runtime.onConnect.addListener(callback),
    removeListener: (callback) => chrome.runtime.onConnect.removeListener(callback),
  },
};

// ============================================================================
// Scripting API
// ============================================================================

const scripting: BrowserAdapter['scripting'] = {
  executeScript: (injection) => chrome.scripting.executeScript(injection) as Promise<chrome.scripting.InjectionResult<unknown>[]>,

  insertCSS: (injection) => chrome.scripting.insertCSS(injection),

  removeCSS: (injection) => chrome.scripting.removeCSS(injection),

  registerContentScripts: (scripts) => chrome.scripting.registerContentScripts(scripts),

  unregisterContentScripts: (filter) => chrome.scripting.unregisterContentScripts(filter),

  getRegisteredContentScripts: (filter) =>
    chrome.scripting.getRegisteredContentScripts(filter),

  updateContentScripts: (scripts) => chrome.scripting.updateContentScripts(scripts),
};

// ============================================================================
// Export Chrome Adapter
// ============================================================================

export const chromeAdapter: BrowserAdapter = {
  tabs,
  windows,
  storage,
  alarms,
  runtime,
  scripting,
  isChrome: true,
  isFirefox: false,
  isEdge: false,
};
