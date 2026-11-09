/**
 * Header Component Unit Tests
 * 
 * Tests for S1-4 (Focus Mode badge and button),
 * S1-5 (Duplicate count badge), cleanup button, theme toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import Header from '../../src/content/components/Header';

// Mock ext from browsers
vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn() },
    storage: { local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn() } },
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

// Helper to render Header with BTabProvider
function renderHeader(
  props: Partial<React.ComponentProps<typeof Header>> = {},
  payload?: TabPayload
) {
  const defaultProps = {
    inactiveCount: 0,
    totalMemoryMB: 512,
    onPrivacyToggle: vi.fn(),
    onThemeToggle: vi.fn(),
    onSnapToCorner: vi.fn(),
    onCleanupToggle: vi.fn(),
    onDuplicatesToggle: vi.fn(),
    privacyMode: false,
    cleanupOpen: false,
    duplicatesOpen: false,
    ...props,
  };

  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload([createMockTab()])}>
      <Header {...defaultProps} />
    </BTabProvider>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand Logo', () => {
    it('should render bTab logo', () => {
      renderHeader();

      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('Tab')).toBeInTheDocument();
    });
  });

  describe('Tab Count Stats', () => {
    it('should show total tab count', () => {
      const tabs = [createMockTab(), createMockTab(), createMockTab()];
      renderHeader({}, createMockPayload(tabs));

      // Tab count should be visible (first stat badge)
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show inactive/idle count', () => {
      renderHeader({ inactiveCount: 5 });

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('Memory Display', () => {
    it('should format memory in MB when < 1024 MB', () => {
      renderHeader({ totalMemoryMB: 512 });

      expect(screen.getByText('512 MB')).toBeInTheDocument();
    });

    it('should format memory in GB when >= 1024 MB', () => {
      renderHeader({ totalMemoryMB: 2048 });

      expect(screen.getByText('2.00 GB')).toBeInTheDocument();
    });
  });

  describe('S1-3: Cleanup Button', () => {
    it('should render cleanup button', () => {
      renderHeader();

      expect(screen.getByTitle('Quick Cleanup')).toBeInTheDocument();
    });

    it('should call onCleanupToggle when cleanup button is clicked', () => {
      const onCleanupToggle = vi.fn();
      renderHeader({ onCleanupToggle });

      fireEvent.click(screen.getByTitle('Quick Cleanup'));
      expect(onCleanupToggle).toHaveBeenCalledTimes(1);
    });

    it('should show active state when cleanupOpen is true', () => {
      renderHeader({ cleanupOpen: true });

      const button = screen.getByTitle('Quick Cleanup');
      // Check for active state background color class
      expect(button).toHaveClass('bg-[rgba(29,217,180,0.12)]');
    });
  });

  describe('S1-4: Focus Mode', () => {
    it('should render focus mode button', () => {
      renderHeader();

      expect(screen.getByTitle(/Focus Mode/)).toBeInTheDocument();
    });

    it('should NOT show FOCUS badge when focus mode is disabled', () => {
      renderHeader();

      expect(screen.queryByText('FOCUS')).not.toBeInTheDocument();
    });

    // Note: Testing focus mode badge requires manipulating context state
    // which is more of an integration test. The badge visibility is
    // controlled by the context's focusMode state.
  });

  describe('S1-5: Duplicate Count Badge', () => {
    it('should render duplicates button', () => {
      renderHeader();

      expect(screen.getByTitle('Duplicate Tabs')).toBeInTheDocument();
    });

    it('should show duplicate count badge when there are duplicates', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example.com', isDuplicate: true }),
        createMockTab({ id: 2, url: 'https://example.com', isDuplicate: true }),
        createMockTab({ id: 3, url: 'https://other.com', isDuplicate: false }),
      ];
      renderHeader({}, createMockPayload(tabs));

      // Should show 1 (one tab to close, keep the other)
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should NOT show duplicate badge when no duplicates', () => {
      const tabs = [
        createMockTab({ id: 1, url: 'https://example1.com', isDuplicate: false }),
        createMockTab({ id: 2, url: 'https://example2.com', isDuplicate: false }),
      ];
      renderHeader({}, createMockPayload(tabs));

      // No badge with small numbers (badge only shows for duplicates)
      // The tab count stat shows "2" but that's different from duplicate badge
      const duplicatesButton = screen.getByTitle('Duplicate Tabs');
      // Badge should not be a child of the button container
      const badge = duplicatesButton.parentElement?.querySelector('span[class*="absolute"]');
      expect(badge).toBeNull();
    });

    it('should call onDuplicatesToggle when duplicates button is clicked', () => {
      const onDuplicatesToggle = vi.fn();
      renderHeader({ onDuplicatesToggle });

      fireEvent.click(screen.getByTitle('Duplicate Tabs'));
      expect(onDuplicatesToggle).toHaveBeenCalledTimes(1);
    });

    it('should show active state when duplicatesOpen is true', () => {
      renderHeader({ duplicatesOpen: true });

      const button = screen.getByTitle('Duplicate Tabs');
      // Check for active state background color class
      expect(button).toHaveClass('bg-[rgba(250,179,135,0.12)]');
    });
  });

  describe('Theme Toggle', () => {
    it('should render theme toggle button', () => {
      renderHeader();

      expect(screen.getByTitle(/Switch to/)).toBeInTheDocument();
    });

    it('should call onThemeToggle when clicked', () => {
      const onThemeToggle = vi.fn();
      renderHeader({ onThemeToggle });

      fireEvent.click(screen.getByTitle(/Switch to/));
      expect(onThemeToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Privacy Toggle', () => {
    it('should render privacy toggle button', () => {
      renderHeader();

      expect(screen.getByTitle(/privacy mode/)).toBeInTheDocument();
    });

    it('should call onPrivacyToggle when clicked', () => {
      const onPrivacyToggle = vi.fn();
      renderHeader({ onPrivacyToggle });

      fireEvent.click(screen.getByTitle(/privacy mode/));
      expect(onPrivacyToggle).toHaveBeenCalledTimes(1);
    });

    it('should show different title when privacyMode is true', () => {
      renderHeader({ privacyMode: true });

      expect(screen.getByTitle('Disable privacy mode')).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('should render close button', () => {
      renderHeader();

      expect(screen.getByTitle('Close (Esc)')).toBeInTheDocument();
    });
  });

  describe('Draggable Header', () => {
    it('should have cursor-grab class for dragging', () => {
      renderHeader();

      // Find the header container (first div with the flex classes)
      const header = screen.getByText('b').closest('div[class*="cursor-grab"]');
      expect(header).toBeInTheDocument();
    });
  });
});
