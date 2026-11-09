/**
 * BTab Context
 *
 * React context for tab state, settings, and actions.
 * Provides typed access to all tab management functionality.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react';
import { ext } from '@/lib/browsers';

// ============================================================================
// Types
// ============================================================================

/** Tab metadata from background script */
export interface TabInfo {
  readonly id: number;
  readonly windowId: number;
  readonly title: string;
  readonly url: string;
  readonly favIconUrl: string;
  readonly active: boolean;
  readonly audible: boolean;
  readonly discarded: boolean;
  readonly pinned: boolean;
  readonly isStale: boolean;
  readonly idleDurationMs: number;
  readonly idleLabel: string;
  readonly estimatedMemoryMB: number;
  readonly isDuplicate: boolean;
  /** S1-5: Smart-normalized URL for Pro duplicate detection */
  readonly smartDupUrl?: string;
}

/** Recently closed tab entry */
export interface RecentlyClosedTab {
  readonly sessionId: string;
  readonly title: string;
  readonly url: string;
  readonly favIconUrl: string;
  readonly closedAtMs: number;
  readonly closedAgoLabel: string;
}

/** Theme options */
export type BTabTheme = 
  | 'midnight-teal'
  | 'ocean-blue'
  | 'purple-haze'
  | 'emerald-forest'
  | 'sunrise'
  | 'clean-slate'
  | 'lavender-mist'
  | 'rose-gold';

/** List of dark themes */
export const DARK_THEMES: BTabTheme[] = ['midnight-teal', 'ocean-blue', 'purple-haze', 'emerald-forest'];

/** Check if a theme is dark */
export function isDarkTheme(theme: BTabTheme): boolean {
  return DARK_THEMES.includes(theme);
}

/** User settings stored in extension storage */
export interface BTabSettings {
  readonly theme: BTabTheme;
  readonly compactMode: boolean;
  readonly showIdleTime: boolean;
  readonly showMemoryEstimate: boolean;
  readonly groupByWindow: boolean;
  readonly sortBy: 'recent' | 'title' | 'domain' | 'memory';
  readonly pinnedProtection: boolean;
  readonly focusModeEnabled: boolean;
  readonly keyboardShortcutsEnabled: boolean;
}

/** Full payload from background script */
export interface TabPayload {
  readonly tabs: readonly TabInfo[];
  readonly recentlyClosed: readonly RecentlyClosedTab[];
  readonly inactiveCount: number;
  readonly totalBackgroundMemoryMB: number;
  readonly recoverableMemoryMB: number;
  readonly canDiscard: boolean;
  readonly hasSessions: boolean;
  readonly isPro: boolean;
}

/** Overlay visibility state */
export type OverlayVisibility = 'hidden' | 'visible' | 'animating-in' | 'animating-out';

/** Search/filter state */
export interface SearchState {
  readonly query: string;
  readonly highlightedIndex: number;
  readonly filteredTabIds: readonly number[];
}

/** Complete context state */
export interface BTabState {
  readonly payload: TabPayload | null;
  readonly settings: BTabSettings;
  readonly visibility: OverlayVisibility;
  readonly search: SearchState;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly selectedTabIds: ReadonlySet<number>;
  readonly focusedTabId: number | null;
  /** S1-4: Focus Mode state */
  readonly focusMode: boolean;
  /** S1-4: Active window ID (from active tab) */
  readonly activeWindowId: number | null;
}

// ============================================================================
// Actions
// ============================================================================

type BTabAction =
  | { readonly type: 'SET_PAYLOAD'; readonly payload: TabPayload }
  | { readonly type: 'SET_SETTINGS'; readonly settings: Partial<BTabSettings> }
  | { readonly type: 'SET_VISIBILITY'; readonly visibility: OverlayVisibility }
  | { readonly type: 'SET_SEARCH_QUERY'; readonly query: string }
  | { readonly type: 'SET_HIGHLIGHTED_INDEX'; readonly index: number }
  | { readonly type: 'SET_FILTERED_TAB_IDS'; readonly ids: readonly number[] }
  | { readonly type: 'SET_LOADING'; readonly isLoading: boolean }
  | { readonly type: 'SET_ERROR'; readonly error: string | null }
  | { readonly type: 'SELECT_TAB'; readonly tabId: number }
  | { readonly type: 'DESELECT_TAB'; readonly tabId: number }
  | { readonly type: 'TOGGLE_TAB_SELECTION'; readonly tabId: number }
  | { readonly type: 'CLEAR_SELECTION' }
  | { readonly type: 'SELECT_ALL_VISIBLE' }
  | { readonly type: 'SET_FOCUSED_TAB'; readonly tabId: number | null }
  | { readonly type: 'SET_FOCUS_MODE'; readonly enabled: boolean }
  | { readonly type: 'SET_ACTIVE_WINDOW_ID'; readonly windowId: number | null }
  | { readonly type: 'RESET' };

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: BTabSettings = {
  theme: 'emerald-forest', // User selected theme
  compactMode: false,
  showIdleTime: true,
  showMemoryEstimate: true,
  groupByWindow: false,
  sortBy: 'recent',
  pinnedProtection: true,
  focusModeEnabled: false,
  keyboardShortcutsEnabled: true,
} as const;

