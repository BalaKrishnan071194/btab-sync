/**
 * TabList Component
 *
 * Virtualized list container for tabs with collapsible sections.
 * Features:
 * - Pinned tabs section (collapsible, gold accent)
 * - Current window tabs section (collapsible in focus mode)
 * - Other tabs grouped with smooth animations
 * - Virtual windowing for performance with many tabs
 */

import { useMemo, useCallback, memo, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, Layers } from 'lucide-react';
import { useSettings, useTabs, useSearch, isDarkTheme } from '../BTabContext';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

type SortMode = 'recent' | 'name' | 'memory' | 'idle';

interface TabListProps {
  readonly sortMode: SortMode;
  readonly sortAscending: boolean;
  readonly searchQuery: string;
  readonly highlightedIndex: number;
  readonly selectedTabIds: ReadonlySet<number>;
  readonly focusedTabId: number | null;
  readonly privacyMode: boolean;
  /** S1-4: Whether focus mode is enabled (filter to current window) */
  readonly focusMode?: boolean;
  /** S1-4: Active window ID for focus mode */
  readonly activeWindowId?: number | null;
  readonly children: (props: TabListChildProps) => ReactNode;
}

export interface TabListChildProps {
  readonly tabs: readonly TabInfo[];
  readonly highlightedIndex: number;
  readonly startIndex: number;
}

// ============================================================================
// Constants
// ============================================================================

const VIRTUAL_WINDOW_SIZE = 20;
const VIRTUAL_THRESHOLD = 150;

// ============================================================================
// Sorting Logic
// ============================================================================

function sortTabs(
  tabs: readonly TabInfo[],
  mode: SortMode,
  ascending: boolean
): readonly TabInfo[] {
  if (mode === 'recent') {
    return tabs; // Already in recent order from background
  }

  const sorted = [...tabs].sort((a, b) => {
    let cmp = 0;

    switch (mode) {
      case 'name':
        cmp = a.title.localeCompare(b.title);
        break;

      case 'memory':
        cmp = b.estimatedMemoryMB - a.estimatedMemoryMB;
        break;

      case 'idle': {
        // Zero-idle (active) tabs always last
        const aZero = a.idleDurationMs === 0;
        const bZero = b.idleDurationMs === 0;
        if (aZero !== bZero) return aZero ? 1 : -1;
        if (aZero) return 0;
        cmp = b.idleDurationMs - a.idleDurationMs;
        break;
      }

      default:
        cmp = 0;
    }

    return ascending ? cmp : -cmp;
  });

  return sorted;
}

// ============================================================================
// Filtering Logic
// ============================================================================

function filterTabs(
  tabs: readonly TabInfo[],
  query: string,
  focusMode: boolean = false,
  activeWindowId: number | null = null
): readonly TabInfo[] {
  let filteredTabs = tabs;
  
  // S1-4: Focus Mode - filter to current window only
  if (focusMode && activeWindowId !== null) {
    filteredTabs = filteredTabs.filter(t => t.windowId === activeWindowId);
  }
  
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return filteredTabs;
  }

  // Command mode
  if (normalizedQuery.startsWith('/')) {
    const cmdParts = normalizedQuery.slice(1).split(/\s+/).filter(Boolean);
    const cmd = cmdParts[0] ?? '';
    const cmdQuery = cmdParts.slice(1).join(' ');
    
    switch (cmd) {
      case 'audio':
        return filteredTabs.filter(t => t.audible);
      case 'stale':
        return filteredTabs.filter(t => t.isStale);
      case 'dup':
      case 'duplicate':
      case 'duplicates':
        return filteredTabs.filter(t => t.isDuplicate);
      case 'pinned':
        return filteredTabs.filter(t => t.pinned);
      case 'discarded':
      case 'frozen':
        return filteredTabs.filter(t => t.discarded);
      // S1-4: Focus command
      case 'focus': {
        let focusedTabs = activeWindowId !== null 
          ? tabs.filter(t => t.windowId === activeWindowId) 
          : tabs;
        // If there's additional query after /focus, filter by that too
        if (cmdQuery) {
          const terms = cmdQuery.split(/\s+/).filter(Boolean);
          focusedTabs = focusedTabs.filter(t => {
            const haystack = (t.title + ' ' + t.url).toLowerCase();
            return terms.every(term => haystack.includes(term));
          });
        }
        return focusedTabs;
      }
      default:
        return [];
    }
  }

  // S1-2: Multi-word AND search - all terms must match
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return filteredTabs.filter(
    t => {
      const haystack = (t.title + ' ' + t.url).toLowerCase();
      return terms.every(term => haystack.includes(term));
    }
  );
}

// ============================================================================
// Tab Grouping
// ============================================================================

interface TabGroups {
  readonly pinned: readonly TabInfo[];
  readonly regular: readonly TabInfo[];
}

