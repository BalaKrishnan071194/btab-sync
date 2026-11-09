/**
 * Header Component
 *
 * Displays logo, tab count badge, memory stats, and control buttons.
 * Supports dragging the panel via the header.
 * S1-4: Focus Mode badge when enabled.
 * S1-5: Duplicate count badge and panel toggle.
 */

import { memo, useMemo } from 'react';
import { Moon, Sun, Eye, EyeOff, Pin, X, Focus, Trash2, Copy, Crown } from 'lucide-react';
import { useBTab, useTabs, useSettings, useFocusMode, useIsPro, isDarkTheme } from '../BTabContext';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface HeaderProps {
  readonly inactiveCount: number;
  readonly totalMemoryMB: number;
  readonly onPrivacyToggle: () => void;
  readonly onThemeToggle: () => void;
  readonly onSnapToCorner: () => void;
  readonly onCleanupToggle: () => void;
  readonly onDuplicatesToggle: () => void;
  readonly privacyMode: boolean;
  readonly cleanupOpen: boolean;
  readonly duplicatesOpen: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatBadgeProps {
  readonly count: number | string;
  readonly label: string;
  readonly pipColor: 'green' | 'orange' | 'none';
  readonly icon?: React.ReactNode;
}

const StatBadge = memo(function StatBadge({
  count,
  label,
  pipColor,
  icon,
}: StatBadgeProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold shrink-0">
      {pipColor !== 'none' && (
        <div
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            pipColor === 'green' && 'bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.5)]',
            pipColor === 'orange' && 'bg-[#f97316] shadow-[0_0_6px_rgba(249,115,22,0.5)]'
          )}
        />
      )}
      {icon}
      <span className="text-inherit">{count}</span>
      {label && <span className="text-[var(--ink3)] font-medium">{label}</span>}
    </div>
  );
});

// ============================================================================
// Component
// ============================================================================

