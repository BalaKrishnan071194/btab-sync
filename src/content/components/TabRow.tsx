/**
 * TabRow Component - Premium Design
 *
 * Individual tab row with professional styling.
 * Features:
 * - Gradient favicons with ring borders
 * - Smooth hover transitions
 * - Color-coded status indicators
 * - Accessible action buttons
 * 
 * S1-1: Pinned tabs show gold accent and pin icon
 * S1-2: Search match highlighting
 */

import { memo, useState, useCallback, type ReactNode, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Moon, X, Link2, Flame, Zap, Snowflake, Leaf, Pin, PinOff, StickyNote, AlertTriangle, Play, Volume2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface TabRowProps {
  readonly tab: TabInfo;
  readonly isHighlighted: boolean;
  readonly isSelected: boolean;
  readonly privacyMode: boolean;
  readonly canDiscard: boolean;
  readonly isFirstDuplicate: boolean;
  readonly onSwitch: () => void;
  readonly onSleep: () => void;
  readonly onClose: () => void;
  readonly onPin: () => void;
  readonly onMergeDuplicates?: () => void;
  readonly onExpandDetails: () => void;
  readonly searchQuery?: string;
  readonly pinnedProtection?: boolean;
  readonly hasNote?: boolean;
  readonly isExpired?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FAV_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
];

// ============================================================================
// S1-2: Search Match Highlighting
// ============================================================================

function highlightMatches(text: string, query: string): ReactNode {
  if (!query || !text) return text;
  
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery || normalizedQuery.startsWith('/')) return text;
  
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const firstTerm = terms[0];
  if (!firstTerm) return text;
  
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(firstTerm);
  
  if (idx === -1) return text;
  
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + firstTerm.length);
  const after = text.slice(idx + firstTerm.length);
  
  return (
    <Fragment>
      {before}
      <mark className="bg-[rgba(29,217,180,0.25)] text-[#1dd9b4] rounded px-0.5 font-semibold">
        {match}
      </mark>
      {after}
    </Fragment>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getFavGradient(seed: string): string {
  // Special gradients for special URLs
  if (seed.includes('Extension') || seed.includes('extension')) {
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // Purple for extensions
  }
  if (seed === 'Chrome' || seed.includes('chrome://')) {
    return 'linear-gradient(135deg, #4285f4 0%, #34a853 50%, #fbbc05 75%, #ea4335 100%)'; // Chrome colors
  }
  if (seed === 'Firefox' || seed.includes('about:')) {
    return 'linear-gradient(135deg, #ff9500 0%, #ff0039 100%)'; // Firefox orange-red
  }
  if (seed === 'Local File' || seed.includes('file://')) {
    return 'linear-gradient(135deg, #8b94b2 0%, #4e5578 100%)'; // Gray for files
  }
  if (seed === 'localhost' || seed.includes('127.0.0.1')) {
    return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'; // Green for localhost
  }
  
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return FAV_GRADIENTS[h % FAV_GRADIENTS.length] ?? FAV_GRADIENTS[0]!;
}

function getFavLetter(title: string, url: string): string {
  // Special URL handling
  if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) return '⚙';
  if (url.startsWith('chrome://') || url.startsWith('about:')) return '⚙';
  if (url.startsWith('file://')) return '📄';
  if (url.startsWith('localhost') || url.includes('://localhost') || url.includes('://127.0.0.1')) return '🖥';
  
  if (title) return title[0]?.toUpperCase() ?? '?';
  try {
    const hostname = new URL(url).hostname;
    return hostname[0]?.toUpperCase() ?? '?';
  } catch {
    return '?';
  }
}

