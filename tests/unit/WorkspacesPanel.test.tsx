/**
 * WorkspacesPanel Component Unit Tests - S3-1 + S4-1 (Workspaces)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BTabProvider, type TabPayload, type TabInfo } from '../../src/content/BTabContext';
import { WorkspacesPanel } from '../../src/content/components/WorkspacesPanel';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@/lib/db', () => ({
  getWorkspaces: vi.fn(() => Promise.resolve([])),
  saveWorkspace: vi.fn((data) => Promise.resolve({ id: 'ws-1', ...data, createdAt: Date.now(), updatedAt: Date.now() })),
  deleteWorkspace: vi.fn(() => Promise.resolve()),
  updateWorkspace: vi.fn((id, data) => Promise.resolve({ id, ...data })),
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

function createMockPayload(tabs: TabInfo[] = [], isPro = true): TabPayload {
  return { tabs, recentlyClosed: [], inactiveCount: 0, totalBackgroundMemoryMB: 100,
    recoverableMemoryMB: 50, canDiscard: true, hasSessions: false, isPro };
}

function renderWorkspacesPanel(props: Partial<React.ComponentProps<typeof WorkspacesPanel>> = {}, payload?: TabPayload) {
  return render(
    <BTabProvider initialPayload={payload ?? createMockPayload([createMockTab()])}>
      <WorkspacesPanel isOpen={true} onClose={vi.fn()} {...props} />
    </BTabProvider>
  );
}

describe('WorkspacesPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('Panel Visibility', () => {
    it('should render when isOpen is true', () => {
      renderWorkspacesPanel({ isOpen: true });
      expect(screen.getByText('Workspaces')).toBeInTheDocument();
    });
    it('should NOT render when isOpen is false', () => {
      renderWorkspacesPanel({ isOpen: false });
      expect(screen.queryByText('Workspaces')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no workspaces exist', async () => {
      renderWorkspacesPanel();
      await waitFor(() => {
        // Component shows "No saved workspaces" not "No workspaces yet"
        expect(screen.getByText(/No saved workspaces/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save Workspace', () => {
    it('should have a name input field', () => {
      renderWorkspacesPanel();
      const input = screen.getByPlaceholderText(/Workspace name/i);
      expect(input).toBeInTheDocument();
    });
    it('should have Save button with tab count', () => {
      renderWorkspacesPanel();
      // Button shows "Save (N)" where N is tab count
      expect(screen.getByText(/Save \(/)).toBeInTheDocument();
    });
  });

  describe('Project Mode (S4-1)', () => {
    it('should have Quick Save and New Project buttons', () => {
      renderWorkspacesPanel();
      expect(screen.getByText(/Quick Save/)).toBeInTheDocument();
      expect(screen.getByText(/New Project/)).toBeInTheDocument();
    });
    it('should have filter tabs for All, Quick, Projects', () => {
      renderWorkspacesPanel();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Quick')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
  });

  describe('Escape Key Handler', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderWorkspacesPanel({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pro Feature Check', () => {
    it('should render normally when isPro is true', () => {
      renderWorkspacesPanel({}, createMockPayload([createMockTab()], true));
      expect(screen.getByText('Workspaces')).toBeInTheDocument();
    });
    it('should show Pro gate when isPro is false', () => {
      renderWorkspacesPanel({}, createMockPayload([createMockTab()], false));
      expect(screen.getByText(/Pro feature/i)).toBeInTheDocument();
    });
  });
});