export const Header = memo(function Header({
  inactiveCount,
  totalMemoryMB,
  onPrivacyToggle,
  onThemeToggle,
  onSnapToCorner,
  onCleanupToggle,
  onDuplicatesToggle,
  privacyMode,
  cleanupOpen,
  duplicatesOpen,
}: HeaderProps): React.JSX.Element {
  const { actions } = useBTab();
  const tabs = useTabs();
  const settings = useSettings();
  const { focusMode } = useFocusMode();
  const isPro = useIsPro();

  const isDark = isDarkTheme(settings.theme);

  const formattedMemory = totalMemoryMB >= 1024
    ? `${(totalMemoryMB / 1024).toFixed(2)} GB`
    : `${Math.round(totalMemoryMB)} MB`;

  // S1-4: Calculate focus mode tab counts
  const totalTabs = tabs.length;
  const currentWindowTabs = focusMode
    ? tabs.filter(t => {
        // Get active tab's window ID from payload
        const activeTab = tabs.find(tab => tab.active);
        return activeTab ? t.windowId === activeTab.windowId : true;
      }).length
    : totalTabs;

  // S1-5: Calculate duplicate count for badge
  const duplicateCount = useMemo(() => {
    const urlGroups = new Map<string, number>();
    for (const tab of tabs) {
      if (!tab.isDuplicate) continue;
      // For Pro users, use smartDupUrl; for Free users, use exact url
      const groupKey = isPro && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
      urlGroups.set(groupKey, (urlGroups.get(groupKey) || 0) + 1);
    }
    // Count total tabs that can be closed (all but one from each group)
    let count = 0;
    for (const groupCount of urlGroups.values()) {
      if (groupCount > 1) {
        count += groupCount - 1;
      }
    }
    return count;
  }, [tabs, isPro]);

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-2 shrink-0 select-none',
        'border-b cursor-grab active:cursor-grabbing',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
    >
      {/* Brand Logo - 18px */}
      <div className="text-[18px] font-bold tracking-tight shrink-0 leading-none">
        <span className={isDark ? 'text-white' : 'text-[#0e1226]'}>b</span>
        <span className="text-[#1dd9b4]">Tab</span>
      </div>

      {/* Separator */}
      <div className={cn(
        'w-px h-3.5 shrink-0',
        isDark ? 'bg-white/[0.15]' : 'bg-black/[0.12]'
      )} />

      {/* Stats container - can shrink if needed */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Tab count */}
        <StatBadge count={focusMode ? `${currentWindowTabs}/${totalTabs}` : tabs.length} label="" pipColor="green" />
        
        {/* S1-4: Focus Mode Badge - compact */}
        {focusMode && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-[rgba(29,217,180,0.18)] text-[#1dd9b4] shrink-0">
            FOCUS
          </span>
        )}
        
        {/* Idle count - hide when focus mode active to save space */}
        {!focusMode && (
          <StatBadge count={inactiveCount} label="idle" pipColor="orange" />
        )}

        {/* Memory stat - hide when focus mode active to save space */}
        {!focusMode && (
          <div className="flex items-center gap-1 text-[11px] font-medium shrink-0">
            <svg
              className={cn(
                'w-3 h-3',
                isDark ? 'text-[#64748b]' : 'text-[#94a3b8]'
              )}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Cpu/Memory chip icon */}
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
            </svg>
            <span className={isDark ? 'text-[#94a3b8]' : 'text-[#64748b]'}>{formattedMemory}</span>
          </div>
        )}
      </div>

      {/* Right Actions - always visible */}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {/* S1-5: Duplicates Button with Badge - Pro Feature */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-6 h-6 rounded-md border border-transparent',
              'transition-all duration-150',
              duplicatesOpen && 'text-[#fab387] bg-[rgba(250,179,135,0.12)] border-[rgba(250,179,135,0.28)]',
              !duplicatesOpen && isDark
                ? 'text-[#64748b] hover:bg-white/[0.05] hover:text-[#edf0ff] hover:border-white/[0.12]'
                : 'text-[#64748b] hover:bg-black/[0.03] hover:text-[#0e1226] hover:border-black/[0.1]'
            )}
            onClick={onDuplicatesToggle}
            title="Duplicate Tabs (Pro)"
          >
            <Copy className="w-3 h-3" />
          </Button>
          {/* Pro crown badge when not Pro */}
          {!isPro && (
            <Crown className="w-3 h-3 absolute -top-1 -right-1 text-[#eba304]" />
          )}
          {/* S1-5: Duplicate count badge - only show for Pro users */}
          {isPro && duplicateCount > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full',
                'text-[8px] font-bold flex items-center justify-center',
                'bg-[#fab387] text-[#0e1226]'
              )}
            >
              {duplicateCount > 99 ? '99+' : duplicateCount}
            </span>
          )}
        </div>

        {/* S1-3: Cleanup Button - Pro Feature */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-6 h-6 rounded-md border border-transparent',
              'transition-all duration-150',
              cleanupOpen && 'text-[#1dd9b4] bg-[rgba(29,217,180,0.12)] border-[rgba(29,217,180,0.28)]',
              !cleanupOpen && isDark
                ? 'text-[#64748b] hover:bg-white/[0.05] hover:text-[#edf0ff] hover:border-white/[0.12]'
                : 'text-[#64748b] hover:bg-black/[0.03] hover:text-[#0e1226] hover:border-black/[0.1]'
            )}
            onClick={onCleanupToggle}
            title="Quick Cleanup (Pro)"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
          {/* Pro crown badge when not Pro */}
          {!isPro && (
            <Crown className="w-3 h-3 absolute -top-1 -right-1 text-[#eba304]" />
          )}
        </div>

        {/* S1-4: Focus Mode Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded-md border border-transparent',
            'transition-all duration-150',
            focusMode && 'text-[#1dd9b4] bg-[rgba(29,217,180,0.12)] border-[rgba(29,217,180,0.28)]',
            !focusMode && isDark
              ? 'text-[#64748b] hover:bg-white/[0.05] hover:text-[#edf0ff] hover:border-white/[0.12]'
              : 'text-[#64748b] hover:bg-black/[0.03] hover:text-[#0e1226] hover:border-black/[0.1]'
          )}
          onClick={actions.toggleFocusMode}
          title={focusMode ? 'Exit Focus Mode' : 'Focus Mode (current window only)'}
        >
          <Focus className="w-3 h-3" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded-md border border-transparent',
            'transition-all duration-150',
            isDark
              ? 'text-[#64748b] hover:bg-white/[0.05] hover:text-[#edf0ff] hover:border-white/[0.12]'
              : 'text-[#64748b] hover:bg-black/[0.03] hover:text-[#0e1226] hover:border-black/[0.1]'
          )}
          onClick={onThemeToggle}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
        </Button>

        {/* Privacy Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded-md border border-transparent',
            'transition-all duration-150',
            privacyMode && 'text-[#1dd9b4]',
            !privacyMode && isDark
              ? 'text-[#64748b] hover:bg-white/[0.05] hover:text-[#edf0ff] hover:border-white/[0.12]'
              : 'text-[#64748b] hover:bg-black/[0.03] hover:text-[#0e1226] hover:border-black/[0.1]'
          )}
          onClick={onPrivacyToggle}
          title={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
        >
          {privacyMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded-md border border-transparent',
            'transition-all duration-150',
            isDark
              ? 'text-[#64748b] hover:bg-[rgba(247,118,142,0.12)] hover:text-[#f7768e] hover:border-[rgba(247,118,142,0.35)]'
              : 'text-[#64748b] hover:bg-[rgba(192,32,64,0.1)] hover:text-[#c02040] hover:border-[rgba(192,32,64,0.25)]'
          )}
          onClick={actions.hide}
          title="Close (Esc)"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
});

export default Header;
