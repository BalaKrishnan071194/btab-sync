/**
 * TabRow Component Unit Tests
 * 
 * Tests for S1-1 (Pin Protection), S1-2 (Smart Search highlighting),
 * S3-3 (Notes indicator), S3-5 (Tab expiry indicator)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BTabProvider, type TabInfo } from '../../src/content/BTabContext';
import TabRow from '../../src/content/components/TabRow';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ext from browsers
vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn() },
    storage: { local: { get: vi.fn(), set: vi.fn() } },
    i18n: { getMessage: vi.fn((key) => key) },
  },
}));

// Helper to create mock tab data
function createMockTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    id: 1,
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

// Helper to render TabRow with BTabProvider
function renderTabRow(props: Partial<React.ComponentProps<typeof TabRow>> = {}) {
  const defaultProps = {
    tab: createMockTab(),
    isHighlighted: false,
    isSelected: false,
    privacyMode: false,
    canDiscard: true,
    isFirstDuplicate: false,
    onSwitch: vi.fn(),
    onSleep: vi.fn(),
    onClose: vi.fn(),
    onExpandDetails: vi.fn(),
    ...props,
  };

  return render(
    <BTabProvider>
      <TabRow {...defaultProps} />
    </BTabProvider>
  );
}

describe('TabRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('S1-1: Tab Pin Protection', () => {
    it('should render PIN status pill for pinned tabs', () => {
      renderTabRow({
        tab: createMockTab({ pinned: true }),
      });

      // Pinned tabs show a status pill with PIN label
      expect(screen.getByTitle('Pinned')).toBeInTheDocument();
      expect(screen.getByText('PIN')).toBeInTheDocument();
    });

    it('should NOT render close button for pinned tabs when pinnedProtection is enabled', () => {
      renderTabRow({
        tab: createMockTab({ pinned: true }),
        pinnedProtection: true,
      });

      // Close button should not exist
      expect(screen.queryByTitle('Close tab')).not.toBeInTheDocument();
      
      // Pin icon should exist instead
      expect(screen.getByTitle('Pinned tab (protected)')).toBeInTheDocument();
    });

    it('should render close button for pinned tabs when pinnedProtection is disabled', () => {
      renderTabRow({
        tab: createMockTab({ pinned: true }),
        pinnedProtection: false,
      });

      // Close button should exist
      expect(screen.getByTitle('Close tab')).toBeInTheDocument();
    });

    it('should render close button for unpinned tabs', () => {
      renderTabRow({
        tab: createMockTab({ pinned: false }),
      });

      expect(screen.getByTitle('Close tab')).toBeInTheDocument();
    });

    it('should still render sleep button for pinned tabs', () => {
      renderTabRow({
        tab: createMockTab({ pinned: true, discarded: false, active: false }),
        pinnedProtection: true,
      });

      expect(screen.getByTitle('Sleep tab (save memory)')).toBeInTheDocument();
    });
  });

  describe('S1-2: Smart Tab Search - Highlighting', () => {
    it('should highlight matching text in title when searchQuery is provided', () => {
      renderTabRow({
        tab: createMockTab({ title: 'GitHub - My Repository' }),
        searchQuery: 'github',
      });

      const mark = screen.getByText('GitHub');
      expect(mark.tagName).toBe('MARK');
      // Premium design uses 0.25 opacity background
      expect(mark).toHaveClass('bg-[rgba(29,217,180,0.25)]');
    });

    it('should NOT highlight when searchQuery is empty', () => {
      renderTabRow({
        tab: createMockTab({ title: 'GitHub - My Repository' }),
        searchQuery: '',
      });

      expect(screen.queryByRole('mark')).not.toBeInTheDocument();
    });

    it('should NOT highlight when searchQuery starts with / (command)', () => {
      renderTabRow({
        tab: createMockTab({ title: 'GitHub - My Repository' }),
        searchQuery: '/focus',
      });

      expect(screen.queryByRole('mark')).not.toBeInTheDocument();
    });

    it('should highlight first term of multi-word search', () => {
      renderTabRow({
        tab: createMockTab({ title: 'GitHub My Repository' }),
        searchQuery: 'github repo',
      });

      const mark = screen.getByText('GitHub');
      expect(mark.tagName).toBe('MARK');
    });

    it('should not highlight when term is not found in title', () => {
      renderTabRow({
        tab: createMockTab({ title: 'Example Page' }),
        searchQuery: 'xyz',
      });

      expect(screen.queryByRole('mark')).not.toBeInTheDocument();
    });
  });

  describe('Memory Badge', () => {
    it('should show green color for low memory (< 100 MB)', () => {
      renderTabRow({
        tab: createMockTab({ estimatedMemoryMB: 50 }),
      });

      const badge = screen.getByText('50');
      // Check the parent element has the color in inline style
      expect(badge.closest('span')).toHaveStyle({ color: '#22c55e' });
    });

    it('should show orange color for medium memory (100-299 MB)', () => {
      renderTabRow({
        tab: createMockTab({ estimatedMemoryMB: 150 }),
      });

      const badge = screen.getByText('150');
      expect(badge.closest('span')).toHaveStyle({ color: '#f97316' });
    });

    it('should show red color for high memory (>= 300 MB)', () => {
      renderTabRow({
        tab: createMockTab({ estimatedMemoryMB: 350 }),
      });

      const badge = screen.getByText('350');
      expect(badge.closest('span')).toHaveStyle({ color: '#ef4444' });
    });
  });

  describe('Status Badges', () => {
    it('should show frozen badge for discarded tabs', () => {
      renderTabRow({
        tab: createMockTab({ discarded: true }),
      });

      expect(screen.getByTitle('Frozen - Memory saved')).toBeInTheDocument();
      expect(screen.getByText('ZZZ')).toBeInTheDocument();
    });

    it('should show duplicate badge for duplicate tabs', () => {
      renderTabRow({
        tab: createMockTab({ isDuplicate: true, pinned: false, discarded: false }),
      });

      expect(screen.getByTitle('Duplicate tab')).toBeInTheDocument();
      expect(screen.getByText('DUP')).toBeInTheDocument();
    });

    it('should show idle badge for stale tabs', () => {
      renderTabRow({
        tab: createMockTab({ isStale: true, pinned: false, discarded: false, isDuplicate: false }),
      });

      expect(screen.getByTitle(/Idle/)).toBeInTheDocument();
    });

    it('should show active badge for active tabs', () => {
      renderTabRow({
        tab: createMockTab({ active: true }),
      });

      expect(screen.getByTitle('Active tab')).toBeInTheDocument();
      expect(screen.getByText('NOW')).toBeInTheDocument();
    });
  });

  describe('S3-3: Notes Indicator', () => {
    it('should show note icon when hasNote is true', () => {
      renderTabRow({
        hasNote: true,
      });

      expect(screen.getByTitle('Has note')).toBeInTheDocument();
    });

    it('should NOT show note icon when hasNote is false', () => {
      renderTabRow({
        hasNote: false,
      });

      expect(screen.queryByTitle('Has note')).not.toBeInTheDocument();
    });
  });

  describe('S3-5: Tab Expiry Indicator', () => {
    it('should show expired icon when isExpired is true', () => {
      renderTabRow({
        isExpired: true,
      });

      expect(screen.getByTitle('Expired - not visited in 7+ days')).toBeInTheDocument();
    });

    it('should NOT show expired icon when isExpired is false', () => {
      renderTabRow({
        isExpired: false,
      });

      expect(screen.queryByTitle('Expired - not visited in 7+ days')).not.toBeInTheDocument();
    });
  });

  describe('Privacy Mode', () => {
    it('should blur title when privacyMode is enabled', () => {
      renderTabRow({
        tab: createMockTab({ title: 'Secret Page' }),
        privacyMode: true,
      });

      const title = screen.getByText('Secret Page');
      expect(title).toHaveClass('blur-[5px]');
    });

    it('should blur URL when privacyMode is enabled', () => {
      renderTabRow({
        tab: createMockTab({ url: 'https://secret.com/path' }),
        privacyMode: true,
      });

      // In privacy mode, it shows just hostname
      const url = screen.getByText('secret.com');
      expect(url).toHaveClass('blur-[5px]');
    });
  });

  describe('Action Buttons', () => {
    it('should call onSleep when sleep button is clicked', async () => {
      const onSleep = vi.fn();
      renderTabRow({
        tab: createMockTab({ discarded: false, active: false }),
        onSleep,
      });

      // Hover to show buttons
      const row = screen.getByRole('option');
      fireEvent.mouseEnter(row);

      fireEvent.click(screen.getByTitle('Sleep tab (save memory)'));
      expect(onSleep).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      renderTabRow({
        tab: createMockTab({ pinned: false }),
        onClose,
      });

      // Hover to show buttons
      const row = screen.getByRole('option');
      fireEvent.mouseEnter(row);

      fireEvent.click(screen.getByTitle('Close tab'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onExpandDetails when row is clicked', () => {
      const onExpandDetails = vi.fn();
      renderTabRow({
        onExpandDetails,
      });

      fireEvent.click(screen.getByRole('option'));
      expect(onExpandDetails).toHaveBeenCalledTimes(1);
    });

    it('should call onSwitch when row is double-clicked', () => {
      const onSwitch = vi.fn();
      renderTabRow({
        onSwitch,
      });

      fireEvent.doubleClick(screen.getByRole('option'));
      expect(onSwitch).toHaveBeenCalledTimes(1);
    });

    it('should NOT render sleep button for active tabs', () => {
      renderTabRow({
        tab: createMockTab({ active: true }),
      });

      expect(screen.queryByTitle('Sleep tab (save memory)')).not.toBeInTheDocument();
    });

    it('should NOT render sleep button for already discarded tabs', () => {
      renderTabRow({
        tab: createMockTab({ discarded: true }),
      });

      expect(screen.queryByTitle('Sleep tab (save memory)')).not.toBeInTheDocument();
    });
  });

  describe('Duplicate Merge Button', () => {
    it('should render merge button when tab is duplicate and isFirstDuplicate', () => {
      const onMergeDuplicates = vi.fn();
      renderTabRow({
        tab: createMockTab({ isDuplicate: true }),
        isFirstDuplicate: true,
        onMergeDuplicates,
      });

      // Hover to show buttons
      const row = screen.getByRole('option');
      fireEvent.mouseEnter(row);

      expect(screen.getByTitle('Merge duplicates')).toBeInTheDocument();
    });

    it('should NOT render merge button when tab is not isFirstDuplicate', () => {
      renderTabRow({
        tab: createMockTab({ isDuplicate: true }),
        isFirstDuplicate: false,
        onMergeDuplicates: vi.fn(),
      });

      expect(screen.queryByTitle('Merge duplicates')).not.toBeInTheDocument();
    });

    it('should call onMergeDuplicates when merge button is clicked', () => {
      const onMergeDuplicates = vi.fn();
      renderTabRow({
        tab: createMockTab({ isDuplicate: true }),
        isFirstDuplicate: true,
        onMergeDuplicates,
      });

      // Hover to show buttons
      const row = screen.getByRole('option');
      fireEvent.mouseEnter(row);

      fireEvent.click(screen.getByTitle('Merge duplicates'));
      expect(onMergeDuplicates).toHaveBeenCalledTimes(1);
    });
  });

  describe('Highlighting State', () => {
    it('should apply highlighted styles when isHighlighted is true', () => {
      renderTabRow({
        isHighlighted: true,
      });

      const row = screen.getByRole('option');
      // Premium design uses background color and border for highlighting
      expect(row).toHaveClass('bg-[rgba(29,217,180,0.08)]');
      expect(row).toHaveClass('border-[rgba(29,217,180,0.2)]');
    });

    it('should set aria-selected when isSelected is true', () => {
      renderTabRow({
        isSelected: true,
      });

      const row = screen.getByRole('option');
      expect(row).toHaveAttribute('aria-selected', 'true');
    });
  });
});