function getHostname(url: string): string {
  try {
    // Special URL handling for display
    if (url.startsWith('chrome-extension://')) return 'Chrome Extension';
    if (url.startsWith('moz-extension://')) return 'Firefox Extension';
    if (url.startsWith('chrome://')) return url.replace('chrome://', '').split('/')[0] || 'Chrome';
    if (url.startsWith('about:')) return url.replace('about:', '').split('/')[0] || 'Firefox';
    if (url.startsWith('file://')) return 'Local File';
    
    const hostname = new URL(url).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'localhost';
    return hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function getMemoryTier(mb: number): 'lo' | 'md' | 'hi' {
  if (mb < 100) return 'lo';
  if (mb < 300) return 'md';
  return 'hi';
}

// ============================================================================
// Favicon Component - Premium Design
// ============================================================================

interface FaviconProps {
  readonly title: string;
  readonly url: string;
  readonly favIconUrl: string;
  readonly isActive?: boolean;
  readonly isPinned?: boolean;
}

const Favicon = memo(function Favicon({
  title,
  url,
  favIconUrl,
  isActive = false,
  isPinned = false,
}: FaviconProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false);
  const hostname = getHostname(url);
  // Pass URL to gradient for special URL detection
  const gradient = getFavGradient(hostname || url || title);
  const letter = getFavLetter(title, url);

  return (
    <div className="relative">
      <div
        className={cn(
          'w-8 h-8 rounded-xl shrink-0 flex items-center justify-center',
          'text-xs font-bold text-white',
          'shadow-sm overflow-hidden',
          'transition-all duration-200',
          // Ring based on status
          isActive && 'ring-2 ring-[#22c55e] ring-offset-1 ring-offset-transparent',
          isPinned && !isActive && 'ring-2 ring-[#f9e2af]/50 ring-offset-1 ring-offset-transparent',
          !isActive && !isPinned && 'ring-1 ring-white/10'
        )}
        style={{ 
          background: imgFailed || !favIconUrl ? gradient : 'rgba(0,0,0,0.3)',
        }}
      >
        {favIconUrl && !imgFailed ? (
          <img
            src={favIconUrl}
            alt=""
            className="w-5 h-5"
            style={{ objectFit: 'contain' }}
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          letter
        )}
      </div>
      
      {/* Active indicator dot */}
      {isActive && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[rgba(16,20,36,0.95)] shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
      )}
    </div>
  );
});

// ============================================================================
// Memory Badge - Compact Design
// ============================================================================

interface MemoryBadgeProps {
  readonly mb: number;
  readonly discarded: boolean;
  readonly isDark: boolean;
}

const MemoryBadge = memo(function MemoryBadge({
  mb,
  discarded,
  isDark,
}: MemoryBadgeProps): React.JSX.Element {
  const tier = getMemoryTier(mb);
  const Icon = discarded ? Snowflake : tier === 'lo' ? Leaf : tier === 'md' ? Zap : Flame;

  const colors = {
    lo: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', text: '#22c55e' },
    md: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', text: '#f97316' },
    hi: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' },
  };

  const color = colors[tier];

  return (
    <span
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-md',
        'text-[10px] font-bold tabular-nums',
        'border transition-colors duration-150'
      )}
      style={{ 
        background: color.bg, 
        borderColor: color.border, 
        color: color.text 
      }}
    >
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {mb}
    </span>
  );
});

// ============================================================================
// Status Pill - Minimal Design
// ============================================================================

interface StatusPillProps {
  readonly tab: TabInfo;
  readonly isDark: boolean;
}

