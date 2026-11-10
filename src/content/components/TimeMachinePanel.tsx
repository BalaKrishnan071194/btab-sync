/**
 * TimeMachinePanel Component (S3-2)
 *
 * Panel showing tab history with collapsible date groups.
 * Features:
 * - 100 max entries, 30 day expiry
 * - Collapsible date sections (Today, Yesterday, etc.)
 * - Search functionality
 * - Pro feature gating
 */

import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw, Trash2, X, Crown, Search, ChevronDown, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabHistoryEntry } from '@/lib/db';
import { getTabHistory, searchTabHistory, clearTabHistory } from '@/lib/db';
import { ext } from '@/lib/browsers';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface TimeMachinePanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface DateGroup {
  readonly date: string;
  readonly label: string;
  readonly entries: TabHistoryEntry[];
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateLabel(timestamp: number): { date: string; label: string } {
  const d = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const date = d.toISOString().split('T')[0] ?? '';

  if (entryDate.getTime() === today.getTime()) {
    return { date, label: 'Today' };
  }
  if (entryDate.getTime() === yesterday.getTime()) {
    return { date, label: 'Yesterday' };
  }

  const diff = today.getTime() - entryDate.getTime();
  if (diff < 7 * 86400000) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    return { date, label: dayName };
  }

  return {
    date,
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupByDate(entries: TabHistoryEntry[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();

  for (const entry of entries) {
    const { date, label } = formatDateLabel(entry.closedAt);
    const existing = groups.get(date);

    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(date, { date, label, entries: [entry] });
    }
  }

  // Sort groups by date descending
  return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
}

// ============================================================================
// Collapsible Date Group
// ============================================================================

interface CollapsibleDateGroupProps {
  readonly group: DateGroup;
  readonly isDark: boolean;
  readonly onRestore: (entry: TabHistoryEntry) => void;
  readonly defaultExpanded?: boolean;
}

const CollapsibleDateGroup = memo(function CollapsibleDateGroup({
  group,
  isDark,
  onRestore,
  defaultExpanded = true,
}: CollapsibleDateGroupProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-2">
      {/* Date Header - Clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg',
          'transition-colors duration-150',
          isDark
            ? 'hover:bg-white/[0.03]'
            : 'hover:bg-black/[0.02]'
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'w-4 h-4 flex items-center justify-center',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}
        >
          <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
        </motion.div>
        
        <Calendar
          className={cn(
            'w-3 h-3',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}
          strokeWidth={2}
        />
        
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider flex-1 text-left',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}
        >
          {group.label}
        </span>
        
        <span
          className={cn(
            'text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
            isDark
              ? 'bg-white/[0.06] text-[#4e5578]'
              : 'bg-black/[0.04] text-[#8890ab]'
          )}
        >
          {group.entries.length}
        </span>
        
        <div
          className={cn(
            'flex-1 h-px ml-2',
            isDark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'
          )}
        />
      </button>

      {/* Entries */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pt-1 pl-6">
              {group.entries.map((entry) => (
                <HistoryEntry
                  key={entry.id}
                  entry={entry}
                  isDark={isDark}
                  onRestore={() => onRestore(entry)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================================================
// History Entry Row
// ============================================================================

interface HistoryEntryProps {
  readonly entry: TabHistoryEntry;
  readonly isDark: boolean;
  readonly onRestore: () => void;
}

const HistoryEntry = memo(function HistoryEntry({
  entry,
  isDark,
  onRestore,
}: HistoryEntryProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 rounded-lg cursor-pointer',
        'transition-all duration-150',
        isDark
          ? 'hover:bg-white/[0.04]'
          : 'hover:bg-black/[0.025]'
      )}
      onClick={onRestore}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Favicon */}
      <div
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden',
          isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'
        )}
      >
        {entry.favIconUrl ? (
          <img
            src={entry.favIconUrl}
            alt=""
            className="w-4 h-4"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <History className={cn(
            'w-3 h-3',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-[11px] font-medium truncate',
            isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
          )}
        >
          {entry.title || entry.url}
        </div>
      </div>

      {/* Time */}
      <span className={cn(
        'text-[10px] tabular-nums shrink-0',
        isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
      )}>
        {formatTime(entry.closedAt)}
      </span>

      {/* Restore button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: isHovered ? 1 : 0, 
          scale: isHovered ? 1 : 0.8 
        }}
        transition={{ duration: 0.15 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 p-0 rounded-md',
            'bg-[rgba(29,217,180,0.1)] text-[#1dd9b4]',
            'hover:bg-[rgba(29,217,180,0.2)]'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          title="Restore"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </motion.div>
    </div>
  );
});

// ============================================================================
// Component
// ============================================================================

export const TimeMachinePanel = memo(function TimeMachinePanel({
  isOpen,
  onClose,
}: TimeMachinePanelProps): React.JSX.Element {
  const settings = useSettings();
  const isPro = useIsPro();

  const [history, setHistory] = useState<TabHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isDark = isDarkTheme(settings.theme);

  // Load history
  useEffect(() => {
    if (!isOpen) return;

    const loadHistory = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const entries = searchQuery.trim()
          ? await searchTabHistory(searchQuery)
          : await getTabHistory();
        setHistory(entries);
      } catch (e) {
        console.warn('[bTab] Failed to load tab history:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [isOpen, searchQuery]);

  // Group by date
  const dateGroups = useMemo(() => groupByDate(history), [history]);

  // Restore tab
  const handleRestore = useCallback(async (entry: TabHistoryEntry) => {
    try {
      window.open(entry.url, '_blank', 'noopener,noreferrer');
      setToastMessage('✨ Tab restored');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Failed to restore tab:', e);
    }
  }, []);

  // Clear all history
  const handleClearAll = useCallback(async () => {
    try {
      await clearTabHistory();
      setHistory([]);
      setToastMessage('History cleared');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Failed to clear history:', e);
    }
  }, []);

  // Handle ESC key
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'bg-[rgba(122,162,247,0.12)] border border-[rgba(122,162,247,0.25)]'
              )}
            >
              <History className="w-3.5 h-3.5 text-[#7aa2f7]" strokeWidth={2} />
            </div>
            <span className={cn('text-[13px] font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              Time Machine
            </span>
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

        <div
          className={cn(
            'flex flex-col items-center gap-3 p-5 rounded-xl border',
            isDark
              ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]'
              : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]'
          )}
        >
          <Crown className="w-8 h-8 text-[#f9e2af]" strokeWidth={1.5} />
          <div className="text-center">
            <div className={cn('text-[13px] font-semibold', isDark ? 'text-[#f9e2af]' : 'text-[#a08020]')}>
              Time Machine is a Pro feature
            </div>
            <div className={cn('text-[11px] mt-1', isDark ? 'text-[#8b94b2]' : 'text-[#666]')}>
              Browse and restore tabs from the past 30 days
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col gap-2.5 p-3 shrink-0 border-b max-h-[340px] overflow-hidden',
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
              'bg-[rgba(122,162,247,0.12)] border border-[rgba(122,162,247,0.25)]'
            )}
          >
            <History className="w-3.5 h-3.5 text-[#7aa2f7]" strokeWidth={2} />
          </div>
          <div>
            <span className={cn('text-[13px] font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              Time Machine
            </span>
            <span className={cn('text-[10px] ml-2', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
              {history.length} tabs
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'w-6 h-6 rounded-lg p-0',
                'text-[#f7768e] hover:bg-[rgba(247,118,142,0.12)]'
              )}
              onClick={handleClearAll}
              title="Clear all history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
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
      </div>

      {/* Search */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.1]'
            : 'bg-black/[0.02] border-black/[0.08]',
          'focus-within:border-[rgba(29,217,180,0.3)]',
          'transition-colors duration-150'
        )}
      >
        <Search className={cn('w-3.5 h-3.5', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search history..."
          className={cn(
            'flex-1 bg-transparent border-none outline-none text-[12px]',
            isDark ? 'text-[#edf0ff] placeholder:text-[#4e5578]' : 'text-[#0e1226] placeholder:text-[#8890ab]'
          )}
        />
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/[0.1]">
        {isLoading ? (
          <div className={cn('text-[12px] text-center py-6', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
            Loading...
          </div>
        ) : history.length === 0 ? (
          <div className={cn(
            'text-center py-6 px-4 rounded-xl',
            isDark
              ? 'bg-white/[0.02]'
              : 'bg-black/[0.02]'
          )}>
            <History className={cn(
              'w-8 h-8 mx-auto mb-2',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )} strokeWidth={1.5} />
            <p className={cn('text-[12px]', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
              {searchQuery ? 'No matching tabs' : 'No tab history yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {dateGroups.map((group, index) => (
              <CollapsibleDateGroup
                key={group.date}
                group={group}
                isDark={isDark}
                onRestore={handleRestore}
                defaultExpanded={index === 0} // Only first group expanded by default
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
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
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default TimeMachinePanel;