const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  highlightedIndex: 0,
  filteredTabIds: [],
} as const;

const INITIAL_STATE: BTabState = {
  payload: null,
  settings: DEFAULT_SETTINGS,
  visibility: 'hidden',
  search: DEFAULT_SEARCH_STATE,
  isLoading: false,
  error: null,
  selectedTabIds: new Set(),
  focusedTabId: null,
  focusMode: false,
  activeWindowId: null,
} as const;

// ============================================================================
// Reducer
// ============================================================================

function btabReducer(state: BTabState, action: BTabAction): BTabState {
  switch (action.type) {
    case 'SET_PAYLOAD':
      return {
        ...state,
        payload: action.payload,
        isLoading: false,
        error: null,
      };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case 'SET_VISIBILITY':
      return {
        ...state,
        visibility: action.visibility,
        // Reset search and focus mode when hiding
        search:
          action.visibility === 'hidden' || action.visibility === 'animating-out'
            ? DEFAULT_SEARCH_STATE
            : state.search,
        // Clear selection and focus mode when hiding
        selectedTabIds:
          action.visibility === 'hidden' ? new Set() : state.selectedTabIds,
        focusMode:
          action.visibility === 'hidden' ? false : state.focusMode,
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        search: {
          ...state.search,
          query: action.query,
          highlightedIndex: 0, // Reset to first result on new search
        },
      };

    case 'SET_HIGHLIGHTED_INDEX':
      return {
        ...state,
        search: {
          ...state.search,
          highlightedIndex: action.index,
        },
      };

    case 'SET_FILTERED_TAB_IDS':
      return {
        ...state,
        search: {
          ...state.search,
          filteredTabIds: action.ids,
          highlightedIndex: Math.min(
            state.search.highlightedIndex,
            Math.max(0, action.ids.length - 1)
          ),
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      };

    case 'SELECT_TAB': {
      const newSet = new Set(state.selectedTabIds);
      newSet.add(action.tabId);
      return { ...state, selectedTabIds: newSet };
    }

    case 'DESELECT_TAB': {
      const newSet = new Set(state.selectedTabIds);
      newSet.delete(action.tabId);
      return { ...state, selectedTabIds: newSet };
    }

    case 'TOGGLE_TAB_SELECTION': {
      const newSet = new Set(state.selectedTabIds);
      if (newSet.has(action.tabId)) {
        newSet.delete(action.tabId);
      } else {
        newSet.add(action.tabId);
      }
      return { ...state, selectedTabIds: newSet };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedTabIds: new Set() };

    case 'SELECT_ALL_VISIBLE': {
      const visibleIds = state.search.filteredTabIds.length > 0
        ? state.search.filteredTabIds
        : state.payload?.tabs.map((t) => t.id) ?? [];
      return { ...state, selectedTabIds: new Set(visibleIds) };
    }

    case 'SET_FOCUSED_TAB':
      return { ...state, focusedTabId: action.tabId };

    case 'SET_FOCUS_MODE':
      return { ...state, focusMode: action.enabled };

    case 'SET_ACTIVE_WINDOW_ID':
      return { ...state, activeWindowId: action.windowId };

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface BTabContextValue {
  readonly state: BTabState;
  readonly dispatch: Dispatch<BTabAction>;
  readonly actions: BTabActions;
}

interface BTabActions {
  // Payload
  readonly refreshPayload: () => Promise<void>;

  // Visibility
  readonly show: () => void;
  readonly hide: () => void;
  readonly toggle: () => void;

  // Tab operations
  readonly switchToTab: (tabId: number, windowId: number) => Promise<void>;
  readonly sleepTab: (tabId: number) => Promise<boolean>;
  readonly closeTab: (tabId: number) => Promise<boolean>;
  readonly pinTab: (tabId: number, pinned: boolean) => Promise<boolean>;
  readonly restoreTab: (sessionId: string) => Promise<boolean>;
  readonly sleepSelected: () => Promise<number>;
  readonly closeSelected: () => Promise<number>;
  readonly closeDuplicates: () => Promise<number>;

  // Search
  readonly setSearchQuery: (query: string) => void;
  readonly moveHighlight: (delta: number) => void;
  readonly selectHighlighted: () => void;

  // Selection
  readonly selectTab: (tabId: number) => void;
  readonly deselectTab: (tabId: number) => void;
  readonly toggleTabSelection: (tabId: number) => void;
  readonly clearSelection: () => void;
  readonly selectAllVisible: () => void;

  // Settings
  readonly updateSettings: (settings: Partial<BTabSettings>) => Promise<void>;

  // S1-4: Focus Mode
  readonly toggleFocusMode: () => void;
  readonly setFocusMode: (enabled: boolean) => void;
}

const BTabContext = createContext<BTabContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface BTabProviderProps {
  readonly children: ReactNode;
  readonly initialPayload?: TabPayload | undefined;
}

export function BTabProvider({
  children,
  initialPayload,
}: BTabProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(btabReducer, {
    ...INITIAL_STATE,
    payload: initialPayload ?? null,
    visibility: initialPayload ? 'visible' : 'hidden',
  });

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const stored = await ext.storage.local.get(['btabSettings']);
        const settings = stored['btabSettings'] as Partial<BTabSettings> | undefined;
        if (settings) {
          dispatch({ type: 'SET_SETTINGS', settings });
        }
      } catch (e) {
        console.warn('[bTab] Failed to load settings:', e);
      }
    };

    void loadSettings();
  }, []);

  // Actions
  const refreshPayload = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const payload = await ext.runtime.sendMessage({ action: 'getPayload' }) as TabPayload | null;
      if (payload) {
        dispatch({ type: 'SET_PAYLOAD', payload });
      } else {
        dispatch({ type: 'SET_ERROR', error: 'Failed to get tab data' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      dispatch({ type: 'SET_ERROR', error: message });
    }
  }, []);

  const show = useCallback((): void => {
    dispatch({ type: 'SET_VISIBILITY', visibility: 'animating-in' });
    // Transition to visible after animation
    requestAnimationFrame(() => {
      dispatch({ type: 'SET_VISIBILITY', visibility: 'visible' });
    });
  }, []);

  const hide = useCallback((): void => {
    dispatch({ type: 'SET_VISIBILITY', visibility: 'animating-out' });
    // Transition to hidden after animation
    setTimeout(() => {
      dispatch({ type: 'SET_VISIBILITY', visibility: 'hidden' });
    }, 200); // Match CSS transition duration
  }, []);

  const toggle = useCallback((): void => {
    if (state.visibility === 'hidden') {
      show();
    } else if (state.visibility === 'visible') {
      hide();
    }
  }, [state.visibility, show, hide]);

  const switchToTab = useCallback(
    async (tabId: number, windowId: number): Promise<void> => {
      try {
        await ext.runtime.sendMessage({
          action: 'executeTabSwitch',
          tabId,
          windowId,
        });
        hide();
      } catch (e) {
        console.warn('[bTab] Failed to switch tab:', e);
      }
    },
    [hide]
  );

  const sleepTab = useCallback(async (tabId: number): Promise<boolean> => {
    try {
      const response = await ext.runtime.sendMessage({
        action: 'sleepTab',
        tabId,
      }) as { success: boolean };
      if (response?.success) {
        void refreshPayload();
      }
      return response?.success ?? false;
    } catch {
      return false;
    }
  }, [refreshPayload]);

  const closeTab = useCallback(async (tabId: number): Promise<boolean> => {
    try {
      const response = await ext.runtime.sendMessage({
        action: 'closeTab',
        tabId,
      }) as { success: boolean };
      if (response?.success) {
        void refreshPayload();
      }
      return response?.success ?? false;
    } catch {
      return false;
    }
  }, [refreshPayload]);

  const pinTab = useCallback(async (tabId: number, pinned: boolean): Promise<boolean> => {
    try {
      const response = await ext.runtime.sendMessage({
        action: 'pinTab',
        tabId,
        pinned,
      }) as { success: boolean };
      if (response?.success) {
        void refreshPayload();
      }
      return response?.success ?? false;
    } catch {
      return false;
    }
  }, [refreshPayload]);

  const restoreTab = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await ext.runtime.sendMessage({
        action: 'restoreTab',
        sessionId,
      }) as { success: boolean };
      if (response?.success) {
        void refreshPayload();
      }
      return response?.success ?? false;
    } catch {
      return false;
    }
  }, [refreshPayload]);

  const sleepSelected = useCallback(async (): Promise<number> => {
    const tabs = state.payload?.tabs ?? [];
    const selected = [...state.selectedTabIds];
    let count = 0;

    for (const tabId of selected) {
      const tab = tabs.find((t) => t.id === tabId);
      // Skip pinned tabs if protection is enabled
      if (tab && (!tab.pinned || !state.settings.pinnedProtection)) {
        const success = await sleepTab(tabId);
        if (success) count++;
      }
    }

    dispatch({ type: 'CLEAR_SELECTION' });
    return count;
  }, [state.payload?.tabs, state.selectedTabIds, state.settings.pinnedProtection, sleepTab]);

  const closeSelected = useCallback(async (): Promise<number> => {
    const tabs = state.payload?.tabs ?? [];
    const selected = [...state.selectedTabIds];
    let count = 0;

    for (const tabId of selected) {
      const tab = tabs.find((t) => t.id === tabId);
      // Skip pinned tabs if protection is enabled
      if (tab && (!tab.pinned || !state.settings.pinnedProtection)) {
        const success = await closeTab(tabId);
        if (success) count++;
      }
    }

    dispatch({ type: 'CLEAR_SELECTION' });
    return count;
  }, [state.payload?.tabs, state.selectedTabIds, state.settings.pinnedProtection, closeTab]);

  const closeDuplicates = useCallback(async (): Promise<number> => {
    const tabs = state.payload?.tabs ?? [];
    const isProUser = state.payload?.isPro ?? false;
    const duplicates = tabs.filter(
      (t) => t.isDuplicate && !t.active && (!t.pinned || !state.settings.pinnedProtection)
    );

    // S1-5: Group by URL - use smartDupUrl for Pro users
    const urlGroups = new Map<string, TabInfo[]>();
    for (const tab of duplicates) {
      // For Pro users, use smartDupUrl to group tracking parameter variants together
      const groupKey = isProUser && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
      const existing = urlGroups.get(groupKey);
      if (existing) {
        existing.push(tab);
      } else {
        urlGroups.set(groupKey, [tab]);
      }
    }

    let count = 0;
    for (const group of urlGroups.values()) {
      // S1-5: Sort by idleDurationMs ascending (lowest idle = most recently active)
      // Keep the most recently active tab, close the rest
      group.sort((a, b) => a.idleDurationMs - b.idleDurationMs);
      
      // Close all but the first (most recently active) tab in each group
      for (let i = 1; i < group.length; i++) {
        const tab = group[i];
        if (tab) {
          const success = await closeTab(tab.id);
          if (success) count++;
        }
      }
    }

    return count;
  }, [state.payload?.tabs, state.payload?.isPro, state.settings.pinnedProtection, closeTab]);

  const setSearchQuery = useCallback((query: string): void => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });

    if (!state.payload) return;

    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      dispatch({ type: 'SET_FILTERED_TAB_IDS', ids: [] });
      return;
    }

    // S1-2: Multi-word AND search - all terms must match
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const filtered = state.payload.tabs.filter((tab) => {
      const haystack = (tab.title + ' ' + tab.url).toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
    dispatch({ type: 'SET_FILTERED_TAB_IDS', ids: filtered.map((t) => t.id) });
  }, [state.payload]);

  const moveHighlight = useCallback((delta: number): void => {
    const ids = state.search.filteredTabIds.length > 0
      ? state.search.filteredTabIds
      : state.payload?.tabs.map((t) => t.id) ?? [];

    if (ids.length === 0) return;

    const currentIndex = state.search.highlightedIndex;
    let newIndex = currentIndex + delta;

    // Wrap around
    if (newIndex < 0) newIndex = ids.length - 1;
    if (newIndex >= ids.length) newIndex = 0;

    dispatch({ type: 'SET_HIGHLIGHTED_INDEX', index: newIndex });
  }, [state.search.filteredTabIds, state.search.highlightedIndex, state.payload?.tabs]);

  const selectHighlighted = useCallback((): void => {
    const ids = state.search.filteredTabIds.length > 0
      ? state.search.filteredTabIds
      : state.payload?.tabs.map((t) => t.id) ?? [];

    const tabId = ids[state.search.highlightedIndex];
    if (tabId == null) return;

    const tab = state.payload?.tabs.find((t) => t.id === tabId);
    if (tab) {
      void switchToTab(tab.id, tab.windowId);
    }
  }, [state.search.filteredTabIds, state.search.highlightedIndex, state.payload?.tabs, switchToTab]);

  const selectTab = useCallback((tabId: number): void => {
    dispatch({ type: 'SELECT_TAB', tabId });
  }, []);

  const deselectTab = useCallback((tabId: number): void => {
    dispatch({ type: 'DESELECT_TAB', tabId });
  }, []);

  const toggleTabSelection = useCallback((tabId: number): void => {
    dispatch({ type: 'TOGGLE_TAB_SELECTION', tabId });
  }, []);

  const clearSelection = useCallback((): void => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const selectAllVisible = useCallback((): void => {
    dispatch({ type: 'SELECT_ALL_VISIBLE' });
  }, []);

  const updateSettings = useCallback(
    async (settings: Partial<BTabSettings>): Promise<void> => {
      dispatch({ type: 'SET_SETTINGS', settings });

      try {
        const currentStored = await ext.storage.local.get(['btabSettings']);
        const current = (currentStored['btabSettings'] as BTabSettings | undefined) ?? DEFAULT_SETTINGS;
        await ext.storage.local.set({
          btabSettings: { ...current, ...settings },
        });
      } catch (e) {
        console.warn('[bTab] Failed to save settings:', e);
      }
    },
    []
  );

  // S1-4: Focus Mode actions
  const toggleFocusMode = useCallback((): void => {
    dispatch({ type: 'SET_FOCUS_MODE', enabled: !state.focusMode });
  }, [state.focusMode]);

  const setFocusMode = useCallback((enabled: boolean): void => {
    dispatch({ type: 'SET_FOCUS_MODE', enabled });
  }, []);

  const actions = useMemo<BTabActions>(
    () => ({
      refreshPayload,
      show,
      hide,
      toggle,
      switchToTab,
      sleepTab,
      closeTab,
      pinTab,
      restoreTab,
      sleepSelected,
      closeSelected,
      closeDuplicates,
      setSearchQuery,
      moveHighlight,
      selectHighlighted,
      selectTab,
      deselectTab,
      toggleTabSelection,
      clearSelection,
      selectAllVisible,
      updateSettings,
      toggleFocusMode,
      setFocusMode,
    }),
    [
      refreshPayload,
      show,
      hide,
      toggle,
      switchToTab,
      sleepTab,
      closeTab,
      pinTab,
      restoreTab,
      sleepSelected,
      closeSelected,
      closeDuplicates,
      setSearchQuery,
      moveHighlight,
      selectHighlighted,
      selectTab,
      deselectTab,
      toggleTabSelection,
      clearSelection,
      selectAllVisible,
      updateSettings,
      toggleFocusMode,
      setFocusMode,
    ]
  );

  const value = useMemo<BTabContextValue>(
    () => ({ state, dispatch, actions }),
    [state, actions]
  );

  return <BTabContext.Provider value={value}>{children}</BTabContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useBTab(): BTabContextValue {
  const context = useContext(BTabContext);
  if (!context) {
    throw new Error('useBTab must be used within a BTabProvider');
  }
  return context;
}

// Convenience hooks for common patterns
export function useTabs(): readonly TabInfo[] {
  const { state } = useBTab();
  return state.payload?.tabs ?? [];
}

export function useSettings(): BTabSettings {
  const { state } = useBTab();
  return state.settings;
}

export function useOverlayVisibility(): OverlayVisibility {
  const { state } = useBTab();
  return state.visibility;
}

export function useSearch(): SearchState {
  const { state } = useBTab();
  return state.search;
}

export function useSelectedTabs(): ReadonlySet<number> {
  const { state } = useBTab();
  return state.selectedTabIds;
}

export function useIsPro(): boolean {
  const { state } = useBTab();
  return state.payload?.isPro ?? false;
}

// S1-4: Focus Mode hook
export function useFocusMode(): { focusMode: boolean; activeWindowId: number | null } {
  const { state } = useBTab();
  return {
    focusMode: state.focusMode,
    activeWindowId: state.activeWindowId,
  };
}
