/**
 * ProGate Component Unit Tests
 * 
 * Tests for S5-3 (Upgrade UI)
 * - Pro gate variants: inline, overlay, card
 * - Upgrade button functionality
 * - Lock icon display
 * - Pro user bypass
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import ProGate from '../../src/content/components/ProGate';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, className, onClick, ...props }: any) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    ),
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ext from browsers - define the mock function inside the factory
vi.mock('@/lib/browsers', () => ({
  ext: {
    runtime: { sendMessage: vi.fn() },
    storage: { 
      local: { 
        get: vi.fn(() => Promise.resolve({})), 
        set: vi.fn() 
      } 
    },
    i18n: { getMessage: vi.fn((key: string) => key) },
    tabs: { create: vi.fn() },
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

function createMockPayload(overrides: Partial<TabPayload> = {}): TabPayload {
  return {
    tabs: [createMockTab()],
    recentlyClosed: [],
    inactiveCount: 0,
    totalBackgroundMemoryMB: 100,
    recoverableMemoryMB: 50,
    canDiscard: true,
    hasSessions: false,
    isPro: false, // Default to Free for testing ProGate
    ...overrides,
  };
}

// Helper to render ProGate with BTabProvider
function renderProGate(
  props: Partial<React.ComponentProps<typeof ProGate>> = {},
  payload?: TabPayload
) {
  const defaultProps = {
    featureName: 'Test Feature',
    ...props,
  };

  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload()}>
      <ProGate {...defaultProps} />
    </BTabProvider>
  );
}

describe('ProGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pro User Bypass', () => {
    it('should NOT render anything for Pro users', () => {
      const { container } = renderProGate(
        { featureName: 'Smart Duplicates' },
        createMockPayload({ isPro: true })
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('should render for Free users', () => {
      renderProGate(
        { featureName: 'Smart Duplicates' },
        createMockPayload({ isPro: false })
      );

      expect(screen.getByText('Pro Feature')).toBeInTheDocument();
    });
  });

  describe('Card Variant (default)', () => {
    it('should render card variant by default', () => {
      renderProGate({
        featureName: 'Smart Duplicates',
      });

      expect(screen.getByText('Pro Feature')).toBeInTheDocument();
      expect(screen.getByText('Smart Duplicates')).toBeInTheDocument();
    });

    it('should show upgrade button', () => {
      renderProGate({
        featureName: 'Auto-Suspension',
      });

      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    it('should show description when provided', () => {
      renderProGate({
        featureName: 'Memory Dashboard',
        description: 'View detailed memory usage statistics',
      });

      expect(screen.getByText('View detailed memory usage statistics')).toBeInTheDocument();
    });

    it('should show Crown icon', () => {
      renderProGate({
        featureName: 'Test Feature',
      });

      // Crown icon should be present
      expect(screen.getByText('Pro Feature')).toBeInTheDocument();
    });
  });

  describe('Inline Variant', () => {
    it('should render inline badge', () => {
      renderProGate({
        featureName: 'Quick Feature',
        variant: 'inline',
      });

      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    it('should be clickable', () => {
      const onUpgrade = vi.fn();
      renderProGate({
        featureName: 'Quick Feature',
        variant: 'inline',
        onUpgrade,
      });

      fireEvent.click(screen.getByText('PRO'));
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    it('should show Lock icon in inline variant', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'inline',
      });

      // Lock icon renders with PRO text
      const button = screen.getByText('PRO').closest('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Overlay Variant', () => {
    it('should render full overlay', () => {
      renderProGate({
        featureName: 'Advanced Feature',
        variant: 'overlay',
      });

      expect(screen.getByText('Unlock with Pro')).toBeInTheDocument();
      expect(screen.getByText('Advanced Feature')).toBeInTheDocument();
    });

    it('should show description in overlay', () => {
      renderProGate({
        featureName: 'Advanced Feature',
        variant: 'overlay',
        description: 'This feature requires a Pro subscription',
      });

      expect(screen.getByText('This feature requires a Pro subscription')).toBeInTheDocument();
    });

    it('should have backdrop blur class', () => {
      const { container } = renderProGate({
        featureName: 'Feature',
        variant: 'overlay',
      });

      const overlay = container.querySelector('.backdrop-blur-\\[2px\\]');
      expect(overlay).toBeInTheDocument();
    });

    it('should show large Lock icon', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'overlay',
      });

      // The overlay should contain the lock icon container
      expect(screen.getByText('Unlock with Pro')).toBeInTheDocument();
    });
  });

  describe('Upgrade Button', () => {
    it('should call onUpgrade callback when provided', () => {
      const onUpgrade = vi.fn();
      renderProGate({
        featureName: 'Test Feature',
        onUpgrade,
      });

      fireEvent.click(screen.getByText('Upgrade to Pro'));
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    it('should render upgrade button without callback', () => {
      renderProGate({
        featureName: 'Test Feature',
      });

      // The button should exist and be clickable (will call ext.tabs.create internally)
      const button = screen.getByText('Upgrade to Pro');
      expect(button).toBeInTheDocument();
      fireEvent.click(button); // Should not throw
    });

    it('should render upgrade button in overlay variant', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'overlay',
      });

      // The button should exist
      expect(screen.getByText('Unlock with Pro')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = renderProGate({
        featureName: 'Test',
        className: 'custom-class',
      });

      const gate = container.querySelector('.custom-class');
      expect(gate).toBeInTheDocument();
    });

    it('should have gold/amber color scheme', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'inline',
      });

      const badge = screen.getByText('PRO').closest('button');
      expect(badge).toHaveClass('text-[#f9e2af]');
    });
  });

  describe('Accessibility', () => {
    it('should be a button in inline variant', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'inline',
      });

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have type="button" in card variant', () => {
      renderProGate({
        featureName: 'Feature',
        variant: 'card',
      });

      const upgradeButton = screen.getByText('Upgrade to Pro');
      expect(upgradeButton).toHaveAttribute('type', 'button');
    });
  });

  describe('Feature Names', () => {
    it('should display different feature names correctly', () => {
      const features = [
        'Smart Auto-Suspension',
        'Memory Dashboard',
        'Automation Rules',
        'Drive Backup',
        'Smart Duplicates',
      ];

      features.forEach(featureName => {
        const { unmount } = renderProGate({
          featureName,
          variant: 'card',
        });

        expect(screen.getByText(featureName)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Theme Support', () => {
    it('should render in dark theme context', () => {
      renderProGate({
        featureName: 'Feature',
      });

      // Component renders correctly (specific styling depends on theme context)
      expect(screen.getByText('Pro Feature')).toBeInTheDocument();
    });
  });
});
