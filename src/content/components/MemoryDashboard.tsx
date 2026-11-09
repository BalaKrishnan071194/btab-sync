/**
 * MemoryDashboard Component (S2-3)
 *
 * Memory Intelligence Dashboard showing:
 * - Per-tab memory consumption
 * - Total extension memory usage
 * - Visual chart of memory over time
 * - Suggestions for tabs to suspend
 * - Refresh button to update stats
 *
 * Pro feature - requires isPro check.
 */

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  RefreshCw,
  X,
  Crown,
  Moon,
  AlertTriangle,
  TrendingDown,
  Cpu,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useBTab, useSettings, useTabs, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';
import { ext } from '@/lib/browsers';

// ============================================================================
// Types
// ============================================================================

interface MemoryDashboardProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface MemoryHistoryPoint {
  readonly timestamp: number;
  readonly totalMB: number;
}

interface TabMemoryInfo {
  readonly tab: TabInfo;
  readonly memoryMB: number;
  readonly percentage: number;
  readonly isSuspendCandidate: boolean;
  readonly reason: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_POINTS = 20;
const MEMORY_HISTORY_INTERVAL = 5000; // 5 seconds

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get i18n message with fallback
 */
function getMessage(key: string, substitutions?: string[]): string {
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  } catch {
    return key;
  }
}

/**
 * Format memory size for display
 */
function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

/**
 * Get suspend reason for a tab
 */
function getSuspendReason(tab: TabInfo): { isSuspendCandidate: boolean; reason: string } {
  // Already suspended
  if (tab.discarded) {
    return { isSuspendCandidate: false, reason: '' };
  }

  // Active tab - can't suspend
  if (tab.active) {
    return { isSuspendCandidate: false, reason: '' };
  }

  // Pinned tabs are protected
  if (tab.pinned) {
    return { isSuspendCandidate: false, reason: '' };
  }

  // Playing audio
  if (tab.audible) {
    return { isSuspendCandidate: false, reason: '' };
  }

  // High memory + long idle = best candidate
  if (tab.estimatedMemoryMB >= 100 && tab.isStale) {
    return {
      isSuspendCandidate: true,
      reason: getMessage('memSuggestHighMemIdle'),
    };
  }

  // High memory alone
  if (tab.estimatedMemoryMB >= 150) {
    return {
      isSuspendCandidate: true,
      reason: getMessage('memSuggestHighMem'),
    };
  }

  // Long idle time
  if (tab.isStale && tab.idleDurationMs > 2 * 60 * 60 * 1000) {
    return {
      isSuspendCandidate: true,
      reason: getMessage('memSuggestLongIdle'),
    };
  }

  return { isSuspendCandidate: false, reason: '' };
}

/**
 * Calculate tab memory info with suggestions
 */
function analyzeTabMemory(tabs: readonly TabInfo[]): TabMemoryInfo[] {
  const totalMemory = tabs.reduce((sum, t) => sum + t.estimatedMemoryMB, 0);

  return tabs
    .map((tab) => {
      const { isSuspendCandidate, reason } = getSuspendReason(tab);
      return {
        tab,
        memoryMB: tab.estimatedMemoryMB,
        percentage: totalMemory > 0 ? (tab.estimatedMemoryMB / totalMemory) * 100 : 0,
        isSuspendCandidate,
        reason,
      };
    })
    .sort((a, b) => b.memoryMB - a.memoryMB);
}

// ============================================================================
// Sub-components
// ============================================================================

interface MemoryBarProps {
  readonly value: number;
  readonly max: number;
  readonly isDark: boolean;
}

