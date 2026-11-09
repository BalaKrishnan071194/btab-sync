/**
 * TimeMachinePanel Component Unit Tests - S3-2 (Tab Time Machine)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import { TimeMachinePanel } from '../../src/content/components/TimeMachinePanel';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

const mockHistoryEntries = [
  { id: 'h1', url: 'https://example.com/page1', title: 'Example Page 1', favIconUrl: '', closedAt: Date.now() - 1000 * 60 * 30 },
  { id: 'h2', url: 'https://google.com/search', title: 'Google Search', favIconUrl: '', closedAt: Date.now() - 1000 * 60 * 60 * 2 },
  { id: 'h3', url: 'https://github.com/repo', title: 'GitHub Repository', favIconUrl: '', closedAt: Date.now() - 1000 * 60 * 60 * 25 },
];

vi.mock('@/lib/db', () => ({
  getTabHistory: vi.fn(() => Promise.resolve(mockHistoryEntries)),
  searchTabHistory: vi.fn((query) => Promise.resolve(mockHistoryEntries.filter(e => e.title.toLowerCase().includes(query.toLowerCase())))),
  clearTabHistory: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn(() => Promise.resolve({ success: true })) },
    storage: { local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn() } },
    i18n: { getMessage: vi.fn((key) => key) },
    tabs: { create: vi.fn(() => Promise.resolve({ id: 1 })) },
  },
}));

function createMockTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return { id: Math.floor(Math.random() * 10000), windowId: 1, title: 'Test Tab',
    url: 'https://example.com', favIconUrl: '', active: false, audible: false,
    discarded: false, pinned: false, isStale: false, idleDurationMs: 0,
    idleLabel: '', estimatedMemoryMB: 50, isDuplicate: false, ...overrides };
}

function createMockPayload(isPro = true): TabPayload {
  return { tabs: [createMockTab()], recentlyClosed: [], inactiveCount: 0,
    totalBackgroundMemoryMB: 100, recoverableMemoryMB: 50, canDiscard: true, hasSessions: false, isPro };
}

function renderTimeMachinePanel(props: Partial<React.ComponentProps<typeof TimeMachinePanel>> = {}, payload?: TabPayload) {
  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload()}>
      <TimeMachinePanel isOpen={true} onClose={vi.fn()} {...props} />
    </BTabProvider>
  );
}

describe('TimeMachinePanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('Panel Visibility', () => {
    it('should render when isOpen is true', () => {
      renderTimeMachinePanel({ isOpen: true });
      expect(screen.getByText('Time Machine')).toBeInTheDocument();
    });
    it('should NOT render when isOpen is false', () => {
      renderTimeMachinePanel({ isOpen: false });
      expect(screen.queryByText('Time Machine')).not.toBeInTheDocument();
    });
  });

  describe('History Display', () => {
    it('should load and display history entries', async () => {
      renderTimeMachinePanel();
      await waitFor(() => { expect(screen.getByText('Example Page 1')).toBeInTheDocument(); });
    });
    it('should show entries from the first date group (expanded by default)', async () => {
      renderTimeMachinePanel();
      await waitFor(() => {
        // Today's entries (h1, h2) should be visible in the default expanded group
        expect(screen.getByText('Example Page 1')).toBeInTheDocument();
        expect(screen.getByText('Google Search')).toBeInTheDocument();
      });
    });
    it('should show entries from collapsed date groups after expanding', async () => {
      renderTimeMachinePanel();
      await waitFor(() => { expect(screen.getByText('Example Page 1')).toBeInTheDocument(); });
      
      // The "Yesterday" group header should be visible (showing entry count)
      const yesterdayHeader = screen.getByText('Yesterday');
      expect(yesterdayHeader).toBeInTheDocument();
      
      // Click to expand the Yesterday group
      fireEvent.click(yesterdayHeader);
      
      // Now GitHub Repository should be visible
      await waitFor(() => {
        expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
      });
    });
  });

  describe('Date Grouping', () => {
    it('should group entries by date', async () => {
      renderTimeMachinePanel();
      await waitFor(() => {
        const dateGroups = screen.getAllByText(/Today|Yesterday/i);
        expect(dateGroups.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality', () => {
    it('should have a search input', async () => {
      renderTimeMachinePanel();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Escape Key Handler', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderTimeMachinePanel({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no history exists', async () => {
      const { getTabHistory } = await import('@/lib/db');
      vi.mocked(getTabHistory).mockResolvedValueOnce([]);
      renderTimeMachinePanel();
      await waitFor(() => {
        // Component shows "No tab history" not "No closed tabs"
        expect(screen.getByText(/No tab history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pro Feature Check', () => {
    it('should render normally when isPro is true', () => {
      renderTimeMachinePanel({}, createMockPayload(true));
      expect(screen.getByText('Time Machine')).toBeInTheDocument();
    });
    it('should show Pro gate when isPro is false', () => {
      renderTimeMachinePanel({}, createMockPayload(false));
      expect(screen.getByText(/Pro feature/i)).toBeInTheDocument();
    });
  });
});
