/**
 * CleanupPanel Component (S1-3)
 *
 * Smart one-click cleanup panel with collapsible categories.
 * Shows duplicates, idle, and heavy tabs with toggles and optimize button.
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Moon, Flame, CheckCircle, Sparkles, X, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { useBTab, useSettings, useTabs, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface CleanupPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface CleanupCategory {
  readonly id: 'duplicates' | 'idle' | 'heavy';
  readonly label: string;
  readonly description: string;
  readonly tabs: readonly TabInfo[];
  readonly savings: number;
  readonly icon: typeof Copy;
  readonly color: string;
  readonly bgColor: string;
  readonly borderColor: string;
}

interface CleanupAnalysis {
  readonly duplicates: readonly TabInfo[];
  readonly idle: readonly TabInfo[];
  readonly heavy: readonly TabInfo[];
  readonly dupSavings: number;
  readonly idleSavings: number;
  readonly heavySavings: number;
  readonly totalSavings: number;
}

// ============================================================================
// Constants
// ============================================================================

const HEAVY_MEMORY_THRESHOLD = 300; // MB

// ============================================================================
// Helpers
// ============================================================================

/**
 * Analyze tabs and categorize for cleanup
 */
function analyzeCleanup(
  tabs: readonly TabInfo[],
  isPro: boolean
): CleanupAnalysis {
  const seen = new Set<string>();
  const duplicates: TabInfo[] = [];
  const idle: TabInfo[] = [];
  const heavy: TabInfo[] = [];

  for (const tab of tabs) {
    // Skip pinned tabs - they're protected
    if (tab.pinned) continue;

    // Check for duplicates
    const normalizedUrl = isPro && tab.smartDupUrl ? tab.smartDupUrl : tab.url;
    if (tab.isDuplicate) {
      if (seen.has(normalizedUrl)) {
        duplicates.push(tab);
      }
      seen.add(normalizedUrl);
    }

    // Check for idle tabs (not already discarded)
    if (tab.isStale && !tab.discarded) {
      idle.push(tab);
    }

    // Check for heavy tabs (not active, not discarded)
    if (
      tab.estimatedMemoryMB >= HEAVY_MEMORY_THRESHOLD &&
      !tab.active &&
      !tab.discarded
    ) {
      heavy.push(tab);
    }
  }

  return {
    duplicates,
    idle,
    heavy,
    dupSavings: duplicates.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
    idleSavings: idle.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
    heavySavings: heavy.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
    totalSavings:
      duplicates.reduce((sum, t) => sum + t.estimatedMemoryMB, 0) +
      idle.reduce((sum, t) => sum + t.estimatedMemoryMB, 0) +
      heavy.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
  };
}

// ============================================================================
// Sub-components
// ============================================================================

interface CollapsibleCategoryProps {
  readonly category: CleanupCategory;
  readonly enabled: boolean;
  readonly onToggle: () => void;
  readonly isDark: boolean;
}

