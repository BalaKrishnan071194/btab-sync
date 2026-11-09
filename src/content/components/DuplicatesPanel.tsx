/**
 * DuplicatesPanel Component (S1-5)
 *
 * Smart duplicate detection panel for Pro users.
 * Shows duplicate tabs grouped by URL (with tracking params stripped).
 * Allows closing all duplicates but the most recently accessed.
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle, X, Crown, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { useBTab, useSettings, useTabs, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface DuplicatesPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface DuplicateGroup {
  readonly key: string;
  readonly hostname: string;
  readonly tabs: TabInfo[];
  readonly count: number;
  readonly totalMemory: number;
  /** True if this group was detected via smart URL normalization (tracking params stripped) */
  readonly isSmartDuplicate: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get hostname from URL
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Group duplicate tabs by normalized URL
 * For Pro users, uses smartDupUrl (tracking params stripped)
 * For Free users, uses exact URL match
 */
function groupDuplicates(
  tabs: readonly TabInfo[],
  isPro: boolean
): DuplicateGroup[] {
  const groups = new Map<string, TabInfo[]>();
  
  for (const tab of tabs) {
    if (!tab.isDuplicate) continue;
    
    // For Pro users, use smartDupUrl; for Free users, use exact url
    const groupKey = isPro && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
    
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(tab);
    } else {
      groups.set(groupKey, [tab]);
    }
  }
  
  // Convert to array and filter groups with more than 1 tab
  const result: DuplicateGroup[] = [];
  
  for (const [key, groupTabs] of groups.entries()) {
    if (groupTabs.length < 2) continue;
    
    // Sort by idle time (lowest first = most recently accessed)
    const sortedTabs = [...groupTabs].sort((a, b) => a.idleDurationMs - b.idleDurationMs);
    
    // Check if this is a smart duplicate (different actual URLs in same group)
    const uniqueUrls = new Set(sortedTabs.map(t => t.url));
    const isSmartDuplicate = uniqueUrls.size > 1;
    
    result.push({
      key,
      hostname: getHostname(key),
      tabs: sortedTabs,
      count: sortedTabs.length,
      totalMemory: sortedTabs.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
      isSmartDuplicate,
    });
  }
  
  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}

/**
 * Get i18n message with fallback
 */
