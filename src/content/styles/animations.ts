/**
 * BTab Switcher Animation Variants
 * Framer Motion configurations for smooth 200ms transitions
 */

import { Variants, Transition } from 'framer-motion';

// ─────────────────────────────────────────────
// Shared Transitions
// ─────────────────────────────────────────────

export const defaultTransition: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1], // ease-out
};

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

// ─────────────────────────────────────────────
// Panel Animations
// ─────────────────────────────────────────────

export const panelSlide: Variants = {
  hidden: {
    x: '100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
      opacity: { duration: 0.15 },
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1], // ease-in
    },
  },
};

export const panelBackdrop: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const panelScale: Variants = {
  hidden: {
    scale: 0.95,
    opacity: 0,
    y: -10,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: defaultTransition,
  },
  exit: {
    scale: 0.95,
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

// ─────────────────────────────────────────────
// Tab Item Animations
// ─────────────────────────────────────────────

export const tabHover: Variants = {
  idle: {
    backgroundColor: 'rgba(51, 65, 85, 0)',
    scale: 1,
  },
  hover: {
    backgroundColor: 'rgba(71, 85, 105, 0.6)',
    scale: 1,
    transition: { duration: 0.15 },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
  selected: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    transition: { duration: 0.2 },
  },
};

export const tabFocus: Variants = {
  unfocused: {
    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
  },
  focused: {
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)',
    transition: { duration: 0.15 },
  },
};

export const tabActive: Variants = {
  inactive: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 2,
  },
  active: {
    borderLeftColor: '#3b82f6',
    borderLeftWidth: 2,
    transition: { duration: 0.2 },
  },
};

// ─────────────────────────────────────────────
// List Reorder Animations
// ─────────────────────────────────────────────

export const listContainer: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

export const listItem: Variants = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: defaultTransition,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
};

export const listReorder: Variants = {
  initial: {
    scale: 1,
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
    zIndex: 0,
  },
  dragging: {
    scale: 1.02,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 50,
    transition: springTransition,
  },
};

// Layout transition for reorder
export const reorderLayoutTransition: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.8,
};

// ─────────────────────────────────────────────
// Search & Input Animations
// ─────────────────────────────────────────────

export const searchExpand: Variants = {
  collapsed: {
    width: 36,
    transition: { duration: 0.2 },
  },
  expanded: {
    width: '100%',
    transition: { duration: 0.2 },
  },
};

export const searchResults: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15, delay: 0.05 },
    },
  },
};

// ─────────────────────────────────────────────
// Group/Section Animations
// ─────────────────────────────────────────────

export const groupCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.1 },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15, delay: 0.1 },
    },
  },
};

export const groupHeader: Variants = {
  idle: {
    backgroundColor: 'rgba(30, 41, 59, 0)',
  },
  hover: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    transition: { duration: 0.15 },
  },
};

export const chevronRotate: Variants = {
  collapsed: {
    rotate: -90,
    transition: { duration: 0.2 },
  },
  expanded: {
    rotate: 0,
    transition: { duration: 0.2 },
  },
};

// ─────────────────────────────────────────────
// Button & Icon Animations
// ─────────────────────────────────────────────

export const buttonPress: Variants = {
  idle: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: { duration: 0.15 },
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

export const iconSpin: Variants = {
  idle: {
    rotate: 0,
  },
  spinning: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const fadeInOut: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// ─────────────────────────────────────────────
// Tooltip & Popover
// ─────────────────────────────────────────────

export const tooltip: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0, 0, 0.2, 1],
    },
  },
};

// ─────────────────────────────────────────────
// Utility Presets
// ─────────────────────────────────────────────

export const presets = {
  // Quick fade for simple show/hide
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  // Slide from right (for panels)
  slideRight: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Scale up (for modals/dialogs)
  scaleUp: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  // Slide down (for dropdowns)
  slideDown: {
    initial: { y: -10, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -10, opacity: 0 },
    transition: { duration: 0.15 },
  },
};