const CollapsibleCategory = memo(function CollapsibleCategory({
  category,
  enabled,
  onToggle,
  isDark,
}: CollapsibleCategoryProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  if (category.tabs.length === 0) return null;

  const Icon = category.icon;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        isDark
          ? 'bg-white/[0.02] border-white/[0.07]'
          : 'bg-black/[0.01] border-black/[0.06]',
        enabled && [
          isDark ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-black/[0.03] border-black/[0.08]',
        ]
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 p-2.5">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: category.bgColor, border: `1px solid ${category.borderColor}` }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: category.color }}
            strokeWidth={2}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[13px] font-semibold leading-tight',
                isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
              )}
            >
              {category.label}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                'tabular-nums'
              )}
              style={{ 
                background: category.bgColor, 
                color: category.color,
                border: `1px solid ${category.borderColor}`
              }}
            >
              {category.tabs.length}
            </span>
          </div>
          <div
            className={cn(
              'text-[11px] mt-0.5',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {category.description} · ~{category.savings} MB
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
            isDark
              ? 'hover:bg-white/[0.06] text-[#4e5578]'
              : 'hover:bg-black/[0.04] text-[#8890ab]'
          )}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          </motion.div>
        </button>

        {/* Toggle */}
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="shrink-0"
        />
      </div>

      {/* Expandable Tab List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'px-2.5 pb-2.5 pt-0',
                'border-t',
                isDark ? 'border-white/[0.05]' : 'border-black/[0.04]'
              )}
            >
              <div className="pt-2 flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                {category.tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]',
                      isDark
                        ? 'bg-white/[0.02] text-[#8b94b2]'
                        : 'bg-black/[0.02] text-[#444d6e]'
                    )}
                  >
                    {tab.favIconUrl && (
                      <img 
                        src={tab.favIconUrl} 
                        alt="" 
                        className="w-3.5 h-3.5 rounded shrink-0" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="truncate flex-1">{tab.title || tab.url}</span>
                    <span className="shrink-0 tabular-nums text-[10px] opacity-60">
                      {tab.estimatedMemoryMB} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

export const CleanupPanel = memo(function CleanupPanel({
  isOpen,
  onClose,
}: CleanupPanelProps): React.JSX.Element {
  const { actions } = useBTab();
  const settings = useSettings();
  const tabs = useTabs();
  const isPro = useIsPro();

  const [enabledCategories, setEnabledCategories] = useState({
    duplicates: true,
    idle: true,
    heavy: true,
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isDark = isDarkTheme(settings.theme);

  // Analyze tabs
  const analysis = useMemo(
    () => analyzeCleanup(tabs, isPro),
    [tabs, isPro]
  );

  // Build categories
  const categories = useMemo<CleanupCategory[]>(
    () => [
      {
        id: 'duplicates',
        label: 'Duplicates',
        description: 'Close extra copies',
        tabs: analysis.duplicates,
        savings: analysis.dupSavings,
        icon: Copy,
        color: '#ff9e64',
        bgColor: 'rgba(255,158,100,0.12)',
        borderColor: 'rgba(255,158,100,0.25)',
      },
      {
        id: 'idle',
        label: 'Idle Tabs',
        description: 'Sleep inactive tabs',
        tabs: analysis.idle,
        savings: analysis.idleSavings,
        icon: Moon,
        color: '#7aa2f7',
        bgColor: 'rgba(122,162,247,0.12)',
        borderColor: 'rgba(122,162,247,0.25)',
      },
      {
        id: 'heavy',
        label: 'Heavy Tabs',
        description: `Over ${HEAVY_MEMORY_THRESHOLD}MB memory`,
        tabs: analysis.heavy,
        savings: analysis.heavySavings,
        icon: Flame,
        color: '#f7768e',
        bgColor: 'rgba(247,118,142,0.12)',
        borderColor: 'rgba(247,118,142,0.25)',
      },
    ],
    [analysis]
  );

  const hasAnythingToCleanup =
    analysis.duplicates.length > 0 ||
    analysis.idle.length > 0 ||
    analysis.heavy.length > 0;

  const enabledSavings = useMemo(() => {
    let total = 0;
    if (enabledCategories.duplicates) total += analysis.dupSavings;
    if (enabledCategories.idle) total += analysis.idleSavings;
    if (enabledCategories.heavy) total += analysis.heavySavings;
    return total;
  }, [enabledCategories, analysis]);

  const enabledTabCount = useMemo(() => {
    let count = 0;
    if (enabledCategories.duplicates) count += analysis.duplicates.length;
    if (enabledCategories.idle) count += analysis.idle.length;
    if (enabledCategories.heavy) count += analysis.heavy.length;
    return count;
  }, [enabledCategories, analysis]);

  // Handle optimize
  const handleOptimize = useCallback(async () => {
    setIsOptimizing(true);
    let closedCount = 0;
    let freedMemory = 0;

    try {
      // Close duplicates
      if (enabledCategories.duplicates) {
        for (const tab of analysis.duplicates) {
          const success = await actions.closeTab(tab.id);
          if (success) {
            closedCount++;
            freedMemory += tab.estimatedMemoryMB;
          }
        }
      }

      // Sleep idle tabs
      if (enabledCategories.idle) {
        for (const tab of analysis.idle) {
          const success = await actions.sleepTab(tab.id);
          if (success) {
            closedCount++;
            freedMemory += tab.estimatedMemoryMB;
          }
        }
      }

      // Sleep heavy tabs
      if (enabledCategories.heavy) {
        for (const tab of analysis.heavy) {
          const success = await actions.sleepTab(tab.id);
          if (success) {
            closedCount++;
            freedMemory += tab.estimatedMemoryMB;
          }
        }
      }

      // Show toast
      setToastMessage(`✨ Optimized ${closedCount} tabs · Freed ~${freedMemory} MB`);

      // Refresh payload
      await actions.refreshPayload();

      // Hide toast after 2 seconds
      setTimeout(() => {
        setToastMessage(null);
        onClose();
      }, 2000);
    } catch (e) {
      console.warn('[bTab] Cleanup error:', e);
    } finally {
      setIsOptimizing(false);
    }
  }, [
    enabledCategories,
    analysis,
    actions,
    onClose,
  ]);

  // Handle toggle
  const handleToggle = useCallback(
    (categoryId: 'duplicates' | 'idle' | 'heavy') => {
      setEnabledCategories((prev) => ({
        ...prev,
        [categoryId]: !prev[categoryId],
      }));
    },
    []
  );

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

  return (
    <motion.div
      className={cn(
        'flex flex-col gap-3 p-3 shrink-0 border-b',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.25)]'
            )}
          >
            <Sparkles
              className="w-3.5 h-3.5 text-[#1dd9b4]"
              strokeWidth={2}
            />
          </div>
          <div>
            <span
              className={cn(
                'text-[13px] font-semibold',
                isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
              )}
            >
              Quick Cleanup
            </span>
            {hasAnythingToCleanup && (
              <p className={cn(
                'text-[10px]',
                isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
              )}>
                Select categories to optimize
              </p>
            )}
          </div>
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
      {hasAnythingToCleanup ? (
        <>
          {/* Category Cards */}
          <div className="flex flex-col gap-2">
            {categories.map((category) => (
              <CollapsibleCategory
                key={category.id}
                category={category}
                enabled={enabledCategories[category.id]}
                onToggle={() => handleToggle(category.id)}
                isDark={isDark}
              />
            ))}
          </div>

          {/* Optimize Button */}
          <Button
            className={cn(
              'w-full py-3 rounded-xl text-[13px] font-semibold',
              'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
              'hover:bg-[rgba(29,217,180,0.2)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
            disabled={isOptimizing || enabledTabCount === 0}
            onClick={handleOptimize}
          >
            {isOptimizing ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" strokeWidth={2} />
                </motion.div>
                Optimizing...
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" strokeWidth={2} />
                Optimize {enabledTabCount} tab{enabledTabCount !== 1 ? 's' : ''} · ~{enabledSavings} MB
              </>
            )}
          </Button>
        </>
      ) : (
        /* Empty State */
        <div
          className={cn(
            'text-center py-6 px-4 rounded-xl',
            isDark
              ? 'bg-[rgba(29,217,180,0.06)] border border-[rgba(29,217,180,0.12)]'
              : 'bg-[rgba(29,217,180,0.08)] border border-[rgba(29,217,180,0.15)]'
          )}
        >
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#1dd9b4]" strokeWidth={1.5} />
          <p className={cn(
            'text-[13px] font-medium',
            'text-[#1dd9b4]'
          )}>
            Browser already optimized!
          </p>
          <p className={cn(
            'text-[11px] mt-1',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}>
            No duplicates, idle, or heavy tabs found
          </p>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} isDark={isDark} />}
      </AnimatePresence>
    </motion.div>
  );
});

export default CleanupPanel;
