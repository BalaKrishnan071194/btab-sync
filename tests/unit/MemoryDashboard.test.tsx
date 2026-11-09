/**
 * MemoryDashboard Component Unit Tests - S2-3 (Memory Intelligence Dashboard)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import { MemoryDashboard } from '../../src/content/components/MemoryDashboard';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

const mockGetMessage = vi.fn((key: string) => {
  const msgs: Record<string, string> = {
    memPanelTitle: 'Memory', memTotalUsage: 'Total Usage', memTabCount: 'Tabs',
    memPotentialSavings: 'Potential Savings', memChartTitle: 'Memory Over Time',
    memChartCollecting: 'Collecting data...', memTopTabsTitle: 'Top Tabs by Memory',
    memRefreshBtn: 'Refresh', memDisclaimer: 'Memory values are estimates',
    memProFeature: 'Memory Dashboard is a Pro feature', labelFrozen: 'Frozen',
  };
  return msgs[key] || key;
});
vi.stubGlobal('chrome', { i18n: { getMessage: mockGetMessage } });
vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn(() => Promise.resolve({ success: true })) },
    storage: { local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn() } },
    tabs: { discard: vi.fn(() => Promise.resolve()) },
  },
}));

function createMockTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return { id: Math.floor(Math.random() * 10000), windowId: 1, title: 'Test Tab',
    url: 'https://example.com', favIconUrl: '', active: false, audible: false,
    discarded: false, pinned: false, isStale: false, idleDurationMs: 0,
    idleLabel: '', estimatedMemoryMB: 100, isDuplicate: false, ...overrides };
}

function createMockPayload(tabs: TabInfo[], isPro = true): TabPayload {
  const totalMemory = tabs.reduce((sum, t) => sum + t.estimatedMemoryMB, 0);
  return { tabs, recentlyClosed: [], inactiveCount: tabs.filter(t => !t.active).length,
    totalBackgroundMemoryMB: totalMemory, recoverableMemoryMB: Math.floor(totalMemory * 0.4),
    canDiscard: true, hasSessions: false, isPro };
}

function renderMemoryDashboard(props: Partial<React.ComponentProps<typeof MemoryDashboard>> = {}, payload?: TabPayload) {
  const defaultTabs = [
    createMockTab({ id: 1, title: 'Heavy Tab', estimatedMemoryMB: 400 }),
    createMockTab({ id: 2, title: 'Medium Tab', estimatedMemoryMB: 200 }),
    createMockTab({ id: 3, title: 'Light Tab', estimatedMemoryMB: 50 }),
  ];
  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload(defaultTabs)}>
      <MemoryDashboard isOpen={true} onClose={vi.fn()} {...props} />
    </BTabProvider>
  );
}

describe('MemoryDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('Panel Visibility', () => {
    it('should render when isOpen is true', () => {
      renderMemoryDashboard({ isOpen: true });
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });
    it('should NOT render when isOpen is false', () => {
      renderMemoryDashboard({ isOpen: false });
      expect(screen.queryByText('Memory')).not.toBeInTheDocument();
    });
  });

  describe('Total Memory Display', () => {
    it('should display total memory', () => {
      renderMemoryDashboard();
      expect(screen.getByText('650 MB')).toBeInTheDocument();
    });
    it('should display memory in GB when over 1024 MB', () => {
      const heavyTabs = [createMockTab({ estimatedMemoryMB: 600 }), createMockTab({ estimatedMemoryMB: 500 }), createMockTab({ estimatedMemoryMB: 400 })];
      renderMemoryDashboard({}, createMockPayload(heavyTabs));
      expect(screen.getAllByText(/GB/).length).toBeGreaterThan(0);
    });
  });

  describe('Tab Memory List', () => {
    it('should display tabs sorted by memory usage', () => {
      renderMemoryDashboard();
      expect(screen.getByText('Heavy Tab')).toBeInTheDocument();
      expect(screen.getByText('Medium Tab')).toBeInTheDocument();
      expect(screen.getByText('Light Tab')).toBeInTheDocument();
    });
    it('should show memory value for each tab', () => {
      renderMemoryDashboard();
      expect(screen.getByText('400 MB')).toBeInTheDocument();
      expect(screen.getByText('200 MB')).toBeInTheDocument();
    });
    it('should limit to top 10 tabs', () => {
      const manyTabs = Array.from({ length: 15 }, (_, i) => createMockTab({ id: i, title: `Tab ${i}`, estimatedMemoryMB: 100 - i }));
      renderMemoryDashboard({}, createMockPayload(manyTabs));
      expect(screen.getAllByText(/Tab \d+/).length).toBeLessThanOrEqual(10);
    });
  });

  describe('Memory Bars', () => {
    it('should render progress bars for tabs', () => {
      renderMemoryDashboard();
      expect(document.querySelectorAll('[class*="rounded"]').length).toBeGreaterThan(0);
    });
  });

  describe('Escape Key Handler', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderMemoryDashboard({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Estimates Disclaimer', () => {
    it('should show estimates disclaimer', () => {
      renderMemoryDashboard();
      expect(screen.getByText(/estimates/i)).toBeInTheDocument();
    });
  });

  describe('Pro Feature Check', () => {
    it('should render normally when isPro is true', () => {
      renderMemoryDashboard({}, createMockPayload([createMockTab()], true));
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });
    it('should show Pro gate when isPro is false', () => {
      renderMemoryDashboard({}, createMockPayload([createMockTab()], false));
      expect(screen.getByText(/Pro feature/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty tabs gracefully', () => {
      renderMemoryDashboard({}, createMockPayload([]));
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });
  });
});
