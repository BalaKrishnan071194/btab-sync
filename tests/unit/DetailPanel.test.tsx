/**
 * DetailPanel Component Unit Tests - S3-3 (Quick Notes) + S3-4 (Tab Reminders)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import { DetailPanel } from '../../src/content/components/DetailPanel';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@/lib/db', () => ({
  getNoteByUrl: vi.fn(() => Promise.resolve(null)),
  saveNote: vi.fn((url, content) => Promise.resolve({ id: 'note-1', url, normalizedUrl: url, content, createdAt: Date.now(), updatedAt: Date.now() })),
  deleteNote: vi.fn(() => Promise.resolve()),
  createReminder: vi.fn(() => Promise.resolve({ id: 'rem-1', tabId: 1, url: 'https://example.com', title: 'Test', remindAt: Date.now() + 60000, createdAt: Date.now(), fired: false })),
}));

vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn(() => Promise.resolve({ success: true })) },
    storage: { local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn() } },
    i18n: { getMessage: vi.fn((key) => key) },
  },
}));

Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

function createMockTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return { id: 1, windowId: 1, title: 'Test Tab', url: 'https://example.com/test',
    favIconUrl: '', active: false, audible: false, discarded: false, pinned: false,
    isStale: false, idleDurationMs: 0, idleLabel: '', estimatedMemoryMB: 150, isDuplicate: false, ...overrides };
}

function createMockPayload(isPro = true): TabPayload {
  return { tabs: [createMockTab()], recentlyClosed: [], inactiveCount: 0,
    totalBackgroundMemoryMB: 500, recoverableMemoryMB: 200, canDiscard: true, hasSessions: false, isPro };
}

function renderDetailPanel(props: Partial<React.ComponentProps<typeof DetailPanel>> = {}, payload?: TabPayload) {
  const mockTab = createMockTab();
  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload()}>
      <DetailPanel tab={mockTab} isOpen={true} totalMemoryMB={500} onClose={vi.fn()} onSwitch={vi.fn()} {...props} />
    </BTabProvider>
  );
}

// Helper to find button by label text
function findButtonByLabel(labelText: string): HTMLButtonElement | null {
  const label = screen.queryByText(labelText);
  if (!label) return null;
  // Navigate up to find the button - the structure is: button > icon > ... and span label is sibling
  const container = label.closest('div');
  return container?.querySelector('button') ?? null;
}

describe('DetailPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('Panel Visibility', () => {
    it('should render when isOpen is true and tab is provided', () => {
      renderDetailPanel({ isOpen: true });
      expect(screen.getByText('150 MB')).toBeInTheDocument();
    });
    it('should NOT render when isOpen is false', () => {
      renderDetailPanel({ isOpen: false });
      expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
    });
    it('should NOT render when tab is null', () => {
      renderDetailPanel({ tab: null });
      expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
    });
  });

  describe('Memory Display', () => {
    it('should display tab memory in MB', () => {
      renderDetailPanel();
      expect(screen.getByText('150 MB')).toBeInTheDocument();
    });
    it('should display percentage of total memory', () => {
      renderDetailPanel();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
    it('should display total memory context', () => {
      renderDetailPanel();
      expect(screen.getByText(/500 MB total/)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render OPEN button', () => {
      renderDetailPanel();
      expect(screen.getByText('OPEN')).toBeInTheDocument();
    });
    it('should render COPY button', () => {
      renderDetailPanel();
      expect(screen.getByText('COPY')).toBeInTheDocument();
    });
    it('should render NOTE button', () => {
      renderDetailPanel();
      expect(screen.getByText('NOTE')).toBeInTheDocument();
    });
    it('should render REMIND button', () => {
      renderDetailPanel();
      expect(screen.getByText('REMIND')).toBeInTheDocument();
    });
  });

  describe('Open Button', () => {
    it('should call onSwitch when OPEN is clicked', () => {
      const onSwitch = vi.fn();
      renderDetailPanel({ onSwitch });
      const openButton = findButtonByLabel('OPEN');
      if (openButton) fireEvent.click(openButton);
      expect(onSwitch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy Button', () => {
    it('should copy URL to clipboard when clicked', async () => {
      renderDetailPanel();
      const copyButton = findButtonByLabel('COPY');
      if (copyButton) fireEvent.click(copyButton);
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test');
      });
    });
  });

  describe('Quick Notes (S3-3)', () => {
    it('should show note editor when NOTE is clicked (Pro)', async () => {
      renderDetailPanel({}, createMockPayload(true));
      const noteButton = findButtonByLabel('NOTE');
      if (noteButton) fireEvent.click(noteButton);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Add a note/i)).toBeInTheDocument();
      });
    });
    it('should have visible NOTE button when not Pro', () => {
      renderDetailPanel({}, createMockPayload(false));
      // The button is visible but styled as disabled (opacity)
      expect(screen.getByText('NOTE')).toBeInTheDocument();
    });
  });

  describe('Tab Reminders (S3-4)', () => {
    it('should show reminder picker when REMIND is clicked (Pro)', async () => {
      renderDetailPanel({}, createMockPayload(true));
      const remindButton = findButtonByLabel('REMIND');
      if (remindButton) fireEvent.click(remindButton);
      await waitFor(() => {
        expect(screen.getByText('15 min')).toBeInTheDocument();
      });
    });
    it('should show all reminder time options when Pro', async () => {
      renderDetailPanel({}, createMockPayload(true));
      const remindButton = findButtonByLabel('REMIND');
      if (remindButton) fireEvent.click(remindButton);
      await waitFor(() => {
        expect(screen.getByText('15 min')).toBeInTheDocument();
        expect(screen.getByText('30 min')).toBeInTheDocument();
        expect(screen.getByText('1 hour')).toBeInTheDocument();
        expect(screen.getByText('3 hours')).toBeInTheDocument();
        expect(screen.getByText('Tomorrow')).toBeInTheDocument();
      });
    });
    it('should have visible REMIND button when not Pro', () => {
      renderDetailPanel({}, createMockPayload(false));
      expect(screen.getByText('REMIND')).toBeInTheDocument();
    });
  });

  describe('Tab State Indicator', () => {
    it('should have border styling for active tab', () => {
      const activeTab = createMockTab({ active: true });
      renderDetailPanel({ tab: activeTab });
      const panel = document.querySelector('[class*="border-l"]');
      expect(panel).toBeInTheDocument();
    });
    it('should have border styling for stale tab', () => {
      const staleTab = createMockTab({ isStale: true });
      renderDetailPanel({ tab: staleTab });
      const panel = document.querySelector('[class*="border-l"]');
      expect(panel).toBeInTheDocument();
    });
    it('should have border styling for discarded tab', () => {
      const discardedTab = createMockTab({ discarded: true });
      renderDetailPanel({ tab: discardedTab });
      const panel = document.querySelector('[class*="border-l"]');
      expect(panel).toBeInTheDocument();
    });
  });

  describe('Pro Feature Gating', () => {
    it('should show all action buttons when not Pro', () => {
      renderDetailPanel({}, createMockPayload(false));
      // All buttons are visible (they're styled as disabled but present)
      expect(screen.getByText('OPEN')).toBeInTheDocument();
      expect(screen.getByText('COPY')).toBeInTheDocument();
      expect(screen.getByText('NOTE')).toBeInTheDocument();
      expect(screen.getByText('REMIND')).toBeInTheDocument();
    });
    it('should show all action buttons when Pro', () => {
      renderDetailPanel({}, createMockPayload(true));
      expect(screen.getByText('OPEN')).toBeInTheDocument();
      expect(screen.getByText('COPY')).toBeInTheDocument();
      expect(screen.getByText('NOTE')).toBeInTheDocument();
      expect(screen.getByText('REMIND')).toBeInTheDocument();
    });
  });

  describe('Existing Note Loading', () => {
    it('should load existing note when panel opens', async () => {
      const { getNoteByUrl } = await import('@/lib/db');
      vi.mocked(getNoteByUrl).mockResolvedValueOnce({
        id: 'note-1', url: 'https://example.com/test', normalizedUrl: 'https://example.com/test',
        content: 'Existing note content', createdAt: Date.now(), updatedAt: Date.now(),
      });
      renderDetailPanel({}, createMockPayload(true));
      await waitFor(() => {
        expect(getNoteByUrl).toHaveBeenCalledWith('https://example.com/test');
      });
    });
  });
});
