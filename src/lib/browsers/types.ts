/**
 * Unified Browser API Types
 * Provides type definitions for cross-browser extension development
 */

// ============================================================================
// Event Types
// ============================================================================

export interface BrowserEvent<T extends (...args: never[]) => void> {
  addListener: (callback: T) => void;
  removeListener: (callback: T) => void;
}

// ============================================================================
// Tabs Types
// ============================================================================

export interface TabsAdapter {
  // Query & Get
  query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
  get: (tabId: number) => Promise<chrome.tabs.Tab>;

  // CRUD
  create: (createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>;
  update: (
    tabId: number,
    updateProperties: chrome.tabs.UpdateProperties
  ) => Promise<chrome.tabs.Tab | undefined>;
  remove: (tabIds: number | number[]) => Promise<void>;
  duplicate: (tabId: number) => Promise<chrome.tabs.Tab | undefined>;

  // Movement
  move: (
    tabIds: number | number[],
    moveProperties: chrome.tabs.MoveProperties
  ) => Promise<chrome.tabs.Tab | chrome.tabs.Tab[]>;

  // State
  reload: (tabId?: number, reloadProperties?: chrome.tabs.ReloadProperties) => Promise<void>;
  discard: (tabId?: number) => Promise<chrome.tabs.Tab | undefined>;

  // Groups (Chrome-only, stubs for Firefox)
  group: (options: chrome.tabs.GroupOptions) => Promise<number>;
  ungroup: (tabIds: number | number[]) => Promise<void>;

  // Capture & Messaging
  captureVisibleTab: (
    windowId?: number,
    options?: chrome.tabs.CaptureVisibleTabOptions
  ) => Promise<string>;
  sendMessage: <T = unknown, R = unknown>(tabId: number, message: T) => Promise<R>;

  // Events
  onCreated: BrowserEvent<(tab: chrome.tabs.Tab) => void>;
  onUpdated: BrowserEvent<
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void
  >;
  onRemoved: BrowserEvent<
    (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void
  >;
  onActivated: BrowserEvent<(activeInfo: chrome.tabs.TabActiveInfo) => void>;
  onMoved: BrowserEvent<(tabId: number, moveInfo: chrome.tabs.TabMoveInfo) => void>;
  onAttached: BrowserEvent<(tabId: number, attachInfo: chrome.tabs.TabAttachInfo) => void>;
  onDetached: BrowserEvent<(tabId: number, detachInfo: chrome.tabs.TabDetachInfo) => void>;
  onReplaced: BrowserEvent<(addedTabId: number, removedTabId: number) => void>;
}

// ============================================================================
// Windows Types
// ============================================================================

export interface WindowsAdapter {
  // Query & Get
  get: (
    windowId: number,
    getInfo?: chrome.windows.QueryOptions
  ) => Promise<chrome.windows.Window>;
  getAll: (getInfo?: chrome.windows.QueryOptions) => Promise<chrome.windows.Window[]>;
  getCurrent: (getInfo?: chrome.windows.QueryOptions) => Promise<chrome.windows.Window>;
  getLastFocused: (getInfo?: chrome.windows.QueryOptions) => Promise<chrome.windows.Window>;

  // CRUD
  create: (
    createData?: chrome.windows.CreateData
  ) => Promise<chrome.windows.Window | undefined>;
  update: (
    windowId: number,
    updateInfo: chrome.windows.UpdateInfo
  ) => Promise<chrome.windows.Window>;
  remove: (windowId: number) => Promise<void>;

  // Events
  onCreated: BrowserEvent<(window: chrome.windows.Window) => void>;
  onRemoved: BrowserEvent<(windowId: number) => void>;
  onFocusChanged: BrowserEvent<(windowId: number) => void>;

  // Constants
  WINDOW_ID_NONE: number;
  WINDOW_ID_CURRENT: number;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
  getBytesInUse?: (keys?: string | string[] | null) => Promise<number>;
}

export interface SessionStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

export interface StorageAdapter {
  local: StorageArea;
  sync: StorageArea;
  session: SessionStorageArea;
  onChanged: BrowserEvent<
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: 'sync' | 'local' | 'session' | 'managed'
    ) => void
  >;
}

// ============================================================================
// Alarms Types
// ============================================================================

export interface AlarmsAdapter {
  create: (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => Promise<void>;
  get: (name: string) => Promise<chrome.alarms.Alarm | undefined>;
  getAll: () => Promise<chrome.alarms.Alarm[]>;
  clear: (name: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  onAlarm: BrowserEvent<(alarm: chrome.alarms.Alarm) => void>;
}

// ============================================================================
// Runtime Types
// ============================================================================

export interface RuntimeAdapter {
  // Messaging
  sendMessage: <T = unknown, R = unknown>(message: T) => Promise<R>;
  connect: (connectInfo?: chrome.runtime.ConnectInfo) => chrome.runtime.Port;

  // URLs & Info
  getURL: (path: string) => string;
  getManifest: () => chrome.runtime.Manifest;
  getPlatformInfo: () => Promise<chrome.runtime.PlatformInfo>;

  // Lifecycle
  setUninstallURL: (url: string) => Promise<void>;
  reload: () => void;
  openOptionsPage: () => Promise<void>;

  // Properties
  readonly id: string | undefined;
  readonly lastError: chrome.runtime.LastError | undefined;

  // Events
  onInstalled: BrowserEvent<(details: chrome.runtime.InstalledDetails) => void>;
  onStartup: BrowserEvent<() => void>;
  onSuspend: BrowserEvent<() => void>;
  onMessage: BrowserEvent<
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void
  >;
  onConnect: BrowserEvent<(port: chrome.runtime.Port) => void>;
}

// ============================================================================
// Scripting Types
// ============================================================================

export interface ScriptingAdapter {
  executeScript: (
    injection: chrome.scripting.ScriptInjection<unknown[], unknown>
  ) => Promise<chrome.scripting.InjectionResult<unknown>[]>;
  insertCSS: (injection: chrome.scripting.CSSInjection) => Promise<void>;
  removeCSS: (injection: chrome.scripting.CSSInjection) => Promise<void>;
  registerContentScripts: (
    scripts: chrome.scripting.RegisteredContentScript[]
  ) => Promise<void>;
  unregisterContentScripts: (
    filter?: chrome.scripting.ContentScriptFilter
  ) => Promise<void>;
  getRegisteredContentScripts: (
    filter?: chrome.scripting.ContentScriptFilter
  ) => Promise<chrome.scripting.RegisteredContentScript[]>;
  updateContentScripts: (
    scripts: chrome.scripting.RegisteredContentScript[]
  ) => Promise<void>;
}

// ============================================================================
// Main Browser Adapter Interface
// ============================================================================

export interface BrowserAdapter {
  tabs: TabsAdapter;
  windows: WindowsAdapter;
  storage: StorageAdapter;
  alarms: AlarmsAdapter;
  runtime: RuntimeAdapter;
  scripting: ScriptingAdapter;

  // Browser detection flags
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
}
