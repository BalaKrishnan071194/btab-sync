/**
 * BTabContext Unit Tests
 * 
 * Tests for the React Context that powers all bTab functionality
 * - S1-2: Smart search with multi-word AND matching
 * - S1-4: Focus Mode state management
 * - S1-5: Close duplicates with smart URL matching
 * - Pro status management
 * - Tab operations (close, sleep, switch)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { 
  BTabProvider, 
  useBTab, 
  useTabs, 
  useSettings, 
  useIsPro, 
  useFocusMode,
  useSearch,
  type TabPayload, 
  type TabInfo 
} from '../../src/content/BTabContext';

// Mock ext from browsers
const mockSendMessage = vi.fn();
const mockStorageGet = vi.fn(() => Promise.resolve({}));
const mockStorageSet = vi.fn(() => Promise.resolve());

vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { 
      sendMessage: (...args: any[]) => mockSendMessage(...args)
    },
    storage: { 
      local: { 
        get: (...args: any[]) => mockStorageGet(...args), 
        set: (...args: any[]) => mockStorageSet(...args) 
      } 
    },
    i18n: { getMessage: vi.fn((key) => key) },
  },
}));

// Helper to create mock tab data
function createMockTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    id: Math.floor(Math.random() * 10000),
    windowId: 1,
    title: 'Test Tab',
    url: 'https://example.com',
    favIconUrl: '',
    active: false,
    audible: false,
    discarded: false,
    pinned: false,
    isStale: false,
    idleDurationMs: 0,
    idleLabel: '',
    estimatedMemoryMB: 50,
    isDuplicate: false,
    ...overrides,
  };
}

function createMockPayload(tabs: TabInfo[] = [], overrides: Partial<TabPayload> = {}): TabPayload {
  return {
    tabs,
    recentlyClosed: [],
    inactiveCount: 0,
    totalBackgroundMemoryMB: 100,
    recoverableMemoryMB: 50,
    canDiscard: true,
    hasSessions: false,
    isPro: true,
    ...overrides,
  };
}

// Test wrapper component
function TestComponent({ onRender }: { onRender?: (ctx: ReturnType<typeof useBTab>) => void }) {
  const ctx = useBTab();
  onRender?.(ctx);
  return <div data-testid="test">{ctx.state.payload?.tabs?.length ?? 0} tabs</div>;
}

describe('BTabContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true });
    mockStorageGet.mockResolvedValue({});
  });

  describe('BTabProvider', () => {
    it('should provide initial payload when given', () => {
      const tabs = [createMockTab(), createMockTab()];
      const payload = createMockPayload(tabs);

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent />
        </BTabProvider>
      );

      expect(screen.getByTestId('test')).toHaveTextContent('2 tabs');
    });

    it('should start with hidden visibility when no payload', () => {
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      expect(capturedCtx?.state.visibility).toBe('hidden');
    });

    it('should start with visible visibility when payload provided', () => {
      let capturedCtx: ReturnType<typeof useBTab> | null = null;
      const payload = createMockPayload([createMockTab()]);

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      expect(capturedCtx?.state.visibility).toBe('visible');
    });
  });

  describe('useBTab Hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useBTab must be used within a BTabProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('S1-2: Smart Search', () => {
    it('should filter tabs with single search term', async () => {
      const tabs = [
        createMockTab({ id: 1, title: 'GitHub Repository', url: 'https://github.com' }),
        createMockTab({ id: 2, title: 'Google Docs', url: 'https://docs.google.com' }),
        createMockTab({ id: 3, title: 'Gmail', url: 'https://gmail.com' }),
      ];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setSearchQuery('github');
      });

      expect(capturedCtx?.state.search.filteredTabIds).toEqual([1]);
    });

    it('should filter tabs with multi-word AND search', async () => {
      const tabs = [
        createMockTab({ id: 1, title: 'GitHub Repository', url: 'https://github.com/myrepo' }),
        createMockTab({ id: 2, title: 'GitHub Documentation', url: 'https://docs.github.com' }),
        createMockTab({ id: 3, title: 'GitLab Repository', url: 'https://gitlab.com' }),
      ];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setSearchQuery('github repo');
      });

      // Should match only tab 1 (has both "github" and "repo")
      expect(capturedCtx?.state.search.filteredTabIds).toEqual([1]);
    });

    it('should match against both title and URL', async () => {
      const tabs = [
        createMockTab({ id: 1, title: 'My Page', url: 'https://example.com/special-path' }),
        createMockTab({ id: 2, title: 'Other Page', url: 'https://other.com' }),
      ];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setSearchQuery('special');
      });

      expect(capturedCtx?.state.search.filteredTabIds).toEqual([1]);
    });

    it('should reset highlighted index when search changes', async () => {
      const tabs = [createMockTab(), createMockTab(), createMockTab()];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      // Move highlight
      await act(async () => {
        capturedCtx?.actions.moveHighlight(2);
      });
      expect(capturedCtx?.state.search.highlightedIndex).toBe(2);

      // Search should reset
      await act(async () => {
        capturedCtx?.actions.setSearchQuery('test');
      });
      expect(capturedCtx?.state.search.highlightedIndex).toBe(0);
    });

    it('should clear filtered IDs when search is empty', async () => {
      const tabs = [createMockTab({ title: 'Test' })];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setSearchQuery('test');
      });
      expect(capturedCtx?.state.search.filteredTabIds.length).toBeGreaterThan(0);

      await act(async () => {
        capturedCtx?.actions.setSearchQuery('');
      });
      expect(capturedCtx?.state.search.filteredTabIds).toEqual([]);
    });
  });

  describe('S1-4: Focus Mode', () => {
    it('should toggle focus mode', async () => {
      const payload = createMockPayload([createMockTab()]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      expect(capturedCtx?.state.focusMode).toBe(false);

      await act(async () => {
        capturedCtx?.actions.toggleFocusMode();
      });

      expect(capturedCtx?.state.focusMode).toBe(true);

      await act(async () => {
        capturedCtx?.actions.toggleFocusMode();
      });

      expect(capturedCtx?.state.focusMode).toBe(false);
    });

    it('should set focus mode directly', async () => {
      const payload = createMockPayload([createMockTab()]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setFocusMode(true);
      });

      expect(capturedCtx?.state.focusMode).toBe(true);
    });

    it('should reset focus mode when panel is hidden', async () => {
      const payload = createMockPayload([createMockTab()]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.setFocusMode(true);
      });
      expect(capturedCtx?.state.focusMode).toBe(true);

      await act(async () => {
        capturedCtx?.actions.hide();
      });

      // Wait for visibility transition
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(capturedCtx?.state.focusMode).toBe(false);
    });
  });

  describe('S1-5: Close Duplicates', () => {
    it('should close duplicate tabs keeping most recently active', async () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true, idleDurationMs: 1000, active: false }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true, idleDurationMs: 100, active: false }), // Most recent
        createMockTab({ id: 3, url: 'https://example.com', isDuplicate: true, idleDurationMs: 500, active: false }),
      ];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      mockSendMessage.mockResolvedValue({ success: true });

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      let closedCount = 0;
      await act(async () => {
        closedCount = await capturedCtx?.actions.closeDuplicates() ?? 0;
      });

      // Should close 2 tabs (keep 1 most recent)
      expect(closedCount).toBe(2);
    });

    it('should use smartDupUrl for Pro users', async () => {
      const tabs = [
        createMockTab({ 
          id: 1, 
          url: 'https://example.com', 
          smartDupUrl: 'https://example.com',
          isDuplicate: true, 
          idleDurationMs: 100,
          active: false 
        }),
        createMockTab({ 
          id: 2, 
          url: 'https://example.com?utm_source=google', 
          smartDupUrl: 'https://example.com',
          isDuplicate: true, 
          idleDurationMs: 200,
          active: false 
        }),
      ];
      const payload = createMockPayload(tabs, { isPro: true });
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      mockSendMessage.mockResolvedValue({ success: true });

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      let closedCount = 0;
      await act(async () => {
        closedCount = await capturedCtx?.actions.closeDuplicates() ?? 0;
      });

      // Should close 1 (they're grouped by smartDupUrl for Pro)
      expect(closedCount).toBe(1);
    });

    it('should NOT close pinned tabs when protection is enabled', async () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true, pinned: true, active: false }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true, pinned: false, active: false }),
      ];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      mockSendMessage.mockResolvedValue({ success: true });

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      // Ensure pinned protection is enabled (default)
      expect(capturedCtx?.state.settings.pinnedProtection).toBe(true);

      let closedCount = 0;
      await act(async () => {
        closedCount = await capturedCtx?.actions.closeDuplicates() ?? 0;
      });

      // With protection on, pinned tab is protected - only 1 in group is closable
      // Since we keep the most recent (lowest idleDurationMs), we close the other
      expect(closedCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Convenience Hooks', () => {
    it('useTabs should return tabs array', () => {
      const tabs = [createMockTab(), createMockTab()];
      const payload = createMockPayload(tabs);

      const { result } = renderHook(() => useTabs(), {
        wrapper: ({ children }) => (
          <BTabProvider initialPayload={payload}>{children}</BTabProvider>
        ),
      });

      expect(result.current).toHaveLength(2);
    });

    it('useSettings should return settings object', () => {
      const payload = createMockPayload([createMockTab()]);

      const { result } = renderHook(() => useSettings(), {
        wrapper: ({ children }) => (
          <BTabProvider initialPayload={payload}>{children}</BTabProvider>
        ),
      });

      expect(result.current.theme).toBe('system');
      expect(result.current.pinnedProtection).toBe(true);
    });

    it('useIsPro should return Pro status', () => {
      const payload = createMockPayload([createMockTab()], { isPro: true });

      const { result } = renderHook(() => useIsPro(), {
        wrapper: ({ children }) => (
          <BTabProvider initialPayload={payload}>{children}</BTabProvider>
        ),
      });

      expect(result.current).toBe(true);
    });

    it('useFocusMode should return focus mode state', () => {
      const payload = createMockPayload([createMockTab()]);

      const { result } = renderHook(() => useFocusMode(), {
        wrapper: ({ children }) => (
          <BTabProvider initialPayload={payload}>{children}</BTabProvider>
        ),
      });

      expect(result.current.focusMode).toBe(false);
      expect(result.current.activeWindowId).toBe(null);
    });

    it('useSearch should return search state', () => {
      const payload = createMockPayload([createMockTab()]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: ({ children }) => (
          <BTabProvider initialPayload={payload}>{children}</BTabProvider>
        ),
      });

      expect(result.current.query).toBe('');
      expect(result.current.highlightedIndex).toBe(0);
      expect(result.current.filteredTabIds).toEqual([]);
    });
  });

  describe('Tab Operations', () => {
    it('should close tab via actions.closeTab', async () => {
      const tabs = [createMockTab({ id: 123 })];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      mockSendMessage.mockResolvedValue({ success: true });

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      let success = false;
      await act(async () => {
        success = await capturedCtx?.actions.closeTab(123) ?? false;
      });

      expect(success).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: 'closeTab',
        tabId: 123,
      });
    });

    it('should sleep tab via actions.sleepTab', async () => {
      const tabs = [createMockTab({ id: 456 })];
      const payload = createMockPayload(tabs);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      mockSendMessage.mockResolvedValue({ success: true });

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      let success = false;
      await act(async () => {
        success = await capturedCtx?.actions.sleepTab(456) ?? false;
      });

      expect(success).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: 'sleepTab',
        tabId: 456,
      });
    });
  });

  describe('Selection', () => {
    it('should select and deselect tabs', async () => {
      const payload = createMockPayload([createMockTab({ id: 1 }), createMockTab({ id: 2 })]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.selectTab(1);
      });
      expect(capturedCtx?.state.selectedTabIds.has(1)).toBe(true);

      await act(async () => {
        capturedCtx?.actions.deselectTab(1);
      });
      expect(capturedCtx?.state.selectedTabIds.has(1)).toBe(false);
    });

    it('should toggle tab selection', async () => {
      const payload = createMockPayload([createMockTab({ id: 1 })]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.toggleTabSelection(1);
      });
      expect(capturedCtx?.state.selectedTabIds.has(1)).toBe(true);

      await act(async () => {
        capturedCtx?.actions.toggleTabSelection(1);
      });
      expect(capturedCtx?.state.selectedTabIds.has(1)).toBe(false);
    });

    it('should clear selection', async () => {
      const payload = createMockPayload([createMockTab({ id: 1 }), createMockTab({ id: 2 })]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        capturedCtx?.actions.selectTab(1);
        capturedCtx?.actions.selectTab(2);
      });
      expect(capturedCtx?.state.selectedTabIds.size).toBe(2);

      await act(async () => {
        capturedCtx?.actions.clearSelection();
      });
      expect(capturedCtx?.state.selectedTabIds.size).toBe(0);
    });
  });

  describe('Settings', () => {
    it('should update settings', async () => {
      const payload = createMockPayload([createMockTab()]);
      let capturedCtx: ReturnType<typeof useBTab> | null = null;

      render(
        <BTabProvider initialPayload={payload}>
          <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
        </BTabProvider>
      );

      await act(async () => {
        await capturedCtx?.actions.updateSettings({ theme: 'dark' });
      });

      expect(capturedCtx?.state.settings.theme).toBe('dark');
      expect(mockStorageSet).toHaveBeenCalled();
    });
  });
});
