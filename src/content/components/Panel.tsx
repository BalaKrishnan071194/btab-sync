/**
 * Panel Component
 *
 * Main overlay panel with Framer Motion slide animation.
 * Acts as the root container for the entire tab switcher UI.
 */

import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBTab, useOverlayVisibility, useSettings } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface PanelProps {
  readonly children: ReactNode;
}

// Dark themes list
const DARK_THEMES = ['midnight-teal', 'ocean-blue', 'purple-haze', 'emerald-forest'];

// ============================================================================
// Animation Variants - Slide in/out from right edge
// ============================================================================

const panelVariants = {
  hidden: {
    opacity: 0,
    x: '100%', // Start off-screen to the right (percentage-based for right-anchored element)
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 30,
      stiffness: 400,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    x: '100%', // Slide out to the right
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1], // Fast ease-out
    },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// Component
// ============================================================================

export function Panel({ children }: PanelProps): React.JSX.Element {
  const { actions } = useBTab();
  const visibility = useOverlayVisibility();
  const settings = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isVisible = visibility === 'visible' || visibility === 'animating-in';
  const isDark = DARK_THEMES.includes(settings.theme);

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        actions.hide();
      }
    },
    [actions]
  );

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isVisible) {
        event.preventDefault();
        event.stopPropagation();
        actions.hide();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isVisible, actions]);

  // Reset position when panel becomes visible
  useEffect(() => {
    if (isVisible && panelRef.current) {
      panelRef.current.style.left = '';
      panelRef.current.style.top = '';
      panelRef.current.style.right = '12px'; // 3 * 4px = 12px (matches right-3)
    }
  }, [isVisible]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[2147483646] pointer-events-none"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="bTab Sync - Tab Switcher"
            data-btab-theme={settings.theme}
            className={cn(
              'fixed w-[420px] max-h-[calc(100vh-24px)]',
              'rounded-2xl overflow-hidden pointer-events-auto',
              'flex flex-col font-sans',
              'border shadow-2xl',
              isDark ? [
                'bg-[var(--btab-bg-base)] backdrop-blur-[24px]',
                'border-[var(--btab-glass-border)]',
                'text-[var(--btab-text-primary)]',
                'shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)_inset]',
              ] : [
                'bg-[var(--btab-bg-base)] backdrop-blur-[24px]',
                'border-[var(--btab-glass-border)]',
                'text-[var(--btab-text-primary)]',
                'shadow-[0_12px_40px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.07)]',
              ]
            )}
            style={{ 
              top: '12px',
              right: '12px',
              minHeight: '450px',
            }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{
              top: 10,
              left: 10,
              right: typeof window !== 'undefined' ? window.innerWidth - 430 : 10,
              bottom: typeof window !== 'undefined' ? window.innerHeight - 300 : 10,
            }}
            onDragStart={() => {
              if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                panelRef.current.style.right = 'auto';
                panelRef.current.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 430))}px`;
                panelRef.current.style.top = `${Math.max(10, rect.top)}px`;
              }
            }}
            onDragEnd={() => {
              // Ensure panel stays within viewport after drag
              if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                if (rect.left < 10) panelRef.current.style.left = '10px';
                if (rect.top < 10) panelRef.current.style.top = '10px';
                if (rect.right > window.innerWidth - 10) {
                  panelRef.current.style.left = `${window.innerWidth - 430}px`;
                }
                if (rect.bottom > window.innerHeight - 10) {
                  panelRef.current.style.top = `${window.innerHeight - rect.height - 10}px`;
                }
              }
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Panel;
