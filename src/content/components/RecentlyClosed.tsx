/**
 * RecentlyClosed Component
 *
 * Premium collapsible section showing recently closed tabs.
 * Features:
 * - Persistent collapse state via chrome.storage
 * - Professional design with smooth animations
 * - Hover-reveal actions
 * - Accessibility support
 */

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { useSettings, isDarkTheme } from '../BTabContext';
import type { RecentlyClosedTab } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface RecentlyClosedProps {
  readonly entries: readonly RecentlyClosedTab[];
  readonly highlightedIndex: number;
  readonly baseIndex: number;
  readonly privacyMode: boolean;
  readonly onRestore: (sessionId: string) => void;
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
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #cd9cf2 0%, #f6f3ff 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
];

// ============================================================================
// Helpers
// ============================================================================

function getFavGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return FAV_GRADIENTS[h % FAV_GRADIENTS.length] ?? FAV_GRADIENTS[0]!;
}

function getFavLetter(title: string, url: string): string {
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
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

// ============================================================================
// Favicon Component
// ============================================================================

interface FaviconProps {
  readonly title: string;
  readonly url: string;
  readonly favIconUrl: string;
  readonly size?: 'sm' | 'md';
}

const Favicon = memo(function Favicon({
  title,
  url,
  favIconUrl,
  size = 'md',
}: FaviconProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false);
  const hostname = getHostname(url);
  const gradient = getFavGradient(hostname || title);
  const letter = getFavLetter(title, url);

  const sizeClasses = size === 'sm' 
    ? 'w-6 h-6 rounded-md text-[10px]'
    : 'w-8 h-8 rounded-lg text-xs';

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';

  return (
    <div
      className={cn(
        sizeClasses,
        'shrink-0 flex items-center justify-center',
        'font-semibold text-white',
        'shadow-sm',
        'ring-1 ring-white/10',
        'overflow-hidden'
      )}
      style={{ 
        background: imgFailed || !favIconUrl ? gradient : 'rgba(0,0,0,0.3)',
      }}
    >
      {favIconUrl && !imgFailed ? (
        <img
          src={favIconUrl}
          alt=""
          className={iconSize}
          style={{ objectFit: 'contain' }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        letter
      )}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const RecentlyClosed = memo(function RecentlyClosed({
  entries,
  highlightedIndex,
  baseIndex,
  privacyMode,
  onRestore,
}: RecentlyClosedProps): React.JSX.Element {
  const settings = useSettings();

  const isDark = isDarkTheme(settings.theme);

  return (
    <div className="mt-2 shrink-0">
      <CollapsibleSection
        storageKey="recently_closed"
        title="Recently Closed"
        icon={<Clock className="w-3 h-3" strokeWidth={2} />}
        count={entries.length}
        variant="default"
        defaultExpanded={false}
      isDark={isDark}
    >
      {/* Empty State */}
      {entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'flex flex-col items-center gap-1.5 py-4 px-3',
            'text-center'
          )}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              isDark 
                ? 'bg-white/[0.04] text-[#4e5578]' 
                : 'bg-black/[0.03] text-[#8890ab]'
            )}
          >
            <Clock className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <p className={cn(
              'text-[11px] font-medium',
              isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
            )}>
              No recently closed tabs
            </p>
            <p className={cn(
              'text-[9px] mt-0.5',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}>
              Closed tabs will appear here
            </p>
          </div>
        </motion.div>
      ) : (
        /* Entries List */
        <div className="flex flex-col gap-0.5 px-1">
          <AnimatePresence mode="popLayout">
            {entries.map((entry, index) => {
              const globalIndex = baseIndex + index;
              const isHighlighted = globalIndex === highlightedIndex;

              return (
                <RecentlyClosedRow
                  key={entry.sessionId}
                  entry={entry}
                  isHighlighted={isHighlighted}
                  privacyMode={privacyMode}
                  isDark={isDark}
                  onRestore={() => onRestore(entry.sessionId)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </CollapsibleSection>
    </div>
  );
});

// ============================================================================
// Row Component
// ============================================================================

interface RecentlyClosedRowProps {
  readonly entry: RecentlyClosedTab;
  readonly isHighlighted: boolean;
  readonly privacyMode: boolean;
  readonly isDark: boolean;
  readonly onRestore: () => void;
}

const RecentlyClosedRow = memo(function RecentlyClosedRow({
  entry,
  isHighlighted,
  privacyMode,
  isDark,
  onRestore,
}: RecentlyClosedRowProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const hostname = getHostname(entry.url);

  return (
    <motion.div
      role="option"
      aria-selected={isHighlighted}
      tabIndex={isHighlighted ? 0 : -1}
      className={cn(
        'group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer',
        'transition-all duration-150 ease-out',
        // Highlighted state
        isHighlighted && [
          isDark 
            ? 'bg-[rgba(29,217,180,0.08)] ring-1 ring-[rgba(29,217,180,0.2)]' 
            : 'bg-[rgba(29,217,180,0.06)] ring-1 ring-[rgba(29,217,180,0.15)]',
        ],
        // Hover state
        !isHighlighted && isDark && 'hover:bg-white/[0.04]',
        !isHighlighted && !isDark && 'hover:bg-black/[0.025]'
      )}
      onClick={onRestore}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, transition: { duration: 0.1 } }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Favicon */}
      <Favicon 
        title={entry.title} 
        url={entry.url} 
        favIconUrl={entry.favIconUrl}
        size="md"
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* Title */}
        <div
          className={cn(
            'text-[12px] font-semibold leading-tight truncate',
            isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]',
            privacyMode && 'blur-[5px] select-none',
            isHovered && privacyMode && 'blur-none'
          )}
          title={entry.title || 'Untitled'}
        >
          {entry.title || 'Untitled'}
        </div>
        
        {/* URL/Domain */}
        <div className="flex items-center gap-1.5">
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
      </div>

      {/* Time Badge */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg',
          'text-[9px] font-semibold tracking-wide',
          'transition-all duration-150',
          isDark
            ? 'bg-white/[0.04] text-[#4e5578] border border-white/[0.06]'
            : 'bg-black/[0.03] text-[#8890ab] border border-black/[0.04]'
        )}
      >
        <Clock className="w-2.5 h-2.5" strokeWidth={2} />
        {entry.closedAgoLabel || 'just now'}
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 transition-all duration-150',
          isHovered || isHighlighted ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Restore Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-7 h-7 rounded-lg',
            'transition-all duration-150',
            isDark
              ? 'text-[#9ece6a] bg-[rgba(158,206,106,0.08)] hover:bg-[rgba(158,206,106,0.15)] ring-1 ring-[rgba(158,206,106,0.15)]'
              : 'text-[#2a7040] bg-[rgba(42,112,64,0.06)] hover:bg-[rgba(42,112,64,0.1)] ring-1 ring-[rgba(42,112,64,0.12)]'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          title="Restore tab"
        >
          <Undo2 className="w-3.5 h-3.5" strokeWidth={2} />
        </Button>
      </div>
    </motion.div>
  );
});

export default RecentlyClosed;
