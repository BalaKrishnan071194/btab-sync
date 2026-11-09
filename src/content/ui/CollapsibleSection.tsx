/**
 * CollapsibleSection Component
 * 
 * A premium, reusable collapsible section with:
 * - Smooth animations
 * - Persistent collapse state in chrome.storage.local
 * - Professional design with count badges
 * - Keyboard accessibility
 */

import { memo, useState, useCallback, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { ext } from '@/lib/browsers';

// ============================================================================
// Types
// ============================================================================

interface CollapsibleSectionProps {
  /** Unique storage key for persisting collapse state */
  readonly storageKey: string;
  /** Section title */
  readonly title: string;
  /** Optional icon component */
  readonly icon?: ReactNode;
  /** Item count to display in badge */
  readonly count?: number;
  /** Badge color variant */
  readonly variant?: 'default' | 'teal' | 'gold' | 'red' | 'blue';
  /** Default expanded state (before storage is loaded) */
  readonly defaultExpanded?: boolean;
  /** Whether dark mode is active */
  readonly isDark: boolean;
  /** Section content */
  readonly children: ReactNode;
  /** Optional subtitle */
  readonly subtitle?: string;
  /** Right side action element */
  readonly action?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export const CollapsibleSection = memo(function CollapsibleSection({
  storageKey,
  title,
  icon,
  count,
  variant = 'default',
  defaultExpanded = true,
  isDark,
  children,
  subtitle,
  action,
}: CollapsibleSectionProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted state
  useEffect(() => {
    const loadState = async () => {
      try {
        const key = `btab_collapse_${storageKey}`;
        const result = await ext.storage.local.get(key);
        if (typeof result[key] === 'boolean') {
          setIsExpanded(result[key]);
        }
      } catch (e) {
        console.warn('[bTab] Failed to load collapse state:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    void loadState();
  }, [storageKey]);

  // Persist state changes
  const toggleExpanded = useCallback(async () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    try {
      const key = `btab_collapse_${storageKey}`;
      await ext.storage.local.set({ [key]: newValue });
    } catch (e) {
      console.warn('[bTab] Failed to save collapse state:', e);
    }
  }, [isExpanded, storageKey]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void toggleExpanded();
    }
  }, [toggleExpanded]);

  // Badge color classes
  const badgeColors = {
    default: isDark 
      ? 'bg-white/[0.08] text-[#8b94b2] border-white/[0.1]' 
      : 'bg-black/[0.05] text-[#444d6e] border-black/[0.08]',
    teal: 'bg-[rgba(29,217,180,0.12)] text-[#1dd9b4] border-[rgba(29,217,180,0.25)]',
    gold: 'bg-[rgba(249,226,175,0.12)] text-[#f9e2af] border-[rgba(249,226,175,0.25)]',
    red: 'bg-[rgba(247,118,142,0.12)] text-[#f7768e] border-[rgba(247,118,142,0.25)]',
    blue: 'bg-[rgba(122,162,247,0.12)] text-[#7aa2f7] border-[rgba(122,162,247,0.25)]',
  };

  return (
    <div className="relative">
      {/* Header */}
      <button
        type="button"
        onClick={() => void toggleExpanded()}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={`section-${storageKey}`}
        className={cn(
          'flex items-center gap-2 w-full px-2.5 py-1.5',
          'cursor-pointer select-none',
          'transition-all duration-150',
          'rounded-lg mx-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1dd9b4]/50',
          isDark 
            ? 'hover:bg-white/[0.03]' 
            : 'hover:bg-black/[0.02]',
        )}
      >
        {/* Chevron */}
        <motion.div
          initial={false}
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            'flex-shrink-0 w-4 h-4 flex items-center justify-center rounded',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}
        >
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.div>

        {/* Icon */}
        {icon && (
          <div className={cn(
            'flex-shrink-0',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}>
            {icon}
          </div>
        )}

        {/* Title & Subtitle */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span
            className={cn(
              'text-[10px] font-semibold tracking-[0.08em] uppercase',
              isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
            )}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className={cn(
                'text-[9px] font-medium',
                isDark ? 'text-[#4e5578]/70' : 'text-[#8890ab]/70'
              )}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Count Badge */}
        {typeof count === 'number' && count > 0 && (
          <span
            className={cn(
              'text-[9px] font-bold px-2 py-0.5 rounded-full border',
              'tabular-nums min-w-[20px] text-center',
              badgeColors[variant]
            )}
          >
            {count}
          </span>
        )}

        {/* Action */}
        {action && (
          <div 
            className="flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        )}

        {/* Divider Line */}
        <div
          className={cn(
            'flex-1 h-px ml-2',
            isDark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'
          )}
        />
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`section-${storageKey}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ 
              height: 'auto', 
              opacity: 1,
              transition: {
                height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.2, delay: 0.05 }
              }
            }}
            exit={{ 
              height: 0, 
              opacity: 0,
              transition: {
                height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.15 }
              }
            }}
            className="overflow-hidden"
          >
            <div className="pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CollapsibleSection;
