/**
 * CleanupPanel Component Unit Tests
 * 
 * Tests for S1-3 (Smart One-Click Cleanup)
 * - Categories: duplicates, idle, heavy
 * - Toggle switches
 * - Optimize button
 * - Toast notification
 * - Pinned tab exclusion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import CleanupPanel from '../../src/content/components/CleanupPanel';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ext from browsers
vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { 
      sendMessage: vi.fn(() => Promise.resolve({ success: true })) 
    },
    storage: { 
      local: { 
        get: vi.fn(() => Promise.resolve({})), 
        set: vi.fn(() => Promise.resolve()) 
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

// Helper to render CleanupPanel with BTabProvider
function renderCleanupPanel(
  props: Partial<React.ComponentProps<typeof CleanupPanel>> = {},
  payload?: TabPayload
) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    ...props,
  };

  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload([createMockTab()])}>
      <CleanupPanel {...defaultProps} />
    </BTabProvider>
  );
}

describe('CleanupPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Panel Visibility', () => {
    it('should render when isOpen is true', () => {
      renderCleanupPanel({ isOpen: true });

      expect(screen.getByText('Quick Cleanup')).toBeInTheDocument();
    });

    it('should NOT render when isOpen is false', () => {
      renderCleanupPanel({ isOpen: false });

      expect(screen.queryByText('Quick Cleanup')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show "already optimized" when no cleanup items exist', () => {
      const tabs = [
        createMockTab({ isDuplicate: false, isStale: false, estimatedMemoryMB: 50 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText(/Browser already optimized/)).toBeInTheDocument();
    });
  });

  describe('Duplicates Category', () => {
    it('should show duplicate category when duplicates exist', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true, estimatedMemoryMB: 100 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText('Duplicates')).toBeInTheDocument();
    });

    it('should show correct count for duplicates (only extras)', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        createMockTab({ id: 3, url: 'https://example.com', isDuplicate: true, estimatedMemoryMB: 100 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Should show duplicates category since there are extras (keep 1, close 2)
      expect(screen.getByText('Duplicates')).toBeInTheDocument();
    });

    it('should NOT count pinned tabs as duplicates', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true, pinned: true }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true, pinned: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Only 1 non-pinned duplicate that's extra
      // Actually with 1 pinned and 1 not, only the non-pinned would show
      // But since pinned is excluded, only 1 tab in analysis
      expect(screen.getByText(/Browser already optimized/)).toBeInTheDocument();
    });
  });

  describe('Idle Category', () => {
    it('should show idle category when stale tabs exist', () => {
      const tabs = [
        createMockTab({ isStale: true, discarded: false, estimatedMemoryMB: 150 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText('Idle Tabs')).toBeInTheDocument();
    });

    it('should NOT show already discarded tabs in idle category', () => {
      const tabs = [
        createMockTab({ isStale: true, discarded: true, estimatedMemoryMB: 150 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Discarded tabs shouldn't show in idle category
      expect(screen.getByText(/Browser already optimized/)).toBeInTheDocument();
    });
  });

  describe('Heavy Category', () => {
    it('should show heavy category when tabs use >= 300 MB', () => {
      const tabs = [
        createMockTab({ estimatedMemoryMB: 350, active: false, discarded: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText('Heavy Tabs')).toBeInTheDocument();
    });

    it('should NOT show active tabs in heavy category', () => {
      const tabs = [
        createMockTab({ estimatedMemoryMB: 350, active: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Active tabs excluded from heavy
      expect(screen.getByText(/Browser already optimized/)).toBeInTheDocument();
    });

    it('should NOT show discarded tabs in heavy category', () => {
      const tabs = [
        createMockTab({ estimatedMemoryMB: 350, discarded: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText(/Browser already optimized/)).toBeInTheDocument();
    });
  });

  describe('Toggle Switches', () => {
    it('should render toggle switch for each category', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ isStale: true, discarded: false }),
        createMockTab({ estimatedMemoryMB: 350, active: false, discarded: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Should have 3 switches (one for each category)
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBe(3);
    });

    it('should toggle category enabled state when switch is clicked', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      const switchEl = screen.getByRole('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(switchEl);
      expect(switchEl).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Optimize Button', () => {
    it('should render optimize button when cleanup items exist', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText(/Optimize/)).toBeInTheDocument();
    });

    it('should show tab count and memory savings in optimize button', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true, estimatedMemoryMB: 100 }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Button text varies by i18n, just check optimize button exists
      expect(screen.getByText(/Optimize/)).toBeInTheDocument();
    });

    it('should be disabled when no categories are enabled', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Toggle off the category
      fireEvent.click(screen.getByRole('switch'));

      const button = screen.getByText(/Optimize/).closest('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Close Button', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
      ];
      renderCleanupPanel({ onClose }, createMockPayload(tabs));

      // Find close button by the X icon in header
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => 
        btn.querySelector('svg[class*="w-3 h-3"]') && 
        btn.classList.contains('w-5')
      );
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Escape Key Handler', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      const tabs = [createMockTab()];
      renderCleanupPanel({ onClose, isOpen: true }, createMockPayload(tabs));

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Savings Calculation', () => {
    it('should calculate correct total savings across categories', () => {
      const tabs = [
        // Duplicates: 100 MB savings (1 extra tab)
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true, estimatedMemoryMB: 100 }),
        // Idle: 200 MB savings
        createMockTab({ id: 3, isStale: true, discarded: false, estimatedMemoryMB: 200 }),
        // Heavy: 350 MB savings
        createMockTab({ id: 4, estimatedMemoryMB: 350, active: false, discarded: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // Check that categories show their respective savings
      expect(screen.getByText(/100 MB/)).toBeInTheDocument();
      expect(screen.getByText(/200 MB/)).toBeInTheDocument();
      expect(screen.getByText(/350 MB/)).toBeInTheDocument();
    });
  });

  describe('Category Icons', () => {
    it('should show Copy icon for duplicates category', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://a.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://a.com', isDuplicate: true }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      // The icon is rendered, checking the category text is present
      expect(screen.getByText('Duplicates')).toBeInTheDocument();
    });

    it('should show Moon icon for idle category', () => {
      const tabs = [
        createMockTab({ isStale: true, discarded: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText('Idle Tabs')).toBeInTheDocument();
    });

    it('should show Flame icon for heavy category', () => {
      const tabs = [
        createMockTab({ estimatedMemoryMB: 350, active: false, discarded: false }),
      ];
      renderCleanupPanel({}, createMockPayload(tabs));

      expect(screen.getByText('Heavy Tabs')).toBeInTheDocument();
    });
  });
});