function getMessage(key: string, substitutions?: string[]): string {
  try {
    // Use chrome.i18n directly since we're in a content script context
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  } catch {
    return key;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

interface DuplicateGroupCardProps {
  readonly group: DuplicateGroup;
  readonly onCloseOthers: (group: DuplicateGroup) => Promise<void>;
  readonly isDark: boolean;
  readonly isPro: boolean;
  readonly pinnedProtection: boolean;
}

const DuplicateGroupCard = memo(function DuplicateGroupCard({
  group,
  onCloseOthers,
  isDark,
  isPro,
  pinnedProtection,
}: DuplicateGroupCardProps): React.JSX.Element {
  const [isClosing, setIsClosing] = useState(false);
  const keepTab = group.tabs[0]; // Most recently accessed tab
  
  // Count how many can be closed (exclude pinned if protection is on)
  const closableTabs = group.tabs.slice(1).filter(t => !pinnedProtection || !t.pinned);
  const closableCount = closableTabs.length;
  const closableMemory = closableTabs.reduce((sum, t) => sum + t.estimatedMemoryMB, 0);
  
  const handleCloseOthers = useCallback(async () => {
    if (closableCount === 0) return;
    setIsClosing(true);
    try {
      await onCloseOthers(group);
    } finally {
      setIsClosing(false);
    }
  }, [group, onCloseOthers, closableCount]);
  
  if (!keepTab) return <></>;
  
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-2.5 rounded-lg',
        'border transition-all duration-150',
        isDark
          ? 'bg-white/[0.03] border-white/[0.07]'
          : 'bg-black/[0.02] border-black/[0.06]'
      )}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2">
        {/* Icon */}
        <div
          className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0"
          style={{ background: 'rgba(250,179,135,0.12)' }}
        >
          <Copy
            className="w-3.5 h-3.5"
            style={{ color: '#fab387' }}
            strokeWidth={2}
          />
        </div>
        
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-xs font-medium leading-tight truncate',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
            title={keepTab.title || keepTab.url}
          >
            {keepTab.title || group.hostname}
          </div>
          <div
            className={cn(
              'text-[10.5px] mt-0.5 flex items-center gap-1.5',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            <span>{group.count} {getMessage('dupTabsCount', [String(group.count)])}</span>
            {group.isSmartDuplicate && isPro && (
              <span
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-medium',
                  'bg-[rgba(29,217,180,0.12)] text-[#1dd9b4] border border-[rgba(29,217,180,0.2)]'
                )}
                title={getMessage('smartDupDetected')}
              >
                SMART
              </span>
            )}
          </div>
        </div>
        
        {/* Close Others Button */}
        {closableCount > 0 && (
          <Button
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10.5px] font-semibold',
              'bg-[rgba(247,118,142,0.12)] border border-[rgba(247,118,142,0.28)] text-[#f7768e]',
              'hover:bg-[rgba(247,118,142,0.2)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={isClosing}
            onClick={handleCloseOthers}
          >
            {isClosing ? (
              '...'
            ) : (
              <>
                <Trash2 className="w-3 h-3 mr-1" strokeWidth={2} />
                {getMessage('dupCloseOthers', [String(closableCount)])}
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Tab List Preview */}
      <div className="flex flex-col gap-1 pl-9">
        {group.tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-2 text-[10px] py-0.5 rounded px-1.5',
              idx === 0 && 'bg-[rgba(158,206,106,0.1)]',
              isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
            )}
          >
            {idx === 0 && (
              <span
                className={cn(
                  'text-[8px] px-1 py-0.5 rounded uppercase font-bold tracking-wider',
                  'bg-[rgba(158,206,106,0.15)] text-[#9ece6a]'
                )}
              >
                {getMessage('dupKeep')}
              </span>
            )}
            {tab.pinned && pinnedProtection && (
              <span
                className={cn(
                  'text-[8px] px-1 py-0.5 rounded uppercase font-bold tracking-wider',
                  'bg-[rgba(249,226,175,0.12)] text-[#f9e2af]'
                )}
              >
                {getMessage('labelPinned')}
              </span>
            )}
            <span className="truncate flex-1">{tab.title || tab.url}</span>
            <span className="shrink-0 tabular-nums">{tab.estimatedMemoryMB} MB</span>
          </div>
        ))}
      </div>
    </div>
  );
});

interface ToastProps {
  readonly message: string;
  readonly isDark: boolean;
}

const Toast = memo(function Toast({
  message,
  isDark,
}: ToastProps): React.JSX.Element {
  return (
    <motion.div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-[2147483647]',
        'px-4 py-2 rounded-full whitespace-nowrap pointer-events-none',
        'text-xs font-semibold',
        'bg-[rgba(29,217,180,0.95)] text-white shadow-lg',
        'border border-[rgba(255,255,255,0.2)]'
      )}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {message}
    </motion.div>
  );
});

// ============================================================================
// Component
// ============================================================================

