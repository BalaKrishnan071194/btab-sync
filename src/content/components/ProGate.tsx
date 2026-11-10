/**
 * ProGate Component (S5-3)
 *
 * Semi-transparent overlay shown on Pro features for free users.
 * Displays lock icon and "Unlock with Pro" button.
 */

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown, Sparkles, ExternalLink, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import { ext } from '@/lib/browsers';
import { cn } from '../ui/cn';
import { BTAB_CHECKOUT_URL } from '@/lib/constants';

// ============================================================================
// Types
// ============================================================================

interface ProGateProps {
  /** Feature name to display */
  readonly featureName: string;
  /** Optional description */
  readonly description?: string;
  /** Callback when upgrade button is clicked */
  readonly onUpgrade?: () => void;
  /** Callback when close/back button is clicked */
  readonly onClose?: () => void;
  /** Whether the gate is inline (smaller) or full overlay */
  readonly variant?: 'inline' | 'overlay' | 'card';
  /** Custom class name */
  readonly className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const UPGRADE_URL = BTAB_CHECKOUT_URL;

// ============================================================================
// Component
// ============================================================================

export const ProGate = memo(function ProGate({
  featureName,
  description,
  onUpgrade,
  onClose,
  variant = 'card',
  className,
}: ProGateProps): React.JSX.Element {
  const settings = useSettings();
  const isPro = useIsPro();

  const isDark = isDarkTheme(settings.theme);

  const handleUpgrade = useCallback(() => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Open upgrade URL in new tab using window.open (works reliably in content scripts)
      window.open(UPGRADE_URL, '_blank', 'noopener,noreferrer');
    }
  }, [onUpgrade]);

  // Don't show if already Pro
  if (isPro) return <></>;

  // Inline variant - small badge
  if (variant === 'inline') {
    return (
      <motion.button
        type="button"
        onClick={handleUpgrade}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
          'text-[9px] font-medium cursor-pointer transition-colors',
          'bg-[rgba(249,226,175,0.12)] border border-[rgba(249,226,175,0.25)]',
          'text-[#f9e2af] hover:bg-[rgba(249,226,175,0.2)]',
          className
        )}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Lock className="w-2.5 h-2.5" strokeWidth={2} />
        PRO
      </motion.button>
    );
  }

  // Overlay variant - full semi-transparent overlay
  if (variant === 'overlay') {
    return (
      <motion.div
        className={cn(
          'absolute inset-0 z-20 flex items-center justify-center',
          'backdrop-blur-[2px]',
          isDark
            ? 'bg-[rgba(8,10,22,0.85)]'
            : 'bg-[rgba(255,255,255,0.85)]',
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'absolute top-3 right-3 p-1.5 rounded-lg transition-colors',
              isDark
                ? 'text-[#8b94b2] hover:text-[#edf0ff] hover:bg-[rgba(255,255,255,0.05)]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-[rgba(0,0,0,0.05)]'
            )}
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        )}

        <div className="flex flex-col items-center gap-3 p-6">
          {/* Lock Icon */}
          <div
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center',
              'bg-[rgba(249,226,175,0.12)] border-2 border-[rgba(249,226,175,0.3)]'
            )}
          >
            <Lock className="w-6 h-6 text-[#f9e2af]" strokeWidth={2} />
          </div>

          {/* Feature Name */}
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-[#f9e2af]" strokeWidth={2} />
            <span className={cn('text-sm font-bold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              {featureName}
            </span>
          </div>

          {/* Description */}
          {description && (
            <p className={cn('text-xs text-center max-w-[200px]', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
              {description}
            </p>
          )}

          {/* Upgrade Button */}
          <Button
            onClick={handleUpgrade}
            className={cn(
              'mt-1 px-6 py-2.5 rounded-lg text-sm font-semibold',
              'bg-gradient-to-r from-[#f9e2af] to-[#fab387]',
              'text-[#1a1a2e] shadow-lg',
              'hover:shadow-[0_0_20px_rgba(249,226,175,0.3)]',
              'transition-shadow duration-200'
            )}
          >
            <Sparkles className="w-4 h-4 mr-2" strokeWidth={2} />
            Unlock with Pro
          </Button>

          {/* Maybe Later / Back link */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'text-xs transition-colors',
                isDark
                  ? 'text-[#4e5578] hover:text-[#8b94b2]'
                  : 'text-[#8890ab] hover:text-[#444d6e]'
              )}
            >
              Maybe later
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Card variant - compact card style (default)
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg border',
        isDark
          ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]'
          : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]',
        className
      )}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
    >
      {/* Icon */}
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-[#f9e2af]" strokeWidth={2} />
        <span className={cn('text-xs font-bold', isDark ? 'text-[#f9e2af]' : 'text-[#a08020]')}>
          Pro Feature
        </span>
      </div>

      {/* Feature Name */}
      <div className={cn('text-xs font-medium text-center', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
        {featureName}
      </div>

      {/* Description */}
      {description && (
        <p className={cn('text-[10px] text-center', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
          {description}
        </p>
      )}

      {/* Upgrade Button */}
      <button
        type="button"
        onClick={handleUpgrade}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-md',
          'text-[11px] font-semibold transition-colors',
          'bg-[rgba(249,226,175,0.15)] border border-[rgba(249,226,175,0.3)]',
          'text-[#f9e2af] hover:bg-[rgba(249,226,175,0.25)]'
        )}
      >
        <ExternalLink className="w-3 h-3" strokeWidth={2} />
        Upgrade to Pro
      </button>
    </motion.div>
  );
});

export default ProGate;