const StatusPill = memo(function StatusPill({
  tab,
  isDark,
}: StatusPillProps): React.JSX.Element | null {
  // Pinned
  if (tab.pinned) {
    return (
      <span 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[rgba(249,226,175,0.12)] text-[#f9e2af] border border-[rgba(249,226,175,0.25)]"
        title="Pinned"
      >
        <Pin className="w-2.5 h-2.5" strokeWidth={2.5} />
        PIN
      </span>
    );
  }

  // Frozen/Discarded
  if (tab.discarded) {
    return (
      <span 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[rgba(122,162,247,0.12)] text-[#7aa2f7] border border-[rgba(122,162,247,0.25)]"
        title="Frozen - Memory saved"
      >
        <Snowflake className="w-2.5 h-2.5" strokeWidth={2.5} />
        ZZZ
      </span>
    );
  }

  // Duplicate
  if (tab.isDuplicate) {
    return (
      <span 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[rgba(247,118,142,0.12)] text-[#f7768e] border border-[rgba(247,118,142,0.25)]"
        title="Duplicate tab"
      >
        <Link2 className="w-2.5 h-2.5" strokeWidth={2.5} />
        DUP
      </span>
    );
  }

  // Idle/Stale
  if (tab.isStale) {
    return (
      <span 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[rgba(255,158,100,0.12)] text-[#ff9e64] border border-[rgba(255,158,100,0.25)]"
        title={tab.idleLabel || 'Idle'}
      >
        <Moon className="w-2.5 h-2.5" strokeWidth={2.5} />
        {tab.idleLabel?.replace(' ago', '') || 'IDLE'}
      </span>
    );
  }

  // Active
  if (tab.active) {
    return (
      <span 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[rgba(34,197,94,0.12)] text-[#22c55e] border border-[rgba(34,197,94,0.25)]"
        title="Active tab"
      >
        <Play className="w-2.5 h-2.5" strokeWidth={2.5} fill="currentColor" />
        NOW
      </span>
    );
  }

  return null;
});

// ============================================================================
// Main Component
// ============================================================================

export const TabRow = memo(function TabRow({
  tab,
  isHighlighted,
  isSelected,
  privacyMode,
  canDiscard,
  isFirstDuplicate,
  onSwitch,
  onSleep,
  onClose,
  onPin,
  onMergeDuplicates,
  onExpandDetails,
  searchQuery = '',
  pinnedProtection = true,
  hasNote = false,
  isExpired = false,
}: TabRowProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const settings = useSettings();

  const isDark = isDarkTheme(settings.theme);

  const hostname = getHostname(tab.url);

  const handleClick = useCallback(
    (e: React.MouseEvent): void => {
      onExpandDetails();
    },
    [onExpandDetails]
  );

  const handleDoubleClick = useCallback((): void => {
    onSwitch();
  }, [onSwitch]);

  return (
    <motion.div
      role="option"
      aria-selected={isSelected}
      tabIndex={isHighlighted ? 0 : -1}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1',
        'transition-all duration-150 ease-out',
        'border border-transparent',
        // Highlighted state
        isHighlighted && [
          isDark 
            ? 'bg-[rgba(29,217,180,0.08)] border-[rgba(29,217,180,0.2)]' 
            : 'bg-[rgba(29,217,180,0.06)] border-[rgba(29,217,180,0.15)]',
        ],
        // Hover state
        !isHighlighted && isDark && 'hover:bg-white/[0.03] hover:border-white/[0.05]',
        !isHighlighted && !isDark && 'hover:bg-black/[0.02] hover:border-black/[0.04]',
        // Discarded tabs appear muted
        tab.discarded && 'opacity-60 hover:opacity-100'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Favicon */}
      <Favicon 
        title={tab.title} 
        url={tab.url} 
        favIconUrl={tab.favIconUrl}
        isActive={tab.active}
        isPinned={tab.pinned}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* Title Row */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[12px] font-semibold leading-tight truncate',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]',
              privacyMode && 'blur-[5px] select-none',
              isHovered && privacyMode && 'blur-none'
            )}
            title={tab.title || 'Untitled'}
          >
            {privacyMode ? (tab.title || 'Untitled') : highlightMatches(tab.title || 'Untitled', searchQuery)}
          </span>
          
          {/* Note indicator */}
          {hasNote && (
            <span title="Has note">
              <StickyNote
                className="w-3 h-3 shrink-0 text-[#7aa2f7]"
                strokeWidth={2}
              />
            </span>
          )}
          
          {/* Expired indicator */}
          {isExpired && (
            <span title="Expired - not visited in 7+ days">
              <AlertTriangle
                className="w-3 h-3 shrink-0 text-[#ff9e64]"
                strokeWidth={2}
              />
            </span>
          )}
        </div>
        
        {/* Domain */}
        <span
          className={cn(
            'text-[10px] font-medium truncate',
            isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]',
            privacyMode && 'blur-[5px] select-none',
            isHovered && privacyMode && 'blur-none'
          )}
        >
          {hostname}
        </span>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Audio indicator - shows when tab is playing audio/video */}
        {tab.audible && (
          <span 
            className="flex items-center justify-center w-5 h-5 rounded-md bg-[rgba(122,162,247,0.15)] border border-[rgba(122,162,247,0.3)]"
            title="Playing audio"
          >
            <Volume2 className="w-3 h-3 text-[#7aa2f7]" strokeWidth={2.5} />
          </span>
        )}
        
        {/* Memory Badge */}
        <MemoryBadge mb={tab.estimatedMemoryMB} discarded={tab.discarded} isDark={isDark} />
        
        {/* Status Pill */}
        <StatusPill tab={tab} isDark={isDark} />
      </div>

      {/* Actions - Reveal on hover */}
      <div
        className={cn(
          'flex items-center gap-1 shrink-0 transition-all duration-150',
          isHovered || isHighlighted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        )}
      >
        {/* Sleep Button */}
        {!tab.active && !tab.discarded && canDiscard && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-7 h-7 rounded-lg',
              'transition-all duration-150',
              isDark
                ? 'text-[#8b94b2] bg-white/[0.03] hover:bg-[rgba(29,217,180,0.12)] hover:text-[#1dd9b4] ring-1 ring-white/[0.06]'
                : 'text-[#64748b] bg-black/[0.04] hover:bg-[rgba(20,184,150,0.15)] hover:text-[#0d9488] ring-1 ring-black/[0.12]'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSleep();
            }}
            title="Sleep tab (save memory)"
          >
            <Moon className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        )}

        {/* Merge Duplicates */}
        {tab.isDuplicate && isFirstDuplicate && onMergeDuplicates && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-7 h-7 rounded-lg',
              'transition-all duration-150',
              isDark
                ? 'text-[#8b94b2] bg-white/[0.03] hover:bg-[rgba(255,158,100,0.12)] hover:text-[#ff9e64] ring-1 ring-white/[0.06]'
                : 'text-[#64748b] bg-black/[0.04] hover:bg-[rgba(234,88,12,0.15)] hover:text-[#ea580c] ring-1 ring-black/[0.12]'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onMergeDuplicates();
            }}
            title="Merge duplicates"
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        )}

        {/* Pin/Unpin Button */}
        {!tab.active && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-7 h-7 rounded-lg',
              'transition-all duration-150',
              tab.pinned
                ? isDark
                  ? 'text-[#f9e2af] bg-[rgba(249,226,175,0.08)] hover:bg-[rgba(249,226,175,0.15)] ring-1 ring-[rgba(249,226,175,0.2)]'
                  : 'text-[#b45309] bg-[rgba(251,191,36,0.15)] hover:bg-[rgba(251,191,36,0.25)] ring-1 ring-[rgba(251,191,36,0.4)]'
                : isDark
                  ? 'text-[#8b94b2] bg-white/[0.03] hover:bg-[rgba(249,226,175,0.12)] hover:text-[#f9e2af] ring-1 ring-white/[0.06]'
                  : 'text-[#64748b] bg-black/[0.04] hover:bg-[rgba(251,191,36,0.15)] hover:text-[#b45309] ring-1 ring-black/[0.12]'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
          >
            {tab.pinned ? (
              <PinOff className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Pin className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </Button>
        )}

        {/* Close or Active indicator */}
        {tab.active ? (
          // Don't show close button for active/current tab
          <span 
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg',
              'bg-[rgba(34,197,94,0.08)] ring-1 ring-[rgba(34,197,94,0.2)]',
              isDark ? 'text-[#22c55e]' : 'text-[#16a34a]'
            )}
            title="Current tab (cannot close)"
          >
            <Play className="w-3.5 h-3.5" strokeWidth={2} fill="currentColor" />
          </span>
        ) : tab.pinned && pinnedProtection ? (
          // Pinned tabs show pin icon instead of close when protection is on
          <span 
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg',
              isDark 
                ? 'bg-[rgba(249,226,175,0.08)] ring-1 ring-[rgba(249,226,175,0.2)] text-[#f9e2af]'
                : 'bg-[rgba(251,191,36,0.15)] ring-1 ring-[rgba(251,191,36,0.4)] text-[#b45309]'
            )}
            title="Pinned tab (protected)"
          >
            <Pin className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-7 h-7 rounded-lg',
              'transition-all duration-150',
              isDark
                ? 'text-[#8b94b2] bg-white/[0.03] hover:bg-[rgba(247,118,142,0.12)] hover:text-[#f7768e] ring-1 ring-white/[0.06]'
                : 'text-[#64748b] bg-black/[0.04] hover:bg-[rgba(220,38,38,0.12)] hover:text-[#dc2626] ring-1 ring-black/[0.12]'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close tab"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

export default TabRow;