const MemoryBar = memo(function MemoryBar({
  value,
  max,
  isDark,
}: MemoryBarProps): React.JSX.Element {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color =
    percentage > 80
      ? '#f7768e'
      : percentage > 50
        ? '#ff9e64'
        : '#9ece6a';

  return (
    <div
      className={cn(
        'w-full h-1.5 rounded-full overflow-hidden',
        isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
});

interface MiniChartProps {
  readonly data: readonly MemoryHistoryPoint[];
  readonly isDark: boolean;
}

const MiniChart = memo(function MiniChart({
  data,
  isDark,
}: MiniChartProps): React.JSX.Element {
  if (data.length < 2) {
    return (
      <div
        className={cn(
          'w-full h-16 rounded-lg flex items-center justify-center text-[10px]',
          isDark ? 'bg-white/[0.03] text-[#4e5578]' : 'bg-black/[0.02] text-[#8890ab]'
        )}
      >
        {getMessage('memChartCollecting')}
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.totalMB));
  const minValue = Math.min(...data.map((d) => d.totalMB));
  const range = maxValue - minValue || 1;
  const height = 64; // px
  const width = 100; // percentage

  // Build SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.totalMB - minValue) / range) * (height - 8);
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  // Fill area under line
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div
      className={cn(
        'w-full h-16 rounded-lg overflow-hidden relative',
        isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient id="memChartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1dd9b4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1dd9b4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#memChartGrad)" />
        <path
          d={pathD}
          fill="none"
          stroke="#1dd9b4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Labels */}
      <div className="absolute bottom-0.5 right-1 text-[9px] text-[#1dd9b4] font-medium">
        {formatMemory(data[data.length - 1]?.totalMB ?? 0)}
      </div>
    </div>
  );
});

interface TabMemoryRowProps {
  readonly info: TabMemoryInfo;
  readonly maxMemory: number;
  readonly isDark: boolean;
  readonly onSuspend: (tabId: number) => Promise<void>;
}

const TabMemoryRow = memo(function TabMemoryRow({
  info,
  maxMemory,
  isDark,
  onSuspend,
}: TabMemoryRowProps): React.JSX.Element {
  const [isSuspending, setIsSuspending] = useState(false);

  const handleSuspend = useCallback(async () => {
    setIsSuspending(true);
    try {
      await onSuspend(info.tab.id);
    } finally {
      setIsSuspending(false);
    }
  }, [info.tab.id, onSuspend]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        'border transition-all duration-150',
        isDark
          ? 'bg-white/[0.02] border-white/[0.05]'
          : 'bg-black/[0.01] border-black/[0.04]',
        info.isSuspendCandidate &&
          (isDark
            ? 'bg-[rgba(255,158,100,0.06)] border-[rgba(255,158,100,0.15)]'
            : 'bg-[rgba(255,158,100,0.08)] border-[rgba(255,158,100,0.2)]')
      )}
    >
      {/* Favicon */}
      <img
        src={info.tab.favIconUrl || 'chrome://favicon/'}
        alt=""
        className="w-4 h-4 rounded shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[10.5px] font-medium truncate',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
            title={info.tab.title || info.tab.url}
          >
            {info.tab.title || info.tab.url}
          </span>
          {info.tab.discarded && (
            <span
              className={cn(
                'text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider',
                'bg-[rgba(122,162,247,0.12)] text-[#7aa2f7]'
              )}
            >
              {getMessage('labelFrozen')}
            </span>
          )}
          {info.tab.pinned && (
            <span
              className={cn(
                'text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider',
                'bg-[rgba(249,226,175,0.12)] text-[#f9e2af]'
              )}
            >
              {getMessage('labelPinned')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <MemoryBar value={info.memoryMB} max={maxMemory} isDark={isDark} />
          <span
            className={cn(
              'text-[9px] tabular-nums shrink-0',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {formatMemory(info.memoryMB)}
          </span>
        </div>
      </div>

      {/* Suspend suggestion */}
      {info.isSuspendCandidate && !info.tab.discarded && (
        <Button
          className={cn(
            'px-2 py-1 rounded-md text-[9px] font-semibold shrink-0',
            'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
            'hover:bg-[rgba(29,217,180,0.2)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          disabled={isSuspending}
          onClick={handleSuspend}
          title={info.reason}
        >
          {isSuspending ? (
            '...'
          ) : (
            <>
              <Moon className="w-2.5 h-2.5 mr-1" strokeWidth={2} />
              {getMessage('memSuspendBtn')}
            </>
          )}
        </Button>
      )}
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
        'absolute bottom-14 left-1/2 -translate-x-1/2',
        'px-4 py-1.5 rounded-full whitespace-nowrap pointer-events-none',
        'text-[11.5px] font-medium',
        'bg-[rgba(29,217,180,0.15)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]'
      )}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    >
      {message}
    </motion.div>
  );
});

// ============================================================================
// Component
// ============================================================================

export const MemoryDashboard = memo(function MemoryDashboard({
  isOpen,
  onClose,
}: MemoryDashboardProps): React.JSX.Element {
  const { actions } = useBTab();
  const settings = useSettings();
  const tabs = useTabs();
  const isPro = useIsPro();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<MemoryHistoryPoint[]>([]);
  const historyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDark = isDarkTheme(settings.theme);

  // Analyze tabs
  const tabMemoryInfos = useMemo(() => analyzeTabMemory(tabs), [tabs]);

  const totalMemory = useMemo(
    () => tabs.reduce((sum, t) => sum + t.estimatedMemoryMB, 0),
    [tabs]
  );

  const maxTabMemory = useMemo(
    () => Math.max(...tabMemoryInfos.map((i) => i.memoryMB), 1),
    [tabMemoryInfos]
  );

  const suspendCandidates = useMemo(
    () => tabMemoryInfos.filter((i) => i.isSuspendCandidate),
    [tabMemoryInfos]
  );

  const potentialSavings = useMemo(
    () => suspendCandidates.reduce((sum, i) => sum + i.memoryMB, 0),
    [suspendCandidates]
  );

  // Top 10 tabs by memory
  const topTabs = useMemo(() => tabMemoryInfos.slice(0, 10), [tabMemoryInfos]);

  // Track memory history
  useEffect(() => {
    if (!isOpen) {
      // Clear history when closed
      if (historyIntervalRef.current) {
        clearInterval(historyIntervalRef.current);
        historyIntervalRef.current = null;
      }
      return;
    }

    // Add initial point
    setMemoryHistory((prev) => {
      const newPoint = { timestamp: Date.now(), totalMB: totalMemory };
      if (prev.length === 0) {
        return [newPoint];
      }
      return prev;
    });

    // Update periodically
    historyIntervalRef.current = setInterval(() => {
      setMemoryHistory((prev) => {
        const newPoint = { timestamp: Date.now(), totalMB: totalMemory };
        const updated = [...prev, newPoint];
        if (updated.length > MAX_HISTORY_POINTS) {
          return updated.slice(-MAX_HISTORY_POINTS);
        }
        return updated;
      });
    }, MEMORY_HISTORY_INTERVAL);

    return () => {
      if (historyIntervalRef.current) {
        clearInterval(historyIntervalRef.current);
        historyIntervalRef.current = null;
      }
    };
  }, [isOpen, totalMemory]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await actions.refreshPayload();
      setToastMessage(getMessage('memRefreshed'));
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Memory refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [actions]);

  // Handle suspend
  const handleSuspend = useCallback(
    async (tabId: number) => {
      try {
        const success = await actions.sleepTab(tabId);
        if (success) {
          setToastMessage(getMessage('memTabSuspended'));
          setTimeout(() => setToastMessage(null), 2000);
        }
      } catch (e) {
        console.warn('[bTab] Suspend error:', e);
      }
    },
    [actions]
  );

  // Handle suspend all candidates
  const handleSuspendAll = useCallback(async () => {
    let suspended = 0;
    for (const info of suspendCandidates) {
      try {
        const success = await actions.sleepTab(info.tab.id);
        if (success) suspended++;
      } catch (e) {
        console.warn('[bTab] Suspend error:', e);
      }
    }

    if (suspended > 0) {
      setToastMessage(
        getMessage('memSuspendedCount', [String(suspended), formatMemory(potentialSavings)])
      );
      setTimeout(() => setToastMessage(null), 2000);
    }
  }, [actions, suspendCandidates, potentialSavings]);

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

  // Pro feature gate
  if (!isPro) {
    return (
      <motion.div
        className={cn(
          'flex flex-col gap-2 p-2.5 shrink-0 border-b',
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
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <BarChart3
              className={cn(
                'w-3.5 h-3.5',
                isDark ? 'text-[#7aa2f7]' : 'text-[#4060c0]'
              )}
              strokeWidth={2}
            />
            <span
              className={cn(
                'text-xs font-semibold',
                isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
              )}
            >
              {getMessage('memPanelTitle')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
          >
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>

        {/* Pro Upgrade */}
        <div
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg',
            'border',
            isDark
              ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]'
              : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]'
          )}
        >
          <Crown className="w-6 h-6 text-[#f9e2af]" strokeWidth={2} />
          <div
            className={cn(
              'text-xs font-medium text-center',
              isDark ? 'text-[#f9e2af]' : 'text-[#a08020]'
            )}
          >
            {getMessage('memProFeature')}
          </div>
          <div
            className={cn(
              'text-[10px] text-center',
              isDark ? 'text-[#8b94b2]' : 'text-[#666]'
            )}
          >
            {getMessage('memProDescription')}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col gap-2.5 p-2.5 shrink-0 border-b max-h-[380px] overflow-y-auto',
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
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BarChart3
            className={cn(
              'w-3.5 h-3.5',
              isDark ? 'text-[#7aa2f7]' : 'text-[#4060c0]'
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              'text-xs font-semibold',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
          >
            {getMessage('memPanelTitle')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]',
              isRefreshing && 'animate-spin'
            )}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title={getMessage('memRefreshBtn')}
          >
            <RefreshCw className="w-3 h-3" strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
          >
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-stretch gap-2">
        {/* Total Memory */}
        <div
          className={cn(
            'flex-1 flex flex-col items-center justify-center p-2.5 rounded-lg',
            'border',
            isDark
              ? 'bg-white/[0.03] border-white/[0.07]'
              : 'bg-black/[0.02] border-black/[0.06]'
          )}
        >
          <Cpu
            className={cn(
              'w-4 h-4 mb-1',
              isDark ? 'text-[#7aa2f7]' : 'text-[#4060c0]'
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
          >
            {formatMemory(totalMemory)}
          </span>
          <span
            className={cn(
              'text-[9px]',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {getMessage('memTotalUsage')}
          </span>
        </div>

        {/* Tabs Count */}
        <div
          className={cn(
            'flex-1 flex flex-col items-center justify-center p-2.5 rounded-lg',
            'border',
            isDark
              ? 'bg-white/[0.03] border-white/[0.07]'
              : 'bg-black/[0.02] border-black/[0.06]'
          )}
        >
          <TrendingDown
            className={cn(
              'w-4 h-4 mb-1',
              isDark ? 'text-[#9ece6a]' : 'text-[#40a030]'
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
          >
            {tabs.length}
          </span>
          <span
            className={cn(
              'text-[9px]',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {getMessage('memTabCount')}
          </span>
        </div>

        {/* Potential Savings */}
        <div
          className={cn(
            'flex-1 flex flex-col items-center justify-center p-2.5 rounded-lg',
            'border',
            potentialSavings > 0
              ? isDark
                ? 'bg-[rgba(255,158,100,0.08)] border-[rgba(255,158,100,0.2)]'
                : 'bg-[rgba(255,158,100,0.1)] border-[rgba(255,158,100,0.25)]'
              : isDark
                ? 'bg-white/[0.03] border-white/[0.07]'
                : 'bg-black/[0.02] border-black/[0.06]'
          )}
        >
          <Zap
            className={cn(
              'w-4 h-4 mb-1',
              potentialSavings > 0
                ? 'text-[#ff9e64]'
                : isDark
                  ? 'text-[#4e5578]'
                  : 'text-[#8890ab]'
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              potentialSavings > 0
                ? 'text-[#ff9e64]'
                : isDark
                  ? 'text-[#edf0ff]'
                  : 'text-[#0e1226]'
            )}
          >
            {formatMemory(potentialSavings)}
          </span>
          <span
            className={cn(
              'text-[9px]',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {getMessage('memPotentialSavings')}
          </span>
        </div>
      </div>

      {/* Memory Chart */}
      <div>
        <div
          className={cn(
            'text-[10px] font-medium mb-1.5 px-0.5',
            isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
          )}
        >
          {getMessage('memChartTitle')}
        </div>
        <MiniChart data={memoryHistory} isDark={isDark} />
      </div>

      {/* Suggestions Banner */}
      {suspendCandidates.length > 0 && (
        <div
          className={cn(
            'flex items-center gap-2 p-2.5 rounded-lg',
            'border',
            isDark
              ? 'bg-[rgba(255,158,100,0.06)] border-[rgba(255,158,100,0.15)]'
              : 'bg-[rgba(255,158,100,0.08)] border-[rgba(255,158,100,0.2)]'
          )}
        >
          <AlertTriangle className="w-4 h-4 text-[#ff9e64] shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'text-[10.5px] font-medium',
                isDark ? 'text-[#ff9e64]' : 'text-[#c06020]'
              )}
            >
              {getMessage('memSuggestTitle', [String(suspendCandidates.length)])}
            </div>
            <div
              className={cn(
                'text-[9px] mt-0.5',
                isDark ? 'text-[#8b94b2]' : 'text-[#666]'
              )}
            >
              {getMessage('memSuggestDescription', [formatMemory(potentialSavings)])}
            </div>
          </div>
          <Button
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-semibold shrink-0',
              'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
              'hover:bg-[rgba(29,217,180,0.2)]'
            )}
            onClick={handleSuspendAll}
          >
            <Moon className="w-3 h-3 mr-1" strokeWidth={2} />
            {getMessage('memSuspendAllBtn')}
          </Button>
        </div>
      )}

      {/* Top Tabs List */}
      <div>
        <div
          className={cn(
            'text-[10px] font-medium mb-1.5 px-0.5',
            isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
          )}
        >
          {getMessage('memTopTabsTitle')}
        </div>
        <div className="flex flex-col gap-1">
          {topTabs.map((info) => (
            <TabMemoryRow
              key={info.tab.id}
              info={info}
              maxMemory={maxTabMemory}
              isDark={isDark}
              onSuspend={handleSuspend}
            />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        className={cn(
          'text-[9px] text-center px-2',
          isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
        )}
      >
        {getMessage('memDisclaimer')}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} isDark={isDark} />}
      </AnimatePresence>
    </motion.div>
  );
});

export default MemoryDashboard;
