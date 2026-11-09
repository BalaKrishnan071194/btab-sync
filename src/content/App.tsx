/**
 * Content Script App
 *
 * Main application component for the bTab overlay.
 * Wraps the UI in BTabProvider and PortalProvider for Shadow DOM compatibility.
 * Integrates all Sprint 1-5 features.
 */

import { useEffect, useCallback, useState, useMemo, type JSX } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BTabProvider, useBTab, useSettings, useFocusMode, useTabs, useIsPro, isDarkTheme, type TabPayload, type BTabTheme } from './BTabContext';
import { PortalProvider } from './ui/PortalProvider';
import { TooltipProvider } from './ui/tooltip';
import {
  Panel,
  Header,
  SearchBar,
  SortBar,
  TabList,
  TabRow,
  RecentlyClosed,
  CleanupPanel,
  DuplicatesPanel,
  SettingsPanel,
  MemoryDashboard,
  WorkspacesPanel,
  TimeMachinePanel,
  DetailPanel,
  ProGate,
} from './components';
import { ext } from '@/lib/browsers';
import { cn } from './ui/cn';
import { FolderOpen, History, BarChart3, Settings, Crown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Props for the root App component */
interface AppProps {
  readonly initialPayload?: TabPayload | undefined;
}

type SortMode = 'recent' | 'name' | 'memory' | 'idle';

// ============================================================================
// Footer Component
// ============================================================================

interface FooterProps {
  readonly onSettingsOpen: () => void;
  readonly onMemoryOpen: () => void;
  readonly onWorkspacesOpen: () => void;
  readonly onTimeMachineOpen: () => void;
  readonly workspacesOpen: boolean;
  readonly timeMachineOpen: boolean;
  readonly memoryOpen: boolean;
  readonly isPro: boolean;
}

function Footer({ 
  onSettingsOpen, 
  onMemoryOpen, 
  onWorkspacesOpen, 
  onTimeMachineOpen,
  workspacesOpen,
  timeMachineOpen,
  memoryOpen,
  isPro,
}: FooterProps): JSX.Element {
  const { state } = useBTab();
  const settings = useSettings();
  
  const isDark = ['midnight-teal', 'ocean-blue', 'purple-haze', 'emerald-forest'].includes(settings.theme);

  const tabCount = state.payload?.tabs.length ?? 0;
  const inactiveCount = state.payload?.inactiveCount ?? 0;
  const recoverableMB = state.payload?.recoverableMemoryMB ?? 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-3 shrink-0',
        'border-t text-[11px]',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
      style={{ height: '44px', minHeight: '44px' }}
    >
      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className={isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'}>
          {tabCount} tabs
        </span>
        {inactiveCount > 0 && (
          <span className="text-[#ff9e64]">
            {inactiveCount} idle
          </span>
        )}
        {recoverableMB > 0 && (
          <span className="text-[#7aa2f7]">
            ~{recoverableMB}MB recoverable
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Time Machine Button (S3-2) */}
        <button
          type="button"
          onClick={onTimeMachineOpen}
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            timeMachineOpen 
              ? 'text-[#1dd9b4] bg-[rgba(29,217,180,0.12)]'
              : isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          title="Time Machine - Tab History"
        >
          <History className="w-3.5 h-3.5" />
          {!isPro && (
            <Crown className="w-2 h-2 absolute -top-0.5 -right-0.5 text-[#f9e2af]" />
          )}
        </button>

        {/* Workspaces Button (S3-1) */}
        <button
          type="button"
          onClick={onWorkspacesOpen}
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            workspacesOpen 
              ? 'text-[#1dd9b4] bg-[rgba(29,217,180,0.12)]'
              : isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          title="Workspaces - Save & Restore Tabs"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {!isPro && (
            <Crown className="w-2 h-2 absolute -top-0.5 -right-0.5 text-[#f9e2af]" />
          )}
        </button>

        {/* Memory Dashboard Button (S2-3) */}
        <button
          type="button"
          onClick={onMemoryOpen}
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            memoryOpen 
              ? 'text-[#1dd9b4] bg-[rgba(29,217,180,0.12)]'
              : isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          title="Memory Dashboard"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {!isPro && (
            <Crown className="w-2 h-2 absolute -top-0.5 -right-0.5 text-[#f9e2af]" />
          )}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSettingsOpen();
          }}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isDark
              ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
              : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Inner App (with context access)
// ============================================================================

function AppContent(): JSX.Element {
  const { state, actions } = useBTab();
  const settings = useSettings();
  const tabs = useTabs();
  const isPro = useIsPro();
  const { focusMode } = useFocusMode();

  // Panel states
  const [privacyMode, setPrivacyMode] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [sortAscending, setSortAscending] = useState(true);
  
  // S3-3/S3-4: Detail panel state for notes & reminders
  const [detailTabId, setDetailTabId] = useState<number | null>(null);

  const isDark = ['midnight-teal', 'ocean-blue', 'purple-haze', 'emerald-forest'].includes(settings.theme);

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void
    ): boolean | void => {
      const msg = message as { action?: string; payload?: TabPayload };

      if (msg.action === 'toggleOmniOverlay' && msg.payload) {
        if (state.visibility === 'hidden') {
          void actions.refreshPayload().then(() => {
            actions.show();
          });
        } else {
          actions.hide();
        }
      }
      
      // Real-time tab updates - refresh UI when tabs change
      if (msg.action === 'tabsChanged' && msg.payload && state.visibility !== 'hidden') {
        // Update payload directly without full refresh
        void actions.refreshPayload();
      }
    };

    ext.runtime.onMessage.addListener(handleMessage);

    return () => {
      ext.runtime.onMessage.removeListener(handleMessage);
    };
  }, [state.visibility, actions]);

  // Theme toggle - cycle through themes or toggle light/dark
  const handleThemeToggle = useCallback(() => {
    // Simple toggle between emerald-forest (dark) and clean-slate (light)
    const nextTheme: BTabTheme = isDark ? 'clean-slate' : 'emerald-forest';
    void actions.updateSettings({ theme: nextTheme });
  }, [isDark, actions]);

  // Privacy toggle
  const handlePrivacyToggle = useCallback(() => {
    setPrivacyMode((prev) => !prev);
  }, []);

  // Snap to corner (reset position)
  const handleSnapToCorner = useCallback(() => {
    // Panel component handles this internally via drag constraints
  }, []);

  // Close all panels helper
  const closeAllPanels = useCallback(() => {
    setCleanupOpen(false);
    setDuplicatesOpen(false);
    setMemoryOpen(false);
    setWorkspacesOpen(false);
    setTimeMachineOpen(false);
    setDetailTabId(null);
  }, []);

  // Panel toggles
  const handleCleanupToggle = useCallback(() => {
    closeAllPanels();
    setCleanupOpen((prev) => !prev);
  }, [closeAllPanels]);

  const handleDuplicatesToggle = useCallback(() => {
    closeAllPanels();
    setDuplicatesOpen((prev) => !prev);
  }, [closeAllPanels]);

  const handleSettingsOpen = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleMemoryOpen = useCallback(() => {
    closeAllPanels();
    setMemoryOpen((prev) => !prev);
  }, [closeAllPanels]);

  const handleMemoryClose = useCallback(() => {
    setMemoryOpen(false);
  }, []);

  // S3-1: Workspaces panel toggle
  const handleWorkspacesOpen = useCallback(() => {
    closeAllPanels();
    setWorkspacesOpen((prev) => !prev);
  }, [closeAllPanels]);

  const handleWorkspacesClose = useCallback(() => {
    setWorkspacesOpen(false);
  }, []);

  // S3-2: Time Machine panel toggle
  const handleTimeMachineOpen = useCallback(() => {
    closeAllPanels();
    setTimeMachineOpen((prev) => !prev);
  }, [closeAllPanels]);

  const handleTimeMachineClose = useCallback(() => {
    setTimeMachineOpen(false);
  }, []);

  // S3-3/S3-4: Detail panel for notes & reminders
  const handleExpandDetails = useCallback((tabId: number) => {
    setDetailTabId((prev) => (prev === tabId ? null : tabId));
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailTabId(null);
  }, []);

  // Sort change handler
  const handleSortChange = useCallback((mode: SortMode, ascending: boolean) => {
    setSortMode(mode);
    setSortAscending(ascending);
  }, []);

  // Tab actions
  const handleSwitchTab = useCallback((tabId: number, windowId: number) => {
    void actions.switchToTab(tabId, windowId);
  }, [actions]);

  const handleSleepTab = useCallback((tabId: number) => {
    void actions.sleepTab(tabId);
  }, [actions]);

  const handleCloseTab = useCallback((tabId: number) => {
    void actions.closeTab(tabId);
  }, [actions]);

  const handlePinTab = useCallback((tabId: number, pinned: boolean) => {
    void actions.pinTab(tabId, !pinned); // Toggle pin state
  }, [actions]);

  const handleRestoreTab = useCallback((sessionId: string) => {
    void actions.restoreTab(sessionId);
  }, [actions]);

  // Calculate stats for header
  const inactiveCount = state.payload?.inactiveCount ?? 0;
  const totalMemoryMB = state.payload?.totalBackgroundMemoryMB ?? 0;
  const canDiscard = state.payload?.canDiscard ?? true;

  // S1-4: Get active window ID for focus mode
  const activeWindowId = useMemo(() => {
    const activeTab = tabs.find(t => t.active);
    return activeTab?.windowId ?? null;
  }, [tabs]);

  // Build URL groups for duplicate detection
  const urlGroups = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const tab of tabs) {
      // For Pro users, use smartDupUrl; for Free users, use exact url
      const groupKey = isPro && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.push(tab.id);
      } else {
        groups.set(groupKey, [tab.id]);
      }
    }
    return groups;
  }, [tabs, isPro]);

  // Get detail tab data
  const detailTab = useMemo(() => {
    if (detailTabId === null) return null;
    return tabs.find(t => t.id === detailTabId) ?? null;
  }, [tabs, detailTabId]);

  // Don't render anything when hidden
  if (state.visibility === 'hidden') {
    return <></>;
  }

  return (
    <Panel>
      {/* Settings Panel (full overlay) */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel isOpen={settingsOpen} onClose={handleSettingsClose} />
        )}
      </AnimatePresence>

      {/* Main Content (hidden when settings open) */}
      {!settingsOpen && (
        <>
          {/* Header - Fixed at top */}
          <Header
            inactiveCount={inactiveCount}
            totalMemoryMB={totalMemoryMB}
            onPrivacyToggle={handlePrivacyToggle}
            onThemeToggle={handleThemeToggle}
            onSnapToCorner={handleSnapToCorner}
            onCleanupToggle={handleCleanupToggle}
            onDuplicatesToggle={handleDuplicatesToggle}
            privacyMode={privacyMode}
            cleanupOpen={cleanupOpen}
            duplicatesOpen={duplicatesOpen}
          />

          {/* Scrollable Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {/* Cleanup Panel (S1-3) - Pro Feature */}
            <AnimatePresence>
              {cleanupOpen && (
                isPro ? (
                  <CleanupPanel
                    isOpen={cleanupOpen}
                    onClose={() => setCleanupOpen(false)}
                  />
                ) : (
                  <ProGate
                    featureName="Smart Cleanup"
                    description="One-click optimization to close duplicates, sleep idle tabs, and manage heavy memory users."
                    variant="overlay"
                    className="m-3"
                    onClose={() => setCleanupOpen(false)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Duplicates Panel (S1-5) - Pro Feature */}
            <AnimatePresence>
              {duplicatesOpen && (
                isPro ? (
                  <DuplicatesPanel
                    isOpen={duplicatesOpen}
                    onClose={() => setDuplicatesOpen(false)}
                  />
                ) : (
                  <ProGate
                    featureName="Smart Duplicate Detection"
                    description="Find and merge duplicate tabs with smart URL matching that ignores tracking parameters."
                    variant="overlay"
                    className="m-3"
                    onClose={() => setDuplicatesOpen(false)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Memory Dashboard (S2-3) - Pro Feature */}
            <AnimatePresence>
              {memoryOpen && (
                isPro ? (
                  <MemoryDashboard
                    isOpen={memoryOpen}
                    onClose={handleMemoryClose}
                  />
                ) : (
                  <ProGate
                    featureName="Memory Dashboard"
                    description="View detailed memory usage per tab with visual charts and optimization suggestions."
                    variant="overlay"
                    className="m-3"
                    onClose={() => setMemoryOpen(false)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Workspaces Panel (S3-1 + S4-1) - Pro Feature */}
            <AnimatePresence>
              {workspacesOpen && (
                isPro ? (
                  <WorkspacesPanel
                    isOpen={workspacesOpen}
                    onClose={handleWorkspacesClose}
                  />
                ) : (
                  <ProGate
                    featureName="Tab Workspaces"
                    description="Save and restore tab collections. Create named project workspaces with emoji and color."
                    variant="overlay"
                    className="m-3"
                    onClose={() => setWorkspacesOpen(false)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Time Machine Panel (S3-2) - Pro Feature */}
            <AnimatePresence>
              {timeMachineOpen && (
                isPro ? (
                  <TimeMachinePanel
                    isOpen={timeMachineOpen}
                    onClose={handleTimeMachineClose}
                  />
                ) : (
                  <ProGate
                    featureName="Time Machine"
                    description="Access your last 100 closed tabs with 30-day history, grouped by date."
                    variant="overlay"
                    className="m-3"
                    onClose={() => setTimeMachineOpen(false)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Search Bar */}
            <SearchBar
              value={state.search.query}
              onChange={actions.setSearchQuery}
            />

            {/* Sort Bar */}
            <SortBar
              sortMode={sortMode}
              sortAscending={sortAscending}
              onSortChange={handleSortChange}
            />

            {/* Tab List */}
            <TabList
              sortMode={sortMode}
              sortAscending={sortAscending}
              searchQuery={state.search.query}
              highlightedIndex={state.search.highlightedIndex}
              selectedTabIds={state.selectedTabIds}
              focusedTabId={state.focusedTabId}
              privacyMode={privacyMode}
              focusMode={focusMode}
              activeWindowId={activeWindowId}
            >
              {({ tabs: displayTabs, highlightedIndex, startIndex }) => (
                <>
                  {displayTabs.map((tab, idx) => {
                    // Check if this is the first tab in a duplicate group
                    const groupKey = isPro && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
                    const group = urlGroups.get(groupKey);
                    const isFirstDuplicate = group && group.length > 1 && group[0] === tab.id;

                    return (
                      <TabRow
                        key={tab.id}
                        tab={tab}
                        isHighlighted={highlightedIndex === idx}
                        isSelected={state.selectedTabIds.has(tab.id)}
                        privacyMode={privacyMode}
                        canDiscard={canDiscard}
                        isFirstDuplicate={isFirstDuplicate ?? false}
                        onSwitch={() => handleSwitchTab(tab.id, tab.windowId)}
                        onSleep={() => handleSleepTab(tab.id)}
                        onClose={() => handleCloseTab(tab.id)}
                        onPin={() => handlePinTab(tab.id, tab.pinned)}
                        onExpandDetails={() => handleExpandDetails(tab.id)}
                        searchQuery={state.search.query}
                        pinnedProtection={settings.pinnedProtection}
                      />
                    );
                  })}
                </>
              )}
            </TabList>

            {/* Detail Panel (S3-3 Quick Notes + S3-4 Reminders) */}
            <AnimatePresence>
              {detailTab && (
                <DetailPanel
                  tab={detailTab}
                  isOpen={detailTabId !== null}
                  totalMemoryMB={totalMemoryMB}
                  onClose={handleDetailClose}
                  onSwitch={() => handleSwitchTab(detailTab.id, detailTab.windowId)}
                />
              )}
            </AnimatePresence>

            {/* Recently Closed */}
            <RecentlyClosed
              entries={state.payload?.recentlyClosed ?? []}
              highlightedIndex={state.search.highlightedIndex - tabs.length}
              baseIndex={tabs.length}
              privacyMode={privacyMode}
              onRestore={handleRestoreTab}
            />
          </div>

          {/* Footer - Fixed at bottom */}
          <Footer
            onSettingsOpen={handleSettingsOpen}
            onMemoryOpen={handleMemoryOpen}
            onWorkspacesOpen={handleWorkspacesOpen}
            onTimeMachineOpen={handleTimeMachineOpen}
            workspacesOpen={workspacesOpen}
            timeMachineOpen={timeMachineOpen}
            memoryOpen={memoryOpen}
            isPro={isPro}
          />
        </>
      )}
    </Panel>
  );
}

// ============================================================================
// Root App
// ============================================================================

export function App({ initialPayload }: AppProps): JSX.Element {
  return (
    <PortalProvider>
      <TooltipProvider>
        <BTabProvider initialPayload={initialPayload}>
          <AppContent />
        </BTabProvider>
      </TooltipProvider>
    </PortalProvider>
  );
}

export default App;