function groupTabs(tabs: readonly TabInfo[]): TabGroups {
  const pinned: TabInfo[] = [];
  const regular: TabInfo[] = [];
  
  for (const tab of tabs) {
    if (tab.pinned) {
      pinned.push(tab);
    } else {
      regular.push(tab);
    }
  }
  
  return { pinned, regular };
}

// ============================================================================
// Component
// ============================================================================

export const TabList = memo(function TabList({
  sortMode,
  sortAscending,
  searchQuery,
  highlightedIndex,
  selectedTabIds,
  focusedTabId,
  privacyMode,
  focusMode = false,
  activeWindowId = null,
  children,
}: TabListProps): React.JSX.Element {
  const settings = useSettings();
  const tabs = useTabs();
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = isDarkTheme(settings.theme);

  // Process tabs: sort then filter
  const processedTabs = useMemo(() => {
    const sorted = sortTabs(tabs, sortMode, sortAscending);
    return filterTabs(sorted, searchQuery, focusMode, activeWindowId);
  }, [tabs, sortMode, sortAscending, searchQuery, focusMode, activeWindowId]);

  // Group tabs into pinned and regular
  const { pinned, regular } = useMemo(
    () => groupTabs(processedTabs),
    [processedTabs]
  );

  // Virtual windowing for performance
  const { displayTabs, startIndex } = useMemo(() => {
    // Only virtualize in search mode with many tabs
    if (tabs.length <= VIRTUAL_THRESHOLD || searchQuery.startsWith('/')) {
      return { displayTabs: processedTabs, startIndex: 0 };
    }

    const start = Math.max(
      0,
      Math.min(highlightedIndex - 10, processedTabs.length - VIRTUAL_WINDOW_SIZE)
    );
    return {
      displayTabs: processedTabs.slice(start, start + VIRTUAL_WINDOW_SIZE),
      startIndex: start,
    };
  }, [processedTabs, tabs.length, highlightedIndex, searchQuery]);

  // Check if we're in search/command mode (don't show sections)
  const isSearchMode = searchQuery.trim().length > 0;

  // Empty state
  if (processedTabs.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'overflow-y-auto p-[5px]',
          'scrollbar-thin scrollbar-track-transparent',
          isDark ? 'scrollbar-thumb-white/[0.12]' : 'scrollbar-thumb-black/[0.1]'
        )}
      >
        <EmptyState
          message={
            searchQuery.startsWith('/')
              ? 'Unknown command. Try /audio, /stale, /dup, /pinned, /frozen'
              : searchQuery
                ? 'No matching tabs'
                : 'No tabs'
          }
          isDark={isDark}
        />
      </div>
    );
  }

  // Search mode - render flat list without sections
  if (isSearchMode) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'overflow-y-auto p-[5px]',
          'overscroll-contain',
          'scrollbar-thin scrollbar-track-transparent',
          isDark ? 'scrollbar-thumb-white/[0.12]' : 'scrollbar-thumb-black/[0.1]'
        )}
        role="listbox"
        aria-label="Tab list"
      >
        {children({
          tabs: displayTabs,
          highlightedIndex: highlightedIndex - startIndex,
          startIndex,
        })}
      </div>
    );
  }

  // Normal mode - render with collapsible sections
  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-y-auto p-[5px]',
        'overscroll-contain',
        'scrollbar-thin scrollbar-track-transparent',
        isDark ? 'scrollbar-thumb-white/[0.12]' : 'scrollbar-thumb-black/[0.1]'
      )}
      role="listbox"
      aria-label="Tab list"
    >
      {/* Pinned Tabs Section */}
      {pinned.length > 0 && (
        <CollapsibleSection
          storageKey="pinned_tabs"
          title="Pinned"
          icon={<Pin className="w-3 h-3" strokeWidth={2} />}
          count={pinned.length}
          variant="gold"
          defaultExpanded={true}
          isDark={isDark}
        >
          {children({
            tabs: pinned,
            highlightedIndex: highlightedIndex,
            startIndex: 0,
          })}
        </CollapsibleSection>
      )}

      {/* Regular Tabs Section */}
      {regular.length > 0 && (
        <CollapsibleSection
          storageKey="regular_tabs"
          title={pinned.length > 0 ? "Other Tabs" : "All Tabs"}
          icon={<Layers className="w-3 h-3" strokeWidth={2} />}
          count={regular.length}
          variant="default"
          defaultExpanded={true}
          isDark={isDark}
        >
          {children({
            tabs: regular,
            highlightedIndex: pinned.length > 0 ? highlightedIndex - pinned.length : highlightedIndex,
            startIndex: pinned.length,
          })}
        </CollapsibleSection>
      )}
    </div>
  );
});

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  readonly message: string;
  readonly isDark: boolean;
}

const EmptyState = memo(function EmptyState({
  message,
  isDark,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'py-5 px-3 text-center text-xs leading-relaxed',
        isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
      )}
    >
      {message}
    </div>
  );
});

export default TabList;