export const DuplicatesPanel = memo(function DuplicatesPanel({
  isOpen,
  onClose,
}: DuplicatesPanelProps): React.JSX.Element {
  const { actions, state } = useBTab();
  const settings = useSettings();
  const tabs = useTabs();
  const isPro = useIsPro();
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const isDark = isDarkTheme(settings.theme);
  
  // Group duplicates
  const duplicateGroups = useMemo(
    () => groupDuplicates(tabs, isPro),
    [tabs, isPro]
  );
  
  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0);
  const totalSavings = duplicateGroups.reduce(
    (sum, g) => sum + g.tabs.slice(1).reduce((s, t) => s + t.estimatedMemoryMB, 0),
    0
  );
  
  // Handle close others for a group
  const handleCloseOthers = useCallback(async (group: DuplicateGroup) => {
    const pinnedProtection = settings.pinnedProtection;
    let closedCount = 0;
    let freedMemory = 0;
    
    // Close all tabs except the first (most recently accessed)
    for (let i = 1; i < group.tabs.length; i++) {
      const tab = group.tabs[i];
      if (!tab) continue;
      
      // Skip pinned tabs if protection is enabled
      if (tab.pinned && pinnedProtection) continue;
      
      try {
        const success = await actions.closeTab(tab.id);
        if (success) {
          closedCount++;
          freedMemory += tab.estimatedMemoryMB;
        }
      } catch (e) {
        console.warn('[bTab] Failed to close duplicate tab:', e);
      }
    }
    
    if (closedCount > 0) {
      setToastMessage(getMessage('dupClosedResult', [String(closedCount), String(freedMemory)]));
      setTimeout(() => setToastMessage(null), 2000);
      await actions.refreshPayload();
    }
  }, [actions, settings.pinnedProtection]);
  
  // Handle close all duplicates
  const handleCloseAllDuplicates = useCallback(async () => {
    const count = await actions.closeDuplicates();
    if (count > 0) {
      setToastMessage(getMessage('dupClosedResult', [String(count), '—']));
      setTimeout(() => {
        setToastMessage(null);
        onClose();
      }, 2000);
    }
  }, [actions, onClose]);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return <></>;
  
  // Pro feature gate: show upgrade prompt for Free users when there are duplicates
  const showProUpgrade = !isPro && duplicateGroups.length > 0;
  
  return (
    <motion.div
      className={cn(
        'flex flex-col gap-2 p-2.5 shrink-0 border-b max-h-[280px] overflow-y-auto',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-1 pb-2 border-b mb-1',
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-6 h-6 rounded-lg p-0',
              isDark
                ? 'text-[#8b94b2] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#444d6e] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
            title="Back to tabs"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
          <Copy
            className={cn(
              'w-3.5 h-3.5',
              isDark ? 'text-[#fab387]' : 'text-[#c04000]'
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              'text-xs font-semibold',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
          >
            {getMessage('dupPanelTitle')}
          </span>
          {totalDuplicates > 0 && (
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                'bg-[rgba(250,179,135,0.12)] text-[#fab387]'
              )}
            >
              {totalDuplicates} {getMessage('dupToClose')}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded-lg p-0',
            isDark
              ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
              : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </Button>
      </div>
      
      {/* Content */}
      {duplicateGroups.length > 0 ? (
        <>
          {/* Pro Upgrade Banner (for Free users) */}
          {showProUpgrade && (
            <div
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg mb-1',
                'border',
                isDark
                  ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]'
                  : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]'
              )}
            >
              <Crown className="w-4 h-4 text-[#f9e2af] shrink-0" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-[11px] font-medium',
                    isDark ? 'text-[#f9e2af]' : 'text-[#a08020]'
                  )}
                >
                  {getMessage('dupProFeature')}
                </div>
                <div
                  className={cn(
                    'text-[10px] mt-0.5',
                    isDark ? 'text-[#8b94b2]' : 'text-[#666]'
                  )}
                >
                  {getMessage('dupProDescription')}
                </div>
              </div>
            </div>
          )}
          
          {/* Duplicate Groups */}
          <div className="flex flex-col gap-1.5">
            {duplicateGroups.map((group) => (
              <DuplicateGroupCard
                key={group.key}
                group={group}
                onCloseOthers={handleCloseOthers}
                isDark={isDark}
                isPro={isPro}
                pinnedProtection={settings.pinnedProtection}
              />
            ))}
          </div>
          
          {/* Close All Button */}
          {totalDuplicates > 0 && (
            <Button
              className={cn(
                'w-full py-2.5 rounded-lg text-xs font-semibold',
                'bg-[rgba(247,118,142,0.12)] border border-[rgba(247,118,142,0.28)] text-[#f7768e]',
                'hover:bg-[rgba(247,118,142,0.2)]'
              )}
              onClick={handleCloseAllDuplicates}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              {getMessage('dupCloseAll', [String(totalDuplicates), String(totalSavings)])}
            </Button>
          )}
        </>
      ) : (
        /* Empty State */
        <div
          className={cn(
            'text-center py-4 px-2 text-xs',
            isDark ? 'text-[#1dd9b4]' : 'text-[#14b896]'
          )}
        >
          ✨ {getMessage('dupNoDuplicates')}
        </div>
      )}
      
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} isDark={isDark} />}
      </AnimatePresence>
    </motion.div>
  );
});

export default DuplicatesPanel;
